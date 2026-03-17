# planning.md — Easix

*Ostatnia aktualizacja: 2026-02-22*

---

## Stan projektu

**Aktualny etap:** MVP feature-complete — do weryfikacji i build & package

### Zrealizowane (odkryte 2026-02-22)
Aplikacja jest znacznie bardziej zaawansowana niż zakładano przed inicjalizacją.
Cały backend i frontend są zaimplementowane i kompilują się bez błędów.

**Backend (Rust) ✅**
- `models.rs` — Profile, UserConfig, NetworkConfig, SecurityConfig, SystemConfig, CustomScript
- `commands/profiles.rs` — list, get, save, delete, duplicate, rename
- `commands/generator.rs` — generate_script, validate_script, export_script (Tera)
- `commands/deploy.rs` — deploy_ssh (ssh2 crate, password + key auth)
- `templates/provision.sh.tera` — pełny szablon: Debian/Ubuntu + Alpine 3.18
- `main.rs` — Tauri builder z wszystkimi commands + pluginami (dialog, shell)
- Cargo.toml: serde, tera, ssh2, dirs — wszystkie zależności skonfigurowane
- Bug fix (2026-02-22): poprawiono `cfg_attr` `windows_subsystem`

**Frontend (React) ✅**
- `types.ts` — interfejsy TS mirroring Rust models + DEFAULT_PROFILE
- `api.ts` — wszystkie invoke() wrappers
- `Layout.tsx` — sidebar navigation z NavLink
- `Dashboard.tsx` — grid kart profili + edit, duplicate, preview, delete
- `Editor.tsx` — editor tabbed (System, Software, User, Network, Security, Autostart, Scripts)
  - disable/enable sections per profil
  - quick-select z common packages (Debian + Alpine warianty)
  - custom bash scripts (run_once / autostart)
- `Preview.tsx` — select profil → generuj script → walidacja → copy/export/deploy
- `Deploy.tsx` — SSH form + deploy history (localStorage, ostatnie 50)

**Potwierdzony build:**
- `cargo check` → OK (9s)
- `npm run build` → OK (777ms, 200kB JS)
- `cargo tauri dev` → kompiluje i startuje (Mesa warnings w WSL — środowiskowe, nie błąd aplikacji)

---

## Zadania

### TASK-001 do TASK-009: done
Wszystkie poprzednie zadania implementacyjne zostały zrealizowane.

### TASK-010: Build & package
- Status: done
- Goal: Zbudować instalatory (.deb, .AppImage, .msi), przetestować instalację
- Modified files: src-tauri/tauri.conf.json (identifier: com.easix.app → io.easix.desktop)
- Wynik: Easix_0.1.0_amd64.deb (5.1 MB), Easix_0.1.0_amd64.AppImage (77 MB)
- Lokalizacja: src-tauri/target/release/bundle/

### TASK-011: Testy manualne (checklist z testing-strategy.md)
- Status: pending
- Goal: Przejść przez checklisty z docs/testing-strategy.md na działającej aplikacji
- Needs: summary/frontend.md, summary/ssh.md
- Skip: -
- Blocker: Wymaga środowiska z display (nie headless WSL) + test VM z SSH
- Next step: Uruchomić `cargo tauri dev` na środowisku z GUI, przejść checklisty

### TASK-012: Testy jednostkowe Rust
- Status: done
- Goal: Napisać testy dla generator.rs i profiles.rs (serde roundtrip, generowanie skryptu)
- Modified files: src-tauri/src/models.rs, src-tauri/src/commands/generator.rs
- Wynik: 24/24 testów (6 models + 18 generator)

### TASK-013: Weryfikacja Ubuntu 24.04
- Status: done
- Goal: Dodać ubuntu2404 do typów i szablonu (obecnie: ubuntu2204, debian11, alpine318)
- Modified files: src/types.ts, src/pages/Editor.tsx, src/pages/Preview.tsx

---

