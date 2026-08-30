use std::io::Write;
use tauri::command;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use tera::{Context, Tera};

use crate::models::Profile;

const TEMPLATE_SH:  &str = include_str!("../../templates/provision.sh.tera");
const TEMPLATE_PS1: &str = include_str!("../../templates/provision.ps1.tera");
const DRYRUN_CHECK_PS1: &str = include_str!("../../templates/dryrun_check.ps1");

fn is_no_os(os: &str) -> bool {
    os == "none"
}

/// Converts a Unix-style locale tag ("pl_PL.UTF-8") into a Windows culture
/// name ("pl-PL"), or None for an empty/unset locale.
fn windows_locale_tag(locale: &str) -> Option<String> {
    let base = locale.split('.').next().unwrap_or(locale);
    if base.is_empty() {
        None
    } else {
        Some(base.replace('_', "-"))
    }
}

fn build_tera(windows: bool) -> Result<(Tera, &'static str), String> {
    let mut tera = Tera::default();
    if windows {
        tera.add_raw_template("provision.ps1", TEMPLATE_PS1)
            .map_err(|e| format!("Template error: {e}"))?;
        Ok((tera, "provision.ps1"))
    } else {
        tera.add_raw_template("provision.sh", TEMPLATE_SH)
            .map_err(|e| format!("Template error: {e}"))?;
        Ok((tera, "provision.sh"))
    }
}

#[command]
pub fn generate_script(profile: Profile) -> Result<String, String> {
    if is_no_os(&profile.os) {
        return Err("No OS selected. Please choose a target operating system in the System tab.".into());
    }
    let win = profile.is_windows();
    let (tera, tpl) = build_tera(win)?;
    let win_locale_tag = if win { windows_locale_tag(&profile.system.locale) } else { None };
    let mut ctx = Context::new();
    ctx.insert("dis_system",   &profile.disabled_sections.contains(&"system".to_string()));
    ctx.insert("dis_packages", &profile.disabled_sections.contains(&"packages".to_string()));
    ctx.insert("dis_user",     &profile.disabled_sections.contains(&"user".to_string()));
    ctx.insert("dis_network",  &profile.disabled_sections.contains(&"network".to_string()));
    ctx.insert("dis_security", &profile.disabled_sections.contains(&"security".to_string()));
    ctx.insert("dis_autostart",&profile.disabled_sections.contains(&"autostart".to_string()));
    ctx.insert("is_alpine",    &(profile.os == "alpine318"));
    ctx.insert("is_windows",   &win);
    ctx.insert("win_locale_tag", &win_locale_tag);
    ctx.insert("profile",      &profile);
    tera.render(tpl, &ctx)
        .map_err(|e| format!("Render error: {e}"))
}

fn validate_unix_line(i: usize, trimmed: &str, warnings: &mut Vec<String>) {
    if trimmed.contains("rm -rf /") && !trimmed.starts_with('#') {
        warnings.push(format!("Line {}: dangerous 'rm -rf /' detected", i + 1));
    }
    if trimmed.contains("> /dev/sda") {
        warnings.push(format!("Line {}: writing directly to block device", i + 1));
    }
    if trimmed.contains("mkfs.") && !trimmed.starts_with('#') {
        warnings.push(format!("Line {}: filesystem format command detected", i + 1));
    }
    if trimmed.contains("dd if=") && !trimmed.starts_with('#') {
        warnings.push(format!("Line {}: 'dd' command detected — verify target", i + 1));
    }
}

fn validate_windows_line(i: usize, trimmed: &str, warnings: &mut Vec<String>) {
    let targets_system_drive = trimmed.contains("C:\\") || trimmed.contains("C:/");
    if trimmed.contains("Remove-Item")
        && (trimmed.contains("-Recurse") || trimmed.contains("-Force"))
        && targets_system_drive
    {
        warnings.push(format!(
            "Line {}: recursive/forced deletion targeting C:\\ detected",
            i + 1
        ));
    }
    if trimmed.contains("Format-Volume") || trimmed.contains("Clear-Disk") {
        warnings.push(format!("Line {}: disk formatting/wiping command detected", i + 1));
    }
    if trimmed.contains("diskpart") {
        warnings.push(format!("Line {}: 'diskpart' command detected — verify target", i + 1));
    }
    if trimmed.contains("Set-ExecutionPolicy") && trimmed.contains("Unrestricted") {
        warnings.push(format!(
            "Line {}: sets an unrestricted PowerShell execution policy",
            i + 1
        ));
    }
}

