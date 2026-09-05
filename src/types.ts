export interface ImportResult {
  profiles_added: string[];
  profiles_overwritten: string[];
  profiles_renamed: string[];
  devices_added: string[];
  devices_renamed: string[];
}

export interface UserConfig {
  name: string;
  sudo: boolean;
  /** Windows only: initial password for the new local user. Falls back to a generic placeholder when unset. */
  initial_password?: string;
}

export interface NetworkConfig {
  mode: "dhcp" | "static";
  address?: string;
  gateway?: string;
  dns?: string;
}

export interface SecurityConfig {
  firewall: "default" | "enabled" | "disabled";
  ssh_key?: string;
}

export interface CustomScript {
  name: string;
  content: string;
  mode: "run_once" | "autostart";
}

export interface SystemConfig {
  locale: string;
  timezone: string;
  swap_mb?: number;
  enable_tpm: boolean;
  grub_timeout?: number;
  ntp: boolean;
}

export type TaskType = "package" | "service" | "user" | "file" | "command";

export interface SoftwareItem {
  name: string;
  task_type: TaskType;
  commands: string[];
  check_cmd?: string;
}

export interface Device {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: "password" | "key";
  key_path?: string;
  group?: string;
  tags: string[];
  description?: string;
  color?: string;
  os?: string;
  last_connected?: string;
}

export interface NetworkInterface {
  name: string;
  ip: string;
  prefix_len: number;
  cidr: string;
}

export interface DevicePreset {
  name: string;
  ips: string[];
}

export interface DiscoveredHost {
  ip: string;
  mac?: string;
  vendor?: string;
  open_ports: number[];
  hostname?: string;
}

export interface Profile {
  os: "none" | "debian11" | "ubuntu2204" | "ubuntu2404" | "alpine318" | "windows2019" | "windows2022" | "windows11" | "windows10";
  hostname: string;
  packages: SoftwareItem[];
  user: UserConfig;
  network: NetworkConfig;
  security: SecurityConfig;
  system: SystemConfig;
  autostart?: string;
  custom_scripts: CustomScript[];
  disabled_sections: string[];
}

export interface AppSettings {
  default_ssh_port: number;
  default_username: string;
  connect_timeout_secs: number;
  default_os: Profile["os"];
  history_limit: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  default_ssh_port: 22,
  default_username: "root",
  connect_timeout_secs: 10,
  default_os: "ubuntu2404",
  history_limit: 50,
};

export const OS_OPTIONS: { value: Profile["os"]; label: string }[] = [
  { value: "ubuntu2404", label: "Ubuntu 24.04" },
  { value: "ubuntu2204", label: "Ubuntu 22.04" },
  { value: "debian11", label: "Debian 11" },
  { value: "alpine318", label: "Alpine 3.18" },
  { value: "windows2022", label: "Windows Server 2022" },
  { value: "windows2019", label: "Windows Server 2019" },
  { value: "windows11", label: "Windows 11 Pro" },
  { value: "windows10", label: "Windows 10 Pro" },
];

export const DEFAULT_PROFILE: Profile = {
  os: "ubuntu2404",
  hostname: "",
  packages: [],
  user: { name: "admin", sudo: true },
  network: { mode: "dhcp" },
  security: { firewall: "default" },
  system: { locale: "", timezone: "", enable_tpm: false, ntp: false },
  custom_scripts: [],
  disabled_sections: [],
};
