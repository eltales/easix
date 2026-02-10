use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    #[serde(default = "default_os")]
    pub os: String,
    #[serde(default = "default_hostname")]
    pub hostname: String,
    #[serde(default)]
    pub packages: Vec<String>,
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