#[command]
pub fn validate_script(profile: Profile) -> Result<Vec<String>, String> {
    let is_windows = profile.is_windows();
    let script = generate_script(profile)?;
    let mut warnings: Vec<String> = Vec::new();

    for (i, line) in script.lines().enumerate() {
        let trimmed = line.trim();
        if is_windows {
            validate_windows_line(i, trimmed, &mut warnings);
        } else {
            validate_unix_line(i, trimmed, &mut warnings);
        }
    }

    if script.lines().count() > 500 {
        warnings.push("Script exceeds 500 lines — consider splitting".into());
    }

    Ok(warnings)
}

#[command]
pub async fn export_script(
    app: tauri::AppHandle,
    script: String,
    default_name: String,
) -> Result<Option<String>, String> {
    let is_ps1 = default_name.ends_with(".ps1");
    let (filter_name, ext) = if is_ps1 {
        ("PowerShell Script", "ps1")
    } else {
        ("Shell Script", "sh")
    };
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(filter_name, &[ext])
        .blocking_save_file();

    match path {
        Some(p) => {
            let file_path = p.as_path().ok_or("Invalid path")?;
            std::fs::write(file_path, &script)
                .map_err(|e| format!("Cannot write file: {e}"))?;
            Ok(Some(file_path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

/// Windows-generated scripts start with "#Requires"/no shebang; Unix scripts
/// always start with a "#!" shebang line.
fn is_windows_script(script: &str) -> bool {
    !script.trim_start().starts_with("#!")
}

#[command]
pub async fn dry_run_script(app: tauri::AppHandle, script: String) -> Result<String, String> {
    if is_windows_script(&script) {
        return dry_run_windows_script(app, &script).await;
    }

    // Write script to a temp file
    let tmp_path = std::env::temp_dir().join("easix_dryrun.sh");
    {
        let mut f = std::fs::File::create(&tmp_path)
            .map_err(|e| format!("Cannot create temp file: {e}"))?;
        f.write_all(script.as_bytes())
            .map_err(|e| format!("Cannot write temp file: {e}"))?;
    }

    let output = app
        .shell()
        .command("shellcheck")
        .args(["--severity=warning", "--format=tty", tmp_path.to_str().unwrap_or("/tmp/easix_dryrun.sh")])
        .output()
        .await
        .map_err(|e| format!("shellcheck not found or failed to run: {e}\n\nInstall with: apt-get install shellcheck"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok("shellcheck: no issues found".to_string())
    } else if !stdout.is_empty() {
        Ok(stdout)
    } else {
        Ok(stderr)
    }
}

async fn dry_run_windows_script(app: tauri::AppHandle, script: &str) -> Result<String, String> {
    let tmp_path = std::env::temp_dir().join("easix_dryrun.ps1");
    std::fs::write(&tmp_path, script).map_err(|e| format!("Cannot write temp file: {e}"))?;

    let checker_path = std::env::temp_dir().join("easix_dryrun_check.ps1");
    std::fs::write(&checker_path, DRYRUN_CHECK_PS1)
        .map_err(|e| format!("Cannot write checker file: {e}"))?;

    let output = app
        .shell()
        .command("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            checker_path.to_str().unwrap_or_default(),
            "-ScriptPath",
            tmp_path.to_str().unwrap_or_default(),
        ])
        .output()
        .await
        .map_err(|e| format!("powershell.exe not found or failed to run: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !stdout.is_empty() {
        Ok(stdout)
    } else if !stderr.is_empty() {
        Ok(stderr)
    } else {
        Ok("OK: no syntax errors found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CustomScript, NetworkConfig, Profile, SecurityConfig, SoftwareItem, SystemConfig, UserConfig};

    fn base_profile() -> Profile {
        Profile {
            os: "ubuntu2204".into(),
            hostname: "testbox".into(),
            packages: vec![],
            user: UserConfig { name: "admin".into(), sudo: true, initial_password: None },
            network: NetworkConfig { mode: "dhcp".into(), address: None, gateway: None, dns: None },
            security: SecurityConfig { ufw: false, ssh_key: None },
            system: SystemConfig {
                locale: "en_US.UTF-8".into(),
                timezone: "UTC".into(),
                swap_mb: None,
                enable_tpm: false,
                grub_timeout: None,
                ntp: false,
            },
            autostart: None,
            custom_scripts: vec![],
            disabled_sections: vec![],
        }
    }

    #[test]
    fn test_generate_contains_hostname() {
        let script = generate_script(base_profile()).unwrap();
        assert!(script.contains("hostnamectl set-hostname \"testbox\""));
    }

    #[test]
    fn test_generate_with_packages_contains_commands() {
        let mut p = base_profile();
        p.packages = vec![
            SoftwareItem { name: "vim".into(), task_type: "package".into(), commands: vec!["apt-get install -y vim".into()], check_cmd: None },
            SoftwareItem { name: "git".into(), task_type: "package".into(), commands: vec!["apt-get install -y git".into()], check_cmd: None },
        ];
        let script = generate_script(p).unwrap();
        assert!(script.contains("apt-get install -y vim"));
        assert!(script.contains("apt-get install -y git"));
        assert!(script.contains("vim"));
        assert!(script.contains("git"));
    }

    #[test]
    fn test_generate_empty_packages_skips_install() {
        let script = generate_script(base_profile()).unwrap();
        assert!(!script.contains("apt-get install -y vim"));
    }

    #[test]
    fn test_generate_multistep_package_all_commands_present() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "Docker".into(),
            task_type: "package".into(),
            check_cmd: Some("command -v docker".into()),
            commands: vec![
                "apt-get install -y ca-certificates curl gnupg".into(),
                "curl -fsSL https://get.docker.com | sh".into(),
                "systemctl enable docker".into(),
            ],
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("ca-certificates"));
        assert!(script.contains("get.docker.com"));
        assert!(script.contains("systemctl enable docker"));
        assert!(script.contains("[ERROR] Docker"));
    }

    #[test]
    fn test_generate_static_network_writes_netplan() {
        let mut p = base_profile();
        p.network.mode = "static".into();
        p.network.address = Some("192.168.1.10/24".into());
        p.network.gateway = Some("192.168.1.1".into());
        let script = generate_script(p).unwrap();
        assert!(script.contains("netplan"));
        assert!(script.contains("192.168.1.10/24"));
        assert!(script.contains("192.168.1.1"));
    }

    #[test]
    fn test_generate_dhcp_no_netplan() {
        let script = generate_script(base_profile()).unwrap();
        assert!(!script.contains("netplan"));
    }

    #[test]
    fn test_generate_user_section_creates_user() {
        let script = generate_script(base_profile()).unwrap();
        assert!(script.contains("useradd"));
        assert!(script.contains("admin"));
    }

    #[test]
    fn test_generate_sudo_adds_usermod() {
        let script = generate_script(base_profile()).unwrap();
        assert!(script.contains("usermod") && script.contains("sudo"));
    }

    #[test]
    fn test_generate_alpine_package_uses_user_commands() {
        let mut p = base_profile();
        p.os = "alpine318".into();
        p.packages = vec![SoftwareItem {
            name: "vim".into(),
            task_type: "package".into(),
            commands: vec!["apk add --quiet vim".into()],
            check_cmd: None,
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("apk add --quiet vim"));
        assert!(!script.contains("apt-get install"));
    }

    #[test]
    fn test_generate_disabled_packages_skips_install() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "vim".into(),
            task_type: "package".into(),
            commands: vec!["apt-get install -y vim".into()],
            check_cmd: None,
        }];
        p.disabled_sections = vec!["packages".into()];
        let script = generate_script(p).unwrap();
        assert!(!script.contains("apt-get install -y vim"));
    }

    #[test]
    fn test_generate_disabled_user_skips_useradd() {
        let mut p = base_profile();
        p.disabled_sections = vec!["user".into()];
        let script = generate_script(p).unwrap();
        assert!(!script.contains("useradd"));
    }

    #[test]
    fn test_generate_custom_script_run_once_included() {
        let mut p = base_profile();
        p.custom_scripts = vec![CustomScript {
            name: "setup-db".into(),
            content: "echo hello_from_db".into(),
            mode: "run_once".into(),
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("setup-db"));
        assert!(script.contains("echo hello_from_db"));
    }

    #[test]
    fn test_generate_ntp_enabled_calls_timedatectl() {
        let mut p = base_profile();
        p.system.ntp = true;
        let script = generate_script(p).unwrap();
        assert!(script.contains("timedatectl set-ntp"));
    }

    #[test]
    fn test_generate_swap_creates_swapfile() {
        let mut p = base_profile();
        p.system.swap_mb = Some(2048);
        let script = generate_script(p).unwrap();
        assert!(script.contains("swapfile"));
        assert!(script.contains("2048"));
    }

    #[test]
    fn test_generate_ufw_enabled() {
        let mut p = base_profile();
        p.security.ufw = true;
        let script = generate_script(p).unwrap();
        assert!(script.contains("ufw"));
    }

    #[test]
    fn test_validate_safe_profile_no_warnings() {
        let warnings = validate_script(base_profile()).unwrap();
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
    }

    #[test]
    fn test_validate_detects_rm_rf_slash() {
        let mut p = base_profile();
        p.custom_scripts = vec![CustomScript {
            name: "danger".into(),
            content: "rm -rf /".into(),
            mode: "run_once".into(),
        }];
        let warnings = validate_script(p).unwrap();
        assert!(!warnings.is_empty());
        assert!(warnings.iter().any(|w| w.contains("rm -rf /")));
    }

    #[test]
    fn test_generate_returns_shebang_for_ubuntu() {
        let script = generate_script(base_profile()).unwrap();
        assert!(script.contains("#!/usr/bin/env bash"));
    }

    #[test]
    fn test_generate_returns_sh_shebang_for_alpine() {
        let mut p = base_profile();
        p.os = "alpine318".into();
        let script = generate_script(p).unwrap();
        assert!(script.contains("#!/bin/sh"), "Alpine script should use #!/bin/sh");
        assert!(!script.contains("#!/usr/bin/env bash"), "Alpine script should not use bash shebang");
    }

    #[test]
    fn test_generate_windows_returns_powershell() {
        let mut p = base_profile();
        p.os = "windows2022".into();
        let script = generate_script(p).unwrap();
        assert!(script.contains("#Requires -Version 5.1"), "Windows should generate PowerShell");
        assert!(script.contains("Write-Host"), "Windows script should use Write-Host");
        assert!(!script.contains("#!/"), "Windows script should not have bash shebang");
    }

    #[test]
    fn test_generate_windows_package_idempotent() {
        let mut p = base_profile();
        p.os = "windows2022".into();
        p.packages = vec![SoftwareItem {
            name: "git".into(),
            task_type: "package".into(),
            commands: vec!["winget install --id Git.Git -e --silent".into()],
            check_cmd: None,
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("winget install --id Git.Git"));
        assert!(script.contains("Get-Command"));
        assert!(script.contains("_easixSkip"));
    }

    #[test]
    fn test_generate_windows11_default_password_when_unset() {
        let script = generate_script(windows11_profile()).unwrap();
        assert!(script.contains("ChangeMe123!"));
    }

    #[test]
    fn test_generate_windows11_custom_initial_password() {
        let mut p = windows11_profile();
        p.user.initial_password = Some("Sup3rSecret!42".into());
        let script = generate_script(p).unwrap();
        assert!(script.contains("Sup3rSecret!42"));
        assert!(!script.contains("ChangeMe123!"));
    }

    fn windows11_profile() -> Profile {
        let mut p = base_profile();
        p.os = "windows11".into();
        p
    }

    #[test]
    fn test_generate_windows11_locale_is_mapped_and_set() {
        let mut p = windows11_profile();
        p.system.locale = "pl_PL.UTF-8".into();
        let script = generate_script(p).unwrap();
        assert!(script.contains("Set-WinSystemLocale -SystemLocale \"pl-PL\""));
        assert!(script.contains("Set-WinUserLanguageList -LanguageList \"pl-PL\""));
    }

    #[test]
    fn test_generate_windows11_no_locale_skips_locale_block() {
        let mut p = windows11_profile();
        p.system.locale = "".into();
        let script = generate_script(p).unwrap();
        assert!(!script.contains("Set-WinSystemLocale"));
    }

    #[test]
    fn test_generate_windows11_swap_configures_pagefile() {
        let mut p = windows11_profile();
        p.system.swap_mb = Some(4096);
        let script = generate_script(p).unwrap();
        assert!(script.contains("Win32_PageFileSetting"));
        assert!(script.contains("4096"));
    }

    #[test]
    fn test_generate_windows11_no_swap_skips_pagefile() {
        let script = generate_script(windows11_profile()).unwrap();
        assert!(!script.contains("Win32_PageFileSetting"));
    }

    #[test]
    fn test_generate_windows11_tpm_check_present() {
        let mut p = windows11_profile();
        p.system.enable_tpm = true;
        let script = generate_script(p).unwrap();
        assert!(script.contains("Get-Tpm"));
        assert!(script.contains("required for Windows 11"));
    }

    #[test]
    fn test_generate_windows11_static_network() {
        let mut p = windows11_profile();
        p.network.mode = "static".into();
        p.network.address = Some("192.168.1.50/24".into());
        p.network.gateway = Some("192.168.1.1".into());
        p.network.dns = Some("8.8.8.8".into());
        let script = generate_script(p).unwrap();
        assert!(script.contains("New-NetIPAddress"));
        assert!(script.contains("192.168.1.50/24"));
        assert!(script.contains("-DefaultGateway \"192.168.1.1\""));
        assert!(script.contains("Set-DnsClientServerAddress"));
    }

    #[test]
    fn test_generate_windows11_dhcp_skips_static_network() {
        let script = generate_script(windows11_profile()).unwrap();
        assert!(!script.contains("New-NetIPAddress"));
    }

    #[test]
    fn test_generate_windows11_firewall_default_deny() {
        let mut p = windows11_profile();
        p.security.ufw = true;
        let script = generate_script(p).unwrap();
        assert!(script.contains("-DefaultInboundAction Block"));
        assert!(script.contains("New-NetFirewallRule"));
        assert!(script.contains("LocalPort 22"));
    }

    #[test]
    fn test_generate_windows11_ssh_key_admin_uses_administrators_file() {
        let mut p = windows11_profile();
        p.user.sudo = true;
        p.security.ssh_key = Some("ssh-ed25519 AAAA...".into());
        let script = generate_script(p).unwrap();
        assert!(script.contains("administrators_authorized_keys"));
        assert!(script.contains("icacls"));
        assert!(!script.contains("C:\\Users\\admin\\.ssh\\authorized_keys"));
    }

    #[test]
    fn test_generate_windows11_ssh_key_non_admin_uses_user_profile() {
        let mut p = windows11_profile();
        p.user.sudo = false;
        p.security.ssh_key = Some("ssh-ed25519 AAAA...".into());
        let script = generate_script(p).unwrap();
        assert!(script.contains("C:\\Users\\admin\\.ssh"));
        assert!(!script.contains("administrators_authorized_keys"));
    }

    #[test]
    fn test_validate_windows11_detects_recursive_delete_of_c_drive() {
        let mut p = windows11_profile();
        p.custom_scripts = vec![CustomScript {
            name: "danger".into(),
            content: "Remove-Item -Recurse -Force C:\\".into(),
            mode: "run_once".into(),
        }];
        let warnings = validate_script(p).unwrap();
        assert!(warnings.iter().any(|w| w.contains("C:\\")));
    }

    #[test]
    fn test_validate_windows11_safe_profile_no_warnings() {
        let warnings = validate_script(windows11_profile()).unwrap();
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
    }

    #[test]
    fn test_validate_windows11_unix_patterns_are_not_checked() {
        // A Windows script never contains "rm -rf /", so the Unix-only checks
        // must not spuriously fire on Windows scripts (and vice versa).
        let mut p = windows11_profile();
        p.custom_scripts = vec![CustomScript {
            name: "note".into(),
            content: "Write-Host 'rm -rf / is just a string here'".into(),
            mode: "run_once".into(),
        }];
        let warnings = validate_script(p).unwrap();
        assert!(warnings.is_empty(), "unexpected warnings: {warnings:?}");
    }

    #[test]
    fn test_generate_linux_package_idempotent_dpkg_check() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "nginx".into(),
            task_type: "package".into(),
            commands: vec!["apt-get install -y nginx".into()],
            check_cmd: None,
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("dpkg -l"));
        assert!(script.contains("_easix_skip"));
        assert!(script.contains("[SKIP]"));
    }

    #[test]
    fn test_generate_linux_custom_check_cmd_overrides_default() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "Docker".into(),
            task_type: "package".into(),
            commands: vec!["curl -fsSL https://get.docker.com | sh".into()],
            check_cmd: Some("command -v docker".into()),
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("command -v docker"));
        assert!(!script.contains("dpkg -l"));
    }

    #[test]
    fn test_generate_linux_service_check() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "nginx".into(),
            task_type: "service".into(),
            commands: vec!["systemctl start nginx".into()],
            check_cmd: None,
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("systemctl is-active"));
    }

    #[test]
    fn test_generate_linux_user_check() {
        let mut p = base_profile();
        p.packages = vec![SoftwareItem {
            name: "deploy".into(),
            task_type: "user".into(),
            commands: vec!["useradd -m deploy".into()],
            check_cmd: None,
        }];
        let script = generate_script(p).unwrap();
        assert!(script.contains("id \"deploy\""));
    }
}
