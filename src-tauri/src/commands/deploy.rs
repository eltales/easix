#[allow(unused_imports)]
use crate::models::Profile;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const CONNECT_TIMEOUT_SECS: u64 = 10;

#[derive(Clone, serde::Serialize)]
struct DeployLogEvent {
    #[serde(rename = "targetId")]
    target_id: String,
    line: String,
}

#[derive(Clone, serde::Serialize)]
struct DeployMetaEvent {
    #[serde(rename = "targetId")]
    target_id: String,
    #[serde(rename = "totalSteps")]
    total_steps: usize,
}

#[cfg(feature = "ssh")]
fn emit_deploy_log(app: &tauri::AppHandle, target_id: &str, line: &str) {
    use tauri::Emitter;
    let _ = app.emit(
        "deploy-log",
        DeployLogEvent {
            target_id: target_id.to_string(),
            line: line.to_string(),
        },
    );
}

#[cfg(feature = "ssh")]
fn emit_deploy_meta(app: &tauri::AppHandle, target_id: &str, total_steps: usize) {
    use tauri::Emitter;
    let _ = app.emit(
        "deploy-meta",
        DeployMetaEvent {
            target_id: target_id.to_string(),
            total_steps,
        },
    );
}

/// True when a remote command's `uname -s` output indicates a Unix-like
/// shell actually ran it (nonzero exit or empty output means it almost
/// certainly wasn't understood, e.g. by Windows' cmd.exe/PowerShell).
fn is_unix_uname_output(exit_status: i32, output: &str) -> bool {
    exit_status == 0 && !output.trim().is_empty()
}

#[cfg(feature = "ssh")]
fn active_connections() -> &'static Mutex<HashMap<String, std::net::TcpStream>> {
    static ACTIVE_CONNECTIONS: OnceLock<Mutex<HashMap<String, std::net::TcpStream>>> = OnceLock::new();
    ACTIVE_CONNECTIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Removes this target's registered connection when dropped, so a completed
/// or failed deploy can no longer be "cancelled" by a stale target id.
#[cfg(feature = "ssh")]
struct ConnectionGuard(String);

#[cfg(feature = "ssh")]
impl Drop for ConnectionGuard {
    fn drop(&mut self) {
        if let Ok(mut map) = active_connections().lock() {
            map.remove(&self.0);
        }
    }
}

/// Aborts a running deploy by forcibly closing its TCP connection, which
/// causes the blocked SSH read in `deploy_ssh` to fail and return an error.
#[tauri::command]
pub fn cancel_deploy(target_id: String) -> Result<bool, String> {
    #[cfg(feature = "ssh")]
    {
        let mut map = active_connections().lock().map_err(|e| e.to_string())?;
        if let Some(stream) = map.remove(&target_id) {
            let _ = stream.shutdown(std::net::Shutdown::Both);
            return Ok(true);
        }
        Ok(false)
    }
    #[cfg(not(feature = "ssh"))]
    {
        let _ = target_id;
        Ok(false)
    }
}

#[cfg(feature = "ssh")]
fn detect_remote_is_windows(sess: &ssh2::Session) -> Result<bool, String> {
    use std::io::Read;
    let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
    channel.exec("uname -s").map_err(|e| e.to_string())?;
    let mut output = String::new();
    channel.read_to_string(&mut output).ok();
    channel.wait_close().ok();
    let exit_status = channel.exit_status().unwrap_or(-1);
    Ok(!is_unix_uname_output(exit_status, &output))
}

#[cfg(feature = "ssh")]
fn establish_connection(
    host: &str,
    port: Option<u16>,
    connect_timeout_secs: Option<u64>,
) -> Result<std::net::TcpStream, String> {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;

    let addr = format!("{host}:{}", port.unwrap_or(22));
    let socket_addr = addr
        .to_socket_addrs()
        .map_err(|e| format!("Invalid address '{addr}': {e}"))?
        .next()
        .ok_or_else(|| format!("Could not resolve address '{addr}'"))?;
    let timeout = connect_timeout_secs.unwrap_or(CONNECT_TIMEOUT_SECS);
    TcpStream::connect_timeout(&socket_addr, Duration::from_secs(timeout))
        .map_err(|e| format!("Connection failed: {e}"))
}

#[cfg(feature = "ssh")]
fn authenticate(
    sess: &ssh2::Session,
    user: &str,
    key_path: &Option<String>,
    password: &Option<String>,
) -> Result<(), String> {
    if let Some(key) = key_path {
        sess.userauth_pubkey_file(user, None, std::path::Path::new(key), None)
            .map_err(|e| format!("Key auth failed: {e}"))
    } else if let Some(pass) = password {
        sess.userauth_password(user, pass)
            .map_err(|e| format!("Password auth failed: {e}"))
    } else {
        Err("No password or key provided".into())
    }
}

