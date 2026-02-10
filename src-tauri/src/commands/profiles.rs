use std::fs;
use std::path::PathBuf;
use tauri::command;

use crate::models::Profile;

fn profiles_dir() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Cannot resolve config directory")?;
    let dir = base.join("easix").join("profiles");
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create profiles dir: {e}"))?;
    Ok(dir)
}

#[command]
pub fn list_profiles() -> Result<Vec<String>, String> {
    let dir = profiles_dir()?;
    let mut names: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.extension()?.to_str()? == "json" {
                Some(path.file_stem()?.to_str()?.to_string())
            } else {
                None
            }
        })
        .collect();
    names.sort();
    Ok(names)
}

#[command]
pub fn get_profile(name: String) -> Result<Profile, String> {
    let dir = profiles_dir()?;
    let path = dir.join(format!("{name}.json"));
    if !path.exists() {
        return Err(format!("Profile '{name}' not found"));
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("Invalid profile JSON: {e}"))
}

#[command]
pub fn save_profile(name: String, profile: Profile) -> Result<(), String> {
    let dir = profiles_dir()?;
    let path = dir.join(format!("{name}.json"));
    let json = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Cannot write profile: {e}"))
}

#[command]
pub fn delete_profile(name: String) -> Result<(), String> {
    let dir = profiles_dir()?;
    let path = dir.join(format!("{name}.json"));
    if !path.exists() {
        return Err(format!("Profile '{name}' not found"));
    }
    fs::remove_file(&path).map_err(|e| format!("Cannot delete profile: {e}"))
}

#[command]
pub fn duplicate_profile(source: String, target: String) -> Result<(), String> {
    let dir = profiles_dir()?;
    let src_path = dir.join(format!("{source}.json"));
    let dst_path = dir.join(format!("{target}.json"));
    if !src_path.exists() {
        return Err(format!("Profile '{source}' not found"));
    }
    if dst_path.exists() {
        return Err(format!("Profile '{target}' already exists"));
    }
    fs::copy(&src_path, &dst_path).map_err(|e| format!("Cannot duplicate: {e}"))?;
    Ok(())
}

#[command]
pub fn rename_profile(old_name: String, new_name: String) -> Result<(), String> {
    let dir = profiles_dir()?;
    let old_path = dir.join(format!("{old_name}.json"));
    let new_path = dir.join(format!("{new_name}.json"));
    if !old_path.exists() {
        return Err(format!("Profile '{old_name}' not found"));
    }
    if new_path.exists() {
        return Err(format!("Profile '{new_name}' already exists"));
    }
    fs::rename(&old_path, &new_path).map_err(|e| format!("Cannot rename: {e}"))
}
