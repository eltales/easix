# summary/backend.md — Easix Backend (Rust)

---

### Stan rzeczywisty — feature-complete
Added: 2026-02-22 | Task: TASK-001..009 done

- Backend w pełni zaimplementowany i kompiluje się bez błędów (`cargo check` OK)
- `models.rs`: Profile {os, hostname, packages, user, network, security, system, autostart, custom_scripts, disabled_sections}
- `commands/profiles.rs`: list_profiles, get_profile, save_profile, delete_profile, duplicate_profile, rename_profile
- `commands/generator.rs`: generate_script (Tera), validate_script (safety checks), export_script (native dialog)
- `commands/deploy.rs`: deploy_ssh (ssh2 crate, password + pubkey_file auth, SCP upload + exec)
- `templates/provision.sh.tera`: pełny szablon Debian/Ubuntu + Alpine 3.18
- `main.rs`: Tauri builder + dialog plugin + shell plugin + wszystkie commands
- Cargo.toml: tauri 2, serde, serde_json, tera, ssh2 (feature-gated), dirs

---

### Modele danych — rzeczywiste
Added: 2026-02-22 | Task: init

- `Profile`: os (String: "ubuntu2204"|"debian11"|"alpine318"), hostname, packages (Vec<String>),
  user (UserConfig), network (NetworkConfig), security (SecurityConfig), system (SystemConfig),
  autostart (Option<String>), custom_scripts (Vec<CustomScript>), disabled_sections (Vec<String>)
- `UserConfig`: name (String), sudo (bool)
- `NetworkConfig`: mode ("dhcp"|"static"), address?, gateway?, dns?
- `SecurityConfig`: ufw (bool), ssh_key (Option<String>)
- `SystemConfig`: locale, timezone, swap_mb?, enable_tpm, grub_timeout?, ntp
- `CustomScript`: name, content, mode ("run_once"|"autostart")
- Profile storage: `~/.config/easix/profiles/<name>.json` przez `dirs::config_dir()`

---

### Generator — kluczowe szczegóły
Added: 2026-02-22 | Task: TASK-003

- Template wbudowany w binary: `include_str!("../../templates/provision.sh.tera")`
- Kontekst Tera: is_alpine (bool), dis_system/packages/user/network/security/autostart (bool per disabled_section), profile (cały struct)
- Sekcje disabled przez `disabled_sections: Vec<String>` w profilu
- Validate_script: sprawdza dangerous patterns (rm -rf /, dd if=, mkfs.) + limit 500 linii
- Export: tauri_plugin_dialog blocking_save_file() z filtrem .sh

---

### SSH Deploy — szczegóły
Added: 2026-02-22 | Task: TASK-009

- Auth: pubkey_file (ścieżka do klucza) ALBO password
- Upload: SCP do `/tmp/easix_provision.sh` (chmod 0o755)
- Exec: `sh /tmp/easix_provision.sh` (bez sudo — zakłada root lub sudo skonfigurowane)
- Output: zbiera stdout + stderr → zwraca jako String do UI
- UWAGA: brak cleanup `/tmp/easix_provision.sh` po wykonaniu — TODO

---
