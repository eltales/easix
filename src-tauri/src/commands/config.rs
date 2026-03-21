use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use serde::{Deserialize, Serialize};

use crate::models::{Device, Profile};

// ── Directory helpers ─────────────────────────────────────────────────────────

fn profiles_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot resolve config directory")?;
    let dir = base.join("easix").join("profiles");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create profiles dir: {e}"))?;
    Ok(dir)
}

fn devices_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot resolve config directory")?;
    let dir = base.join("easix").join("devices");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create devices dir: {e}"))?;
    Ok(dir)
}

fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}

// ── Bundle format ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct ConfigBundle {
    version: u32,
    #[serde(default)]
    profiles: HashMap<String, Profile>,
    #[serde(default)]
    devices: Vec<Device>,
}

// ── Export config (profiles + devices) ───────────────────────────────────────

#[command]
pub async fn export_config(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let pdir = profiles_dir()?;
    let ddir = devices_dir()?;

    let mut profiles: HashMap<String, Profile> = HashMap::new();
    for entry in fs::read_dir(&pdir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(p) = serde_json::from_str::<Profile>(&content) {
                    profiles.insert(stem, p);
                }
            }
        }
    }

    let mut devices: Vec<Device> = Vec::new();
    for entry in fs::read_dir(&ddir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(d) = serde_json::from_str::<Device>(&content) {
                    devices.push(d);
                }
            }
        }
    }

    if profiles.is_empty() && devices.is_empty() {
        return Err("Nothing to export".into());
    }

    let bundle = ConfigBundle { version: 2, profiles, devices };
    let json = serde_json::to_string_pretty(&bundle).map_err(|e| e.to_string())?;

    let save_path = app
        .dialog()
        .file()
        .set_file_name("easix-config.esx")
        .add_filter("Easix Config", &["esx"])
        .blocking_save_file();

    match save_path {
        Some(p) => {
            let file_path = p.as_path().ok_or("Invalid path")?;
            fs::write(file_path, &json).map_err(|e| format!("Cannot write file: {e}"))?;
            let p_count = bundle.profiles.len();
            let d_count = bundle.devices.len();
            Ok(Some(format!("Exported {p_count} profile(s) and {d_count} device(s)")))
        }
        None => Ok(None),
    }
}

// ── Import result ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ImportResult {
    pub profiles_added: Vec<String>,
    pub profiles_overwritten: Vec<String>,
    pub profiles_renamed: Vec<String>,
    pub devices_added: Vec<String>,
    pub devices_renamed: Vec<String>,
}

// ── Import config (smart detection) ──────────────────────────────────────────

#[command]
pub async fn import_config(app: tauri::AppHandle) -> Result<Option<ImportResult>, String> {
    let open_path = app
        .dialog()
        .file()
        .add_filter("Easix Config", &["esx"])
        .blocking_pick_file();

    let file_path = match open_path {
        Some(p) => p,
        None => return Ok(None),
    };
    let file_path = file_path.as_path().ok_or("Invalid path")?.to_path_buf();
    let content = fs::read_to_string(&file_path).map_err(|e| format!("Cannot read file: {e}"))?;

    let pdir = profiles_dir()?;
    let ddir = devices_dir()?;

    let mut result = ImportResult {
        profiles_added: vec![],
        profiles_overwritten: vec![],
        profiles_renamed: vec![],
        devices_added: vec![],
        devices_renamed: vec![],
    };

    // 1. Try full bundle (version field + profiles/devices)
    if let Ok(bundle) = serde_json::from_str::<ConfigBundle>(&content) {
        if bundle.version >= 1 {
            import_profiles(&app, &pdir, bundle.profiles, &mut result)?;
            import_devices(&ddir, bundle.devices, &mut result)?;
            return Ok(Some(result));
        }
    }

    // 2. Try single Profile
    if let Ok(profile) = serde_json::from_str::<Profile>(&content) {
        let stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("imported")
            .to_string();
        let mut map = HashMap::new();
        map.insert(stem, profile);
        import_profiles(&app, &pdir, map, &mut result)?;
        return Ok(Some(result));
    }

    // 3. Try single Device
    if let Ok(device) = serde_json::from_str::<Device>(&content) {
        import_devices(&ddir, vec![device], &mut result)?;
        return Ok(Some(result));
    }

    Err("Unrecognized format — not a valid profile, device, or config bundle".into())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn import_profiles(
    app: &tauri::AppHandle,
    pdir: &PathBuf,
    profiles: HashMap<String, Profile>,
    result: &mut ImportResult,
) -> Result<(), String> {
    for (name, profile) in profiles {
        let target_path = pdir.join(format!("{name}.json"));

        if target_path.exists() {
            let overwrite = app
                .dialog()
                .message(format!(
                    "Profile \"{name}\" already exists.\n\nClick OK to overwrite, or Cancel to save as a new copy."
                ))
                .title("Import — Profile Conflict")
                .buttons(MessageDialogButtons::OkCancel)
                .blocking_show();

            if overwrite {
                let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
                fs::write(&target_path, json)
                    .map_err(|e| format!("Cannot overwrite '{name}': {e}"))?;
                result.profiles_overwritten.push(name);
            } else {
                let new_name = unique_profile_name(pdir, &name);
                let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
                fs::write(pdir.join(format!("{new_name}.json")), json)
                    .map_err(|e| format!("Cannot save '{new_name}': {e}"))?;
                result.profiles_renamed.push(format!("{name} → {new_name}"));
            }
        } else {
            let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
            fs::write(&target_path, json)
                .map_err(|e| format!("Cannot save '{name}': {e}"))?;
            result.profiles_added.push(name);
        }
    }
    Ok(())
}

fn import_devices(
    ddir: &PathBuf,
    devices: Vec<Device>,
    result: &mut ImportResult,
) -> Result<(), String> {
    let existing_names: Vec<String> = fs::read_dir(ddir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| {
            let path = e.ok()?.path();
            if path.extension()?.to_str()? == "json" {
                let content = fs::read_to_string(&path).ok()?;
                let d: Device = serde_json::from_str(&content).ok()?;
                Some(d.name)
            } else {
                None
            }
        })
        .collect();

    for mut device in devices {
        let original_name = device.name.clone();
        // Always assign a fresh ID to avoid file collisions
        device.id = new_id();

        if existing_names.contains(&original_name) {
            device.name = unique_device_name(&existing_names, &original_name);
            let json = serde_json::to_string_pretty(&device).map_err(|e| e.to_string())?;
            fs::write(ddir.join(format!("{}.json", device.id)), json)
                .map_err(|e| format!("Cannot save device: {e}"))?;
            result.devices_renamed.push(format!("{original_name} → {}", device.name));
        } else {
            let json = serde_json::to_string_pretty(&device).map_err(|e| e.to_string())?;
            fs::write(ddir.join(format!("{}.json", device.id)), json)
                .map_err(|e| format!("Cannot save device: {e}"))?;
            result.devices_added.push(device.name);
        }
    }
    Ok(())
}

fn unique_profile_name(pdir: &PathBuf, stem: &str) -> String {
    let mut n = 1u32;
    loop {
        let candidate = format!("{stem}_{n:02}");
        if !pdir.join(format!("{candidate}.json")).exists() {
            return candidate;
        }
        n += 1;
    }
}

fn unique_device_name(existing: &[String], name: &str) -> String {
    let mut n = 1u32;
    loop {
        let candidate = format!("{name}_{n:02}");
        if !existing.contains(&candidate) {
            return candidate;
        }
        n += 1;
    }
}
