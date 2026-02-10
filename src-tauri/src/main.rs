#![cfg_attr(
    all(not(debug_assertions), target_os = "linux"),
    windows_subsystem = "windows"
)]

mod commands;
mod models;

use commands::{deploy, generator, profiles};

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
            generator::generate_script,
            generator::validate_script,
            generator::export_script,
            deploy::deploy_ssh,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
