use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SoftwareItem {
    pub name: String,
    pub commands: Vec<String>,
}

fn deserialize_packages<'de, D>(deserializer: D) -> Result<Vec<SoftwareItem>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let values: Vec<serde_json::Value> = Vec::deserialize(deserializer)?;
    let mut items = Vec::with_capacity(values.len());
    for v in values {
        match v {
            serde_json::Value::String(s) => {
                items.push(SoftwareItem {
                    name: s.clone(),
                    commands: vec![format!("apt-get install -y {}", s)],
                });
            }
            serde_json::Value::Object(_) => {
                let item: SoftwareItem =
                    serde_json::from_value(v).map_err(serde::de::Error::custom)?;
                items.push(item);
            }
            _ => {}
        }
    }
    Ok(items)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    #[serde(default = "default_os")]
    pub os: String,
    #[serde(default = "default_hostname")]
    pub hostname: String,
    #[serde(default, deserialize_with = "deserialize_packages")]
    pub packages: Vec<SoftwareItem>,
    #[serde(default)]
    pub user: UserConfig,
    #[serde(default)]
    pub network: NetworkConfig,
    #[serde(default)]
    pub security: SecurityConfig,
    #[serde(default)]
    pub system: SystemConfig,
    #[serde(default)]
    pub autostart: Option<String>,
    #[serde(default)]
    pub custom_scripts: Vec<CustomScript>,
    #[serde(default)]
    pub disabled_sections: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemConfig {
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub swap_mb: Option<u32>,
    #[serde(default)]
    pub enable_tpm: bool,
    #[serde(default)]
    pub grub_timeout: Option<u32>,
    #[serde(default)]
    pub ntp: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomScript {
    pub name: String,
    pub content: String,
    #[serde(default = "default_run_once")]
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    #[serde(default = "default_username")]
    pub name: String,
    #[serde(default = "default_true")]
    pub sudo: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    #[serde(default = "default_dhcp")]
    pub mode: String,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub gateway: Option<String>,
    #[serde(default)]
    pub dns: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    #[serde(default)]
    pub ufw: bool,
    #[serde(default)]
    pub ssh_key: Option<String>,
}

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            name: "admin".into(),
            sudo: true,
        }
    }
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self {
            mode: "dhcp".into(),
            address: None,
            gateway: None,
            dns: None,
        }
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            ufw: false,
            ssh_key: None,
        }
    }
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            locale: default_locale(),
            timezone: default_timezone(),
            swap_mb: None,
            enable_tpm: false,
            grub_timeout: None,
            ntp: true,
        }
    }
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            os: default_os(),
            hostname: default_hostname(),
            packages: vec![],
            user: UserConfig::default(),
            network: NetworkConfig::default(),
            security: SecurityConfig::default(),
            system: SystemConfig::default(),
            autostart: None,
            custom_scripts: vec![],
            disabled_sections: vec![],
        }
    }
}

fn default_os() -> String { "ubuntu2204".into() }
fn default_run_once() -> String { "run_once".into() }
fn default_hostname() -> String { "machine01".into() }
fn default_username() -> String { "admin".into() }
fn default_dhcp() -> String { "dhcp".into() }
fn default_true() -> bool { true }
fn default_locale() -> String { "en_US.UTF-8".into() }
fn default_timezone() -> String { "UTC".into() }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_profile_serde_roundtrip() {
        let mut profile = Profile::default();
        profile.packages = vec![SoftwareItem {
            name: "vim".into(),
            commands: vec!["apt-get install -y vim".into()],
        }];
        let json = serde_json::to_string(&profile).unwrap();
        let restored: Profile = serde_json::from_str(&json).unwrap();
        assert_eq!(profile.os, restored.os);
        assert_eq!(profile.hostname, restored.hostname);
        assert_eq!(profile.packages, restored.packages);
        assert_eq!(profile.user.name, restored.user.name);
        assert_eq!(profile.network.mode, restored.network.mode);
    }

    #[test]
    fn test_default_profile_values() {
        let p = Profile::default();
        assert_eq!(p.os, "ubuntu2204");
        assert_eq!(p.hostname, "machine01");
        assert_eq!(p.user.name, "admin");
        assert!(p.user.sudo);
        assert_eq!(p.network.mode, "dhcp");
        assert!(!p.security.ufw);
        assert!(p.system.ntp);
        assert!(!p.system.enable_tpm);
        assert!(p.packages.is_empty());
        assert!(p.custom_scripts.is_empty());
        assert!(p.disabled_sections.is_empty());
    }

    #[test]
    fn test_partial_json_uses_serde_defaults() {
        let json = r#"{"os":"debian11","hostname":"mybox"}"#;
        let p: Profile = serde_json::from_str(json).unwrap();
        assert_eq!(p.hostname, "mybox");
        assert_eq!(p.os, "debian11");
        assert!(p.packages.is_empty());
        assert_eq!(p.user.name, "admin");
        assert_eq!(p.network.mode, "dhcp");
    }

    #[test]
    fn test_packages_fallback_deserializes_old_string_format() {
        let json = r#"{"packages": ["vim", "git"]}"#;
        let p: Profile = serde_json::from_str(json).unwrap();
        assert_eq!(p.packages.len(), 2);
        assert_eq!(p.packages[0].name, "vim");
        assert!(p.packages[0].commands[0].contains("vim"));
        assert_eq!(p.packages[1].name, "git");
    }

    #[test]
    fn test_packages_deserializes_new_software_item_format() {
        let json = r#"{"packages": [{"name": "Docker", "commands": ["curl -fsSL https://get.docker.com | sh", "systemctl enable docker"]}]}"#;
        let p: Profile = serde_json::from_str(json).unwrap();
        assert_eq!(p.packages.len(), 1);
        assert_eq!(p.packages[0].name, "Docker");
        assert_eq!(p.packages[0].commands.len(), 2);
    }

    #[test]
    fn test_network_config_default_is_dhcp() {
        let nc = NetworkConfig::default();
        assert_eq!(nc.mode, "dhcp");
        assert!(nc.address.is_none());
        assert!(nc.gateway.is_none());
        assert!(nc.dns.is_none());
    }

    #[test]
    fn test_custom_script_serde_roundtrip() {
        let script = CustomScript {
            name: "setup".into(),
            content: "#!/bin/bash\necho hi".into(),
            mode: "run_once".into(),
        };
        let json = serde_json::to_string(&script).unwrap();
        let restored: CustomScript = serde_json::from_str(&json).unwrap();
        assert_eq!(script.name, restored.name);
        assert_eq!(script.content, restored.content);
        assert_eq!(script.mode, restored.mode);
    }

    #[test]
    fn test_security_config_default() {
        let sc = SecurityConfig::default();
        assert!(!sc.ufw);
        assert!(sc.ssh_key.is_none());
    }
}