#[cfg(feature = "ssh")]
fn check_remote_os_or_abort(
    sess: &ssh2::Session,
    app: &tauri::AppHandle,
    target_id: &str,
    is_windows: bool,
) -> Result<(), String> {
    match detect_remote_is_windows(sess) {
        Ok(remote_is_windows) if remote_is_windows != is_windows => {
            let expected = if is_windows { "Windows" } else { "Linux/Unix" };
            let found = if remote_is_windows { "Windows" } else { "Linux/Unix" };
            Err(format!(
                "OS mismatch: profile targets {expected}, but the remote host looks like {found}. Aborting before running the script."
            ))
        }
        Ok(_) => Ok(()),
        Err(e) => {
            emit_deploy_log(app, target_id, &format!("[easix] [WARN] Could not verify remote OS: {e}"));
            Ok(())
        }
    }
}

#[cfg(feature = "ssh")]
fn remote_script_target(is_windows: bool) -> (&'static str, String) {
    if is_windows {
        let path = "C:/Windows/Temp/easix_provision.ps1";
        (
            path,
            format!(
                "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"{path}\""
            ),
        )
    } else {
        let path = "/tmp/easix_provision.sh";
        (path, format!("sh {path}"))
    }
}

#[cfg(feature = "ssh")]
fn stream_channel_output(
    channel: &mut ssh2::Channel,
    app: &tauri::AppHandle,
    target_id: &str,
) -> Result<String, String> {
    use std::io::Read;

    // Stream stdout line-by-line as it arrives instead of blocking until the
    // whole remote command finishes.
    let mut full_output = String::new();
    let mut pending_line = String::new();
    let mut buf = [0u8; 4096];
    loop {
        let n = channel.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        let chunk = String::from_utf8_lossy(&buf[..n]);
        full_output.push_str(&chunk);
        pending_line.push_str(&chunk);
        while let Some(pos) = pending_line.find('\n') {
            let line: String = pending_line.drain(..=pos).collect();
            emit_deploy_log(app, target_id, line.trim_end_matches(['\r', '\n']));
        }
    }
    if !pending_line.is_empty() {
        emit_deploy_log(app, target_id, &pending_line);
    }

    let mut stderr = String::new();
    channel.stderr().read_to_string(&mut stderr).ok();
    channel.wait_close().ok();

    if !stderr.is_empty() {
        full_output.push_str("\n--- STDERR ---\n");
        full_output.push_str(&stderr);
        for line in stderr.lines() {
            emit_deploy_log(app, target_id, line);
        }
    }

    Ok(full_output)
}

#[tauri::command]
#[allow(unused_variables)]
pub fn deploy_ssh(
    app: tauri::AppHandle,
    target_id: String,
    profile: Profile,
    host: String,
    port: Option<u16>,
    username: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
    connect_timeout_secs: Option<u64>,
) -> Result<String, String> {
    #[cfg(feature = "ssh")]
    {
        use ssh2::Session;

        let is_windows = profile.is_windows();
        let script = super::generator::generate_script(profile)?;
        let total_steps = script
            .lines()
            .filter(|l| l.trim_start().contains("[STEP]"))
            .count();

        let tcp = establish_connection(&host, port, connect_timeout_secs)?;

        let cancel_handle = tcp.try_clone().map_err(|e| e.to_string())?;
        active_connections()
            .lock()
            .map_err(|e| e.to_string())?
            .insert(target_id.clone(), cancel_handle);
        let _guard = ConnectionGuard(target_id.clone());

        emit_deploy_meta(&app, &target_id, total_steps);

        let mut sess = Session::new().map_err(|e| e.to_string())?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| e.to_string())?;

        let default_user = if is_windows { "administrator" } else { "root" };
        let user = username.as_deref().unwrap_or(default_user);
        authenticate(&sess, user, &key_path, &password)?;

        emit_deploy_log(&app, &target_id, "[easix] Connected, checking remote OS...");
        check_remote_os_or_abort(&sess, &app, &target_id, is_windows)?;

        let (remote_path, exec_command) = remote_script_target(is_windows);

        emit_deploy_log(&app, &target_id, "[easix] Uploading script...");
        let script_bytes = script.as_bytes();
        let mut remote_file = sess
            .scp_send(
                std::path::Path::new(remote_path),
                0o755,
                script_bytes.len() as u64,
                None,
            )
            .map_err(|e| format!("SCP upload failed: {e}"))?;
        std::io::Write::write_all(&mut remote_file, script_bytes)
            .map_err(|e| format!("Write failed: {e}"))?;
        drop(remote_file);

        emit_deploy_log(&app, &target_id, "[easix] Script uploaded, starting execution...");
        let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
        channel.exec(&exec_command).map_err(|e| e.to_string())?;

        stream_channel_output(&mut channel, &app, &target_id)
    }

    #[cfg(not(feature = "ssh"))]
    {
        Err("SSH support not compiled. Build with: cargo build --features ssh".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_unix_uname_output_success() {
        assert!(is_unix_uname_output(0, "Linux\n"));
        assert!(is_unix_uname_output(0, "Darwin\n"));
    }

    #[test]
    fn test_is_unix_uname_output_nonzero_exit_is_not_unix() {
        assert!(!is_unix_uname_output(1, ""));
        assert!(!is_unix_uname_output(127, ""));
    }

    #[test]
    fn test_is_unix_uname_output_empty_is_not_unix() {
        assert!(!is_unix_uname_output(0, "   \n"));
    }
}
