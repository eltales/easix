# Architecture — Easix

*Ostatnia aktualizacja: 2026-02-22*

---

## 1. Przegląd

Easix to aplikacja desktopowa oparta na **Tauri 2** z frontendem **React** i backendem **Rust**. Działa w pełni offline, bez serwera HTTP.

```
┌─────────────────────────────────────┐
│          Tauri Window               │
│  ┌───────────────────────────────┐  │
│  │     React UI (webview)        │  │
│  │                               │  │
│  │  invoke("save_profile", ...)  │  │
│  │  invoke("generate_script",..) │  │
│  │  invoke("deploy_ssh", ...)    │  │
│  └──────────┬────────────────────┘  │
│             │ Tauri IPC             │
│  ┌──────────▼────────────────────┐  │
│  │     Rust Backend              │  │
│  │                               │  │
│  │  • Profile CRUD (serde_json)  │  │
│  │  • Script generator (tera)    │  │
│  │  • SSH deploy (ssh2 crate)    │  │
│  │  • File export (native dialog)│  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 2. Stack technologiczny

| Warstwa | Technologia | Uzasadnienie |
|---------|-------------|--------------|
| Desktop framework | Tauri 2.x | Mały instalator (~15MB), natywny webview, cross-platform |
| UI | React 18 + TypeScript | Komponent-based, silny ekosystem |
| Styling | Tailwind CSS 3 | Szybki development, brak konfiguracji CSS |
| Backend logika | Rust (Tauri commands) | Bezpieczeństwo, wydajność, natywny dostęp SSH/FS |
| Szablony | Rust Tera | Kompatybilny z Jinja2 składniowo, bez dependency na Python |
| SSH | Rust ssh2 crate | Natywna biblioteka, brak zewnętrznych procesów |
| Profile storage | JSON pliki na dysku | Prostota, czytelność, brak konfiguracji DB |
| Routing (React) | react-router-dom 6 | Standard w ekosystemie React |

---

## 3. Struktura projektu

```
easix/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs               # Entry point + Tauri builder
│   │   ├── models.rs             # Struktury danych (Profile, NetworkConfig, etc.)
│   │   ├── templates.rs          # Ładowanie szablonów Tera
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── profiles.rs       # CRUD profili
│   │       ├── generator.rs      # Generowanie skryptu + eksport
│   │       └── deploy.rs         # SSH deploy
│   └── templates/
│       └── provision.sh.tera     # Szablon bash skryptu
├── src/                          # React frontend
│   ├── main.tsx
│   ├── App.tsx                   # Routing
│   ├── api.ts                    # Tauri invoke() wrappers
│   ├── types.ts                  # TypeScript typy (mirror Rust models)
│   ├── index.css
│   ├── components/
│   │   └── Layout.tsx            # Sidebar + Outlet
│   └── pages/
│       ├── Dashboard.tsx         # Lista profili
│       ├── Editor.tsx            # Tworzenie/edycja profilu
│       ├── Preview.tsx           # Podgląd wygenerowanego skryptu
│       └── Deploy.tsx            # SSH deploy
├── index.html
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 4. Tauri Commands (IPC API)

| Command | Argumenty | Zwraca | Opis |
|---------|-----------|--------|------|
| `list_profiles` | — | `Vec<String>` | Lista nazw profili |
| `get_profile` | `name: String` | `Profile` | Pobierz profil po nazwie |
| `save_profile` | `name: String, profile: Profile` | `()` | Zapisz/nadpisz profil |
| `delete_profile` | `name: String` | `()` | Usuń profil |
| `generate_script` | `profile: Profile` | `String` | Wygeneruj bash script z Tera |
| `export_script` | `script: String, default_name: String` | `Option<String>` | Natywny dialog "Zapisz jako..." |
| `deploy_ssh` | `host, port, user, auth, script: String` | `DeployResult` | Upload + execute przez SSH |

---

## 5. Model danych

### Profile (Rust)

```rust
pub struct Profile {
    pub name: String,
    pub hostname: String,
    pub distro: Distro,          // Debian11 | Ubuntu2204 | Ubuntu2404
    pub packages: Vec<String>,
    pub users: Vec<UserConfig>,
    pub network: NetworkConfig,
    pub custom_scripts: Vec<CustomScript>,
}

pub struct UserConfig {
    pub username: String,
    pub groups: Vec<String>,     // ["sudo", "docker"]
    pub create_if_missing: bool,
}

pub struct NetworkConfig {
    pub mode: NetworkMode,       // Dhcp | Static(StaticConfig)
}

pub struct StaticConfig {
    pub address: String,         // "192.168.1.10/24"
    pub gateway: String,
    pub dns: Vec<String>,
    pub interface: String,       // "eth0"
}

pub struct CustomScript {
    pub name: String,
    pub content: String,
    pub run_as: RunAs,           // Root | User(String)
    pub timing: ScriptTiming,   // RunOnce | Autostart
}
```

### Profile storage

Pliki JSON w:
- Linux: `~/.config/easix/profiles/<name>.json`
- Windows: `%APPDATA%\easix\profiles\<name>.json`
- macOS: `~/Library/Application Support/easix/profiles/<name>.json`

---

## 6. Generowanie skryptów

Szablon `provision.sh.tera` używa silnika **Tera** (Rust). Składnia kompatybilna z Jinja2.

Przykład wyjścia: patrz `LLL.sh` w root projektu.

Sekcje szablonu:
1. Header (nazwa maszyny, data generowania)
2. Hostname (`hostnamectl set-hostname`)
3. System update (`apt-get update`)
4. Pakiety (`apt-get install -y`)
5. Użytkownicy (`useradd`, `usermod -aG`)
6. Sieć (`/etc/netplan/`, `netplan apply`)
7. Custom scripts (inline bash)
8. Footer (potwierdzenie zakończenia)

---

## 7. SSH Deploy

Moduł `commands/deploy.rs` używa crate `ssh2`:

1. Połączenie TCP → SSH handshake
2. Autentykacja (hasło lub klucz prywatny)
3. Upload skryptu przez SFTP (`/tmp/easix_provision.sh`)
4. Wykonanie: `chmod +x /tmp/easix_provision.sh && sudo /tmp/easix_provision.sh`
5. Streaming stdout/stderr do UI (przez Tauri events)
6. Usunięcie pliku tymczasowego po wykonaniu

**Bezpieczeństwo:** hasła i klucze prywatne są przekazywane tylko przez pamięć, nigdy zapisywane.

---

## 8. ADR (Architecture Decision Records)

- [ADR-001](adr/001-tauri-vs-electron.md) — Tauri zamiast Electron
- [ADR-002](adr/002-tera-vs-python-jinja2.md) — Tera zamiast Python Jinja2
- [ADR-003](adr/003-json-files-vs-sqlite.md) — JSON pliki zamiast SQLite
