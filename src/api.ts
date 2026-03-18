import { invoke } from "@tauri-apps/api/core";
import { Device, Profile } from "./types";

export const api = {
  listProfiles: () => invoke<string[]>("list_profiles"),

  getProfile: (name: string) => invoke<Profile>("get_profile", { name }),

  saveProfile: (name: string, profile: Profile) =>
    invoke<void>("save_profile", { name, profile }),

  deleteProfile: (name: string) => invoke<void>("delete_profile", { name }),

  duplicateProfile: (source: string, target: string) =>
    invoke<void>("duplicate_profile", { source, target }),

  renameProfile: (oldName: string, newName: string) =>
    invoke<void>("rename_profile", { oldName, newName }),

  generateScript: (profile: Profile) =>
    invoke<string>("generate_script", { profile }),

  validateScript: (profile: Profile) =>
    invoke<string[]>("validate_script", { profile }),

  exportScript: (script: string, defaultName: string) =>
    invoke<string | null>("export_script", { script, defaultName }),

  listDevices: () => invoke<Device[]>("list_devices"),

  saveDevice: (device: Device) => invoke<void>("save_device", { device }),

  deleteDevice: (id: string) => invoke<void>("delete_device", { id }),

  connectDevice: (host: string, port: number, username: string) =>
    invoke<void>("connect_device", { host, port, username }),

  exportProfileEsx: (name: string) =>
    invoke<string | null>("export_profile_esx", { name }),

  importProfileEsx: () => invoke<string | null>("import_profile_esx"),

  dryRunScript: (script: string) =>
    invoke<string>("dry_run_script", { script }),

  deploySsh: (data: {
    profile: Profile;
    host: string;
    port?: number;
    username?: string;
    password?: string;
    keyPath?: string;
  }) =>
    invoke<string>("deploy_ssh", {
      profile: data.profile,
      host: data.host,
      port: data.port ?? 22,
      username: data.username ?? "root",
      password: data.password,
      keyPath: data.keyPath,
    }),
};
