use std::fs;
use std::path::PathBuf;
use tauri::command;
use tauri_plugin_shell::ShellExt;

use crate::models::Device;

fn devices_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot resolve config directory")?;
    let dir = base.join("easix").join("devices");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create devices dir: {e}"))?;
    Ok(dir)
}

#[command]
pub fn list_devices() -> Result<Vec<Device>, String> {
    let dir = devices_dir()?;
    let mut devices: Vec<Device> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()?.to_str()? == "json" {
                let content = fs::read_to_string(&path).ok()?;
                serde_json::from_str(&content).ok()
            } else {
                None
            }
        })
        .collect();
    devices.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(devices)
}

#[command]
pub fn save_device(device: Device) -> Result<(), String> {
    let dir = devices_dir()?;
    let path = dir.join(format!("{}.json", device.id));
    let json = serde_json::to_string_pretty(&device).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Cannot write device: {e}"))
}

#[command]
pub fn delete_device(id: String) -> Result<(), String> {
    let dir = devices_dir()?;
    let path = dir.join(format!("{id}.json"));
    if !path.exists() {
        return Err(format!("Device '{id}' not found"));
    }
    fs::remove_file(&path).map_err(|e| format!("Cannot delete device: {e}"))
}

#[command]
pub async fn ping_device(host: String, port: u16) -> Option<u32> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::net::{TcpStream, ToSocketAddrs};
        use std::time::{Duration, Instant};

        let addr = format!("{}:{}", host, port);
        match addr.to_socket_addrs() {
            Ok(mut addrs) => {
                if let Some(a) = addrs.next() {
                    let start = Instant::now();
                    if TcpStream::connect_timeout(&a, Duration::from_secs(2)).is_ok() {
                        Some(start.elapsed().as_millis() as u32)
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    })
    .await
    .unwrap_or(None)
}

#[command]
pub fn duplicate_device(id: String) -> Result<Device, String> {
    let dir = devices_dir()?;
    let path = dir.join(format!("{id}.json"));
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut device: Device = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let new_id = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let t = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        format!("{:x}cp", t)
    };
    device.id = new_id;
    device.name = format!("{} (copy)", device.name);
    device.last_connected = None;

    let new_path = dir.join(format!("{}.json", device.id));
    let json = serde_json::to_string_pretty(&device).map_err(|e| e.to_string())?;
    fs::write(&new_path, json).map_err(|e| format!("Cannot write device: {e}"))?;
    Ok(device)
}

#[command]
pub async fn connect_device(
    app: tauri::AppHandle,
    host: String,
    port: u16,
    username: String,
) -> Result<(), String> {
    let ssh_target = format!("{}@{}", username, host);
    let port_str = port.to_string();

    // Try Windows Terminal first, fall back to cmd
    let wt_result = app
        .shell()
        .command("wt.exe")
        .args(["new-tab", "--", "ssh", &ssh_target, "-p", &port_str])
        .spawn();

    if wt_result.is_ok() {
        return Ok(());
    }

    // Fallback: plain cmd window
    app.shell()
        .command("cmd.exe")
        .args(["/c", "start", "cmd", "/k", &format!("ssh {} -p {}", ssh_target, port_str)])
        .spawn()
        .map_err(|e| format!("Cannot open terminal: {e}"))?;

    Ok(())
}
