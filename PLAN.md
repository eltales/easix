# PLAN.md — Easix

## Architektura v0.2 (natywna aplikacja desktopowa)

### Zasada działania
- Jedna aplikacja desktopowa (Tauri) — **bez serwera HTTP, bez przeglądarki**
- UI renderowany w wbudowanym webview Tauri (React)
- Cała logika biznesowa w Rust (Tauri commands)
- Python używany **tylko** jako embedded engine do renderowania Jinja2 szablonów
  (wywoływany jako subprocess, nie jako serwer)
- Aplikacja działa w pełni offline

### Schemat komunikacji

```
┌─────────────────────────────────────┐
│          Tauri Window               │
│  ┌───────────────────────────────┐  │
│  │     React UI (webview)        │  │
│  │                               │  │
│  │  invoke("save_profile", ...)  │  │
│  │  invoke("generate_script",...)│  │
│  │  invoke("list_profiles", ...) │  │
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

### Decyzje technologiczne

| Warstwa | Stara wersja (v0.1) | Nowa wersja (v0.2) |
|---------|---------------------|--------------------|
| UI | React + Vite (localhost:1420) | React + Vite (embedded w Tauri webview) |
| Backend | FastAPI (localhost:8000) | Rust Tauri commands (IPC) |
| Szablony | Python Jinja2 | Rust Tera (kompatybilny z Jinja2) |
| Profile | Python Pydantic | Rust serde + serde_json |
| SSH | Python Paramiko | Rust ssh2 crate |
| Eksport | Przeglądarka download | Tauri native file dialog |
| Packaging | Brak | .deb / .AppImage / .exe |

### Struktura projektu

```
easix/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs               # Entry point + Tauri setup
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── profiles.rs       # CRUD profili (list, get, save, delete)
│   │   │   ├── generator.rs      # Generowanie skryptu bash z Tera
│   │   │   └── deploy.rs         # SSH deploy (opcjonalny)
│   │   ├── models.rs             # Struktury danych (Profile, UserConfig, etc.)
│   │   └── templates.rs          # Ładowanie szablonów Tera
│   └── templates/
│       └── provision.sh.tera     # Szablon bash skryptu
├── src/                          # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── api.ts                    # Tauri invoke() wrapper
│   ├── types.ts
│   ├── index.css
│   ├── components/
│   │   └── Layout.tsx
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Editor.tsx
│       ├── Preview.tsx
│       └── Deploy.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── CLAUDE.md
└── PLAN.md
```

### Tauri Commands (IPC API)

| Command | Argumenty | Zwraca | Opis |
|---------|-----------|--------|------|
| `list_profiles` | — | `Vec<String>` | Lista nazw profili |
| `get_profile` | `name: String` | `Profile` | Pobierz profil |
| `save_profile` | `name: String, profile: Profile` | `()` | Zapisz profil |
| `delete_profile` | `name: String` | `()` | Usuń profil |
| `generate_script` | `profile: Profile` | `String` | Wygeneruj bash script |
| `export_script` | `script: String, default_name: String` | `Option<String>` | Natywny dialog "Save as..." |
| `deploy_ssh` | `profile: Profile, host, port, user, password/key` | `String` | Upload + execute przez SSH |

### Profile storage

Profile zapisywane jako pliki `.json` w:
- Linux: `~/.config/easix/profiles/`
- Windows: `%APPDATA%/easix/profiles/`

Ścieżka ustalana przez `tauri::api::path::app_config_dir()`.

### Fazy implementacji

1. **Scaffold** — struktura katalogów, Cargo.toml, package.json, konfiguracja Tauri
2. **Rust models** — struktury Profile, serde serialization
3. **Rust commands** — CRUD profili, generator (Tera), export
4. **React UI** — przepisanie api.ts na invoke(), reszta UI bez zmian
5. **SSH deploy** — opcjonalny moduł z ssh2 crate
6. **Build & package** — `cargo tauri build` → .deb/.AppImage/.exe

### Co usunąć ze starej wersji

- `app/` (cały katalog Python — FastAPI, Paramiko, Jinja2)
- `requirements.txt`
- `ui/` (przenieść src/ do root, usunąć osobny katalog ui/)
- `.venv/`
