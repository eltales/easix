#[allow(unused_imports)]
use crate::models::Profile;

#[tauri::command]
#[allow(unused_variables)]
pub fn deploy_ssh(
    profile: Profile,
    host: String,
    port: Option<u16>,
    username: Option<String>,
    password: Option<String>,
    key_path: Option<String>,
) -> Result<String, String> {
    #[cfg(feature = "ssh")]
    {
        use ssh2::Session;
        use std::io::Read;
        use std::net::TcpStream;

        let script = super::generator::generate_script(profile)?;
        let addr = format!("{}:{}", host, port.unwrap_or(22));
        let tcp = TcpStream::connect(&addr).map_err(|e| format!("Connection failed: {e}"))?;

        let mut sess = Session::new().map_err(|e| e.to_string())?;
        sess.set_tcp_stream(tcp);
        sess.handshake().map_err(|e| e.to_string())?;

        let user = username.as_deref().unwrap_or("root");

        if let Some(ref key) = key_path {
            sess.userauth_pubkey_file(user, None, std::path::Path::new(key), None)
                .map_err(|e| format!("Key auth failed: {e}"))?;
        } else if let Some(ref pass) = password {
            sess.userauth_password(user, pass)
                .map_err(|e| format!("Password auth failed: {e}"))?;
        } else {
            return Err("No password or key provided".into());
        }

        let remote_path = "/tmp/easix_provision.sh";

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

        let mut channel = sess.channel_session().map_err(|e| e.to_string())?;
        channel
            .exec(&format!("sh {remote_path}"))
            .map_err(|e| e.to_string())?;
        let mut output = String::new();
        channel.read_to_string(&mut output).map_err(|e| e.to_string())?;
        let mut stderr = String::new();
        channel.stderr().read_to_string(&mut stderr).ok();
        channel.wait_close().ok();

        if !stderr.is_empty() {
            output.push_str("\n--- STDERR ---\n");
            output.push_str(&stderr);
        }

        Ok(output)
    }

    #[cfg(not(feature = "ssh"))]
    {
        Err("SSH support not compiled. Build with: cargo build --features ssh".into())
    }
}
