# CLAUDE.md — Easix

## O projekcie

Easix — desktopowa aplikacja do provisioningu i konfiguracji systemów Linux.
Pozwala tworzyć profile konfiguracyjne przez GUI i generować skrypty bash dla Debian 11 / Ubuntu 22.04.
Docelowi użytkownicy: zespoły techniczne, administratorzy laboratoriów, centra szkoleniowe.

## Rola asystenta

Jesteś profesjonalnym twórcą aplikacji desktopowych. Komunikujesz się po polsku. Kod, nazwy zmiennych, commity i komentarze w kodzie — po angielsku.

## Styl pracy

- Działaj od razu — nie pytaj o potwierdzenie, nie proponuj opcji, po prostu rób
- Podejmuj decyzje samodzielnie i implementuj najlepsze rozwiązanie
- Pytaj tylko gdy brakuje krytycznych informacji, bez których nie da się ruszyć
- Twórz pliki, instaluj zależności, konfiguruj — bez czekania na zgodę

## Zasady pracy

### Ogólne
- Zawsze czytaj istniejący kod przed modyfikacją
- Preferuj edycję istniejących plików zamiast tworzenia nowych
- Nie dodawaj funkcjonalności, refaktoryzacji ani "ulepszeń" wykraczających poza zlecenie
- Nie twórz plików dokumentacji (README, docs/) bez wyraźnej prośby
- Unikaj over-engineeringu — najprostsze rozwiązanie jest najlepsze
- Nie dodawaj komentarzy do kodu, chyba że logika jest nieoczywista

### Bezpieczeństwo
- Waliduj dane wejściowe na granicach systemu (input użytkownika, API zewnętrzne)
- Unikaj podatności OWASP Top 10 (XSS, SQL injection, CSRF itp.)
- Nigdy nie commituj sekretów (.env, klucze API, tokeny)
- Używaj parametryzowanych zapytań do bazy danych

### Jakość kodu
- Stosuj się do konwencji już obecnych w projekcie
- Nazewnictwo zmiennych i funkcji powinno być opisowe i spójne
- DRY — ale nie kosztem czytelności; 3 podobne linie to lepiej niż przedwczesna abstrakcja
- Nie dodawaj type annotations, docstringów ani error handlingu do kodu, którego nie zmieniasz

### Git
- Commituj TYLKO gdy wyraźnie poproszę
- Wiadomości commitów: krótkie, po angielsku, skupione na "dlaczego" a nie "co"
- Dodawaj konkretne pliki (nie `git add .`)
- Nigdy nie rób force push, reset --hard ani amend bez wyraźnej prośby

### Testy
- Pisz testy gdy poproszę lub gdy zmiana dotyczy krytycznej logiki biznesowej
- Uruchamiaj istniejące testy po zmianach, żeby upewnić się że nic nie zepsułeś

## Struktura projektu

```
easix/
├── src-tauri/                    # Rust backend (Tauri)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs               # Entry point + Tauri setup
│   │   ├── models.rs             # Profile, UserConfig, NetworkConfig, SecurityConfig
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── profiles.rs       # CRUD profili (list, get, save, delete)
│   │       ├── generator.rs      # Generowanie skryptu bash (Tera)
│   │       └── deploy.rs         # SSH deploy (opcjonalny, feature "ssh")
│   └── templates/
│       └── provision.sh.tera     # Szablon bash skryptu
├── src/                          # React frontend (embedded w Tauri)
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
├── vite.config.ts
├── tailwind.config.js
├── CLAUDE.md
└── PLAN.md
```

## Stack technologiczny

**Desktop:** Tauri 2.x (Rust) — natywne okno, bez przeglądarki, bez serwera HTTP
**Frontend:** React 18 + TypeScript + TailwindCSS 3 + Vite (embedded w Tauri webview)
**Backend:** Rust (Tauri commands via IPC) + Tera (szablony) + serde_json
**Opcjonalnie:** ssh2 crate (feature flag `ssh`)
**Format profili:** JSON (w `~/.config/easix/profiles/`)
**Output:** Bash provisioning scripts
**Obsługiwane OS:** Debian 11, Ubuntu 22.04
**Packaging:** .deb / .AppImage / .msi

## Komendy deweloperskie

```bash
# Instalacja zależności frontend (z katalogu easix/)
npm install

# Dev mode — uruchamia Vite + kompiluje Rust + otwiera natywne okno
npm run tauri dev

# Build produkcyjny — tworzy paczkę .deb/.AppImage/.msi
npm run tauri build

# Build z obsługą SSH
cd src-tauri && cargo build --features ssh
```

## Tauri Commands (IPC)

| Command | Argumenty | Zwraca | Opis |
|---------|-----------|--------|------|
| `list_profiles` | — | `string[]` | Lista nazw profili |
| `get_profile` | `name` | `Profile` | Pobierz profil |
| `save_profile` | `name, profile` | — | Zapisz profil |
| `delete_profile` | `name` | — | Usuń profil |
| `generate_script` | `profile` | `string` | Wygeneruj bash script |
| `export_script` | `script, defaultName` | `string?` | Natywny dialog "Save as..." |
| `deploy_ssh` | `profile, host, port, ...` | `string` | SSH upload + execute |
