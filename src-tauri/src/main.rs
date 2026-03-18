// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use commands::{deploy, devices, generator, profiles};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            profiles::list_profiles,
            profiles::get_profile,
            profiles::save_profile,
            profiles::delete_profile,
            profiles::duplicate_profile,
            profiles::rename_profile,
            profiles::export_profile_esx,
            profiles::import_profile_esx,
            generator::generate_script,
            generator::validate_script,
            generator::export_script,
            generator::dry_run_script,
            deploy::deploy_ssh,
            devices::list_devices,
            devices::save_device,
            devices::delete_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