### TASK-014: Software redesign — SoftwareItem z wieloma komendami
- Status: done
- Modified files: src-tauri/src/models.rs, src-tauri/templates/provision.sh.tera, src/types.ts, src/pages/Editor.tsx, src-tauri/src/commands/generator.rs
- Wynik: 27/27 testów, npm run build OK
- Fallback deserializer: stare profile `["vim"]` → `SoftwareItem { name: "vim", commands: ["apt-get install -y vim"] }`
- Presets: 12 pozycji dla Debian/Ubuntu, 12 dla Alpine — filtrowane per OS
- Error handling: każda komenda owinięta `|| { echo "[ERROR] ..."; exit 1; }`

---

## Proposed Plan

**Problem:** `packages: Vec<String>` to tylko lista nazw apt. Nie obsługuje wielokrokowej instalacji
(np. Docker wymaga 4–5 kroków), nie pozwala edytować komend, nie działa na Alpine/Windows.

**Nowy model:**
```
SoftwareItem {
  name: String,            // "Docker" — wyświetlana nazwa
  commands: Vec<String>,   // ["apt-get install -y ca-certificates curl", "curl -fsSL https://get.docker.com | sh", "systemctl enable docker"]
}
```

**Co zmieniam:**

1. `src-tauri/src/models.rs`
   - Nowa struct `SoftwareItem { name: String, commands: Vec<String> }`
   - Pole `packages: Vec<String>` → `packages: Vec<SoftwareItem>`
   - Aktualizacja `impl Default for Profile`

2. `src-tauri/templates/provision.sh.tera`
   - Sekcja packages: zamiast jednego `apt-get install -y pkg1 pkg2...`
   - Loop per item: `# --- {{ item.name }} ---` + każda komenda osobno
   - Zachowanie Alpine-specific (`apk` vs `apt-get`) — teraz przez edytowalne commands

3. `src/types.ts`
   - Nowy interface `SoftwareItem { name: string; commands: string[] }`
   - `Profile.packages: string[]` → `packages: SoftwareItem[]`
   - Aktualizacja `DEFAULT_PROFILE`

4. `src/pages/Editor.tsx` — zakładka Software (największa zmiana UI)
   - Usunięcie starego checkboxowego gridu i customPkg inputu
   - Nowe dwa obszary:
     a) **Presets panel** — lista gotowych SoftwareItem do dodania (klik → trafia do listy)
     b) **Added items list** — każdy item ma: nazwa (edytowalna) + lista komend (textarea lub lista pól) + usuń
   - Presets zdefiniowane w pliku (per OS: deb vs alpine)

5. `src-tauri/src/commands/generator.rs` (testy)
   - Aktualizacja testów do nowego modelu

**Czego NIE zmieniam:**
- Reszta zakładek edytora (System, User, Network, Security, Autostart, Scripts)
- Backend commands (profiles CRUD, deploy, export) — pracują na `Profile` jako JSON, model się zmienia transparentnie
- Szablon Alpine — komendy są teraz w rękach użytkownika, ale presets dla Alpine mają `apk add`

**Breaking change:**
Istniejące profile JSON z `"packages": ["vim", "git"]` przestają działać (deserialization error).
Mitygacja: dodać fallback deserializatora który konwertuje `String` → `SoftwareItem { name: s, commands: ["apt-get install -y {s}"] }`.

**Presets (przykłady):**

| Nazwa | Komendy |
|-------|---------|
| python3 | `apt-get install -y python3` |
| git | `apt-get install -y git` |
| Docker | `apt-get install -y ca-certificates curl gnupg` → `curl -fsSL https://get.docker.com \| sh` → `systemctl enable docker` |
| Node.js 20 | `curl -fsSL https://deb.nodesource.com/setup_20.x \| bash -` → `apt-get install -y nodejs` |
| vim | `apt-get install -y vim` |

**Ryzyka:**
- Złożoność UI (edycja listy komend per item) — muszę wybrać dobry pattern
- Breaking change starych profili — mitygowane fallback deserializatorem

**Pliki do zmiany:** models.rs, provision.sh.tera, types.ts, Editor.tsx, testy w generator.rs
**Pliki NIE zmieniane:** profiles.rs, deploy.rs, generator.rs (logika), pozostałe strony

## Analysis
*(puste — wypełniane przy decyzjach architektonicznych)*
