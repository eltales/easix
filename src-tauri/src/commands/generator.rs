use tauri::command;
use tauri_plugin_dialog::DialogExt;
use tera::{Context, Tera};

use crate::models::Profile;

const TEMPLATE: &str = include_str!("../../templates/provision.sh.tera");

fn build_tera() -> Result<Tera, String> {
    let mut tera = Tera::default();
    tera.add_raw_template("provision.sh", TEMPLATE)
        .map_err(|e| format!("Template error: {e}"))?;
    Ok(tera)
}

#[command]
pub fn generate_script(profile: Profile) -> Result<String, String> {
    let tera = build_tera()?;
    let mut ctx = Context::new();
    ctx.insert("dis_system", &profile.disabled_sections.contains(&"system".to_string()));
    ctx.insert("dis_packages", &profile.disabled_sections.contains(&"packages".to_string()));
    ctx.insert("dis_user", &profile.disabled_sections.contains(&"user".to_string()));
    ctx.insert("dis_network", &profile.disabled_sections.contains(&"network".to_string()));
    ctx.insert("dis_security", &profile.disabled_sections.contains(&"security".to_string()));
    ctx.insert("dis_autostart", &profile.disabled_sections.contains(&"autostart".to_string()));
    ctx.insert("is_alpine", &(profile.os == "alpine318"));
    ctx.insert("profile", &profile);
    tera.render("provision.sh", &ctx)
        .map_err(|e| format!("Render error: {e}"))
}

#[command]
pub fn validate_script(profile: Profile) -> Result<Vec<String>, String> {
    let script = generate_script(profile)?;
    let mut warnings: Vec<String> = Vec::new();

    for (i, line) in script.lines().enumerate() {
        let trimmed = line.trim();
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
    let path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Shell Script", &["sh"])
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CustomScript, NetworkConfig, Profile, SecurityConfig, SoftwareItem, SystemConfig, UserConfig};

    fn base_profile() -> Profile {
        Profile {
            os: "ubuntu2204".into(),
            hostname: "testbox".into(),
            packages: vec![],
            user: UserConfig { name: "admin".into(), sudo: true },
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
            SoftwareItem { name: "vim".into(), commands: vec!["apt-get install -y vim".into()] },
            SoftwareItem { name: "git".into(), commands: vec!["apt-get install -y git".into()] },
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
            commands: vec!["apk add --quiet vim".into()],
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
            commands: vec!["apt-get install -y vim".into()],
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
}
