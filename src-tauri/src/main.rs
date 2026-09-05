// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use commands::{config, deploy, devices, discovery, generator, profiles, secrets, settings};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            profiles::list_profiles,
            profiles::get_profile,
            profiles::save_profile,
            profiles::delete_profile,
            profiles::duplicate_profile,
            profiles::rename_profile,
            profiles::export_profile_esx,
            profiles::import_profile_esx,
            profiles::export_all_profiles_esx,
            profiles::import_all_profiles_esx,
            generator::generate_script,
            generator::validate_script,
            generator::export_script,
            generator::dry_run_script,
            deploy::deploy_ssh,
            deploy::cancel_deploy,
            devices::list_devices,
            devices::save_device,
            devices::delete_device,
            devices::connect_device,
            devices::ping_device,
            devices::duplicate_device,
            config::export_config,
            config::import_config,
            secrets::save_device_secret,
            secrets::get_device_secret,
            secrets::delete_device_secret,
            settings::get_settings,
            settings::save_settings,
            discovery::list_network_interfaces,
            discovery::list_device_presets,
            discovery::scan_cidr,
            discovery::scan_hosts,
            discovery::scan_visible,
            discovery::cancel_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
