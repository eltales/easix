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

export interface Profile {
  os: "debian11" | "ubuntu2204";
  hostname: string;
  packages: string[];
  user: UserConfig;
  network: NetworkConfig;
  security: SecurityConfig;
  system: SystemConfig;
  autostart?: string;
  custom_scripts: CustomScript[];
  disabled_sections: string[];
}

export const DEFAULT_PROFILE: Profile = {
  os: "ubuntu2204",
  hostname: "machine01",
  packages: [],
  user: { name: "admin", sudo: true },
  network: { mode: "dhcp" },
  security: { ufw: false },
  system: { locale: "en_US.UTF-8", timezone: "UTC", enable_tpm: false, ntp: true },
  custom_scripts: [],
  disabled_sections: [],
};
