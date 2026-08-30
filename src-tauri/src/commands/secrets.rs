use keyring::Entry;
use tauri::command;

const SERVICE: &str = "easix";

fn entry(device_id: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, device_id).map_err(|e| e.to_string())
}

/// Saves a device's SSH password to the OS-native credential store
/// (Windows Credential Manager, macOS Keychain, or the Secret Service on
/// Linux) instead of the plain-JSON device file.
#[command]
pub fn save_device_secret(device_id: String, password: String) -> Result<(), String> {
    entry(&device_id)?
        .set_password(&password)
        .map_err(|e| e.to_string())
}

#[command]
pub fn get_device_secret(device_id: String) -> Result<Option<String>, String> {
    match entry(&device_id)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub fn delete_device_secret(device_id: String) -> Result<(), String> {
    match entry(&device_id)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
