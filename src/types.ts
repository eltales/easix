export interface UserConfig {
  name: string;
  sudo: boolean;
}

export interface NetworkConfig {
  mode: "dhcp" | "static";
  address?: string;
  gateway?: string;
  dns?: string;
}

export interface SecurityConfig {
  ufw: boolean;
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

export const DEFAULT_PROFILE: Profile = {
  os: "ubuntu2404",
  hostname: "",
  packages: [],
  user: { name: "admin", sudo: true },
  network: { mode: "dhcp" },
  security: { ufw: false },
  system: { locale: "", timezone: "", enable_tpm: false, ntp: false },
  custom_scripts: [],
  disabled_sections: [],
};
