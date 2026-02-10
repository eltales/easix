import { invoke } from "@tauri-apps/api/core";
import { Profile } from "./types";

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
