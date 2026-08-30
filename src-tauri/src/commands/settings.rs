use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    #[serde(default = "default_ssh_port")]
    pub default_ssh_port: u16,
    #[serde(default = "default_username")]
    pub default_username: String,
    #[serde(default = "default_connect_timeout_secs")]
    pub connect_timeout_secs: u64,
    #[serde(default = "default_os")]
    pub default_os: String,
    #[serde(default = "default_history_limit")]
    pub history_limit: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_ssh_port: default_ssh_port(),
            default_username: default_username(),
            connect_timeout_secs: default_connect_timeout_secs(),
            default_os: default_os(),
            history_limit: default_history_limit(),
        }
    }
}

fn default_ssh_port() -> u16 { 22 }
fn default_username() -> String { "root".into() }
fn default_connect_timeout_secs() -> u64 { 10 }
fn default_os() -> String { "ubuntu2404".into() }
fn default_history_limit() -> u32 { 50 }

fn settings_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot resolve config directory")?;
    let dir = base.join("easix");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create config dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

#[command]
pub fn get_settings() -> Result<AppSettings, String> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Cannot write settings: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_settings_values() {
        let s = AppSettings::default();
        assert_eq!(s.default_ssh_port, 22);
        assert_eq!(s.default_username, "root");
        assert_eq!(s.connect_timeout_secs, 10);
        assert_eq!(s.default_os, "ubuntu2404");
        assert_eq!(s.history_limit, 50);
    }

    #[test]
    fn test_settings_serde_roundtrip() {
        let s = AppSettings {
            default_ssh_port: 2222,
            default_username: "admin".into(),
            connect_timeout_secs: 30,
            default_os: "windows11".into(),
            history_limit: 100,
        };
        let json = serde_json::to_string(&s).unwrap();
        let restored: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.default_ssh_port, 2222);
        assert_eq!(restored.default_username, "admin");
        assert_eq!(restored.connect_timeout_secs, 30);
        assert_eq!(restored.default_os, "windows11");
        assert_eq!(restored.history_limit, 100);
    }

    #[test]
    fn test_partial_json_uses_defaults() {
        let json = r#"{"default_username": "admin"}"#;
        let s: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(s.default_username, "admin");
        assert_eq!(s.default_ssh_port, 22);
        assert_eq!(s.history_limit, 50);
    }
}
