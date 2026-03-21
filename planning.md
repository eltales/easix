# planning.md — Easix

*Ostatnia aktualizacja: 2026-03-21*

---

## Stan projektu

**Aktualny etap:** Feature-complete + UI redesign — gotowy do buildu i testów

---

## Zrealizowane

### TASK-001 → TASK-019
Backend, frontend, deploy SSH, devices CRUD, batch deploy, import/export .esx, dry-run shellcheck — wszystko zaimplementowane.

### TASK-020: Dark mode UI redesign ✅
- CSS variables: --p4..p7 (accent), --s9..s4 (surface)
- theme.ts: ACCENT_THEMES (7), BG_THEMES (4), FONT_THEMES, applyAccent/applyBg/initTheme
- tailwind.config.js: primary i surface przez CSS vars
- index.css: .input class, color-scheme: dark
- main.tsx: initTheme() przed ReactDOM.createRoot

### TASK-021: Settings drawer ✅
- Sliding panel z prawej (gear icon w sidebarze)
- Sekcje: Accent Color, Background Color, Text Color
- Kliknięcie poza zamyka; brak wyszarzania tła

### TASK-022: Devices — grupy, tagi, ping, redesign ✅
- DevicesContext: stan ładowany raz, persystentny między nawigacją
- Karty: kolor strip, OS badge, tagi, grupy, opis
- Ping status z glow (zielony/czerwony/szary)
- Refresh: stała szerokość + animowane kropki

### TASK-023: Deploy — unified flow + layout fix ✅
- Jeden przycisk Deploy Now / Batch Deploy Now
- Wyrównanie pól formularza, SSH key path full width

### TASK-024: Custom Select component ✅
- src/components/Select.tsx — zastępuje wszystkie natywne select
- Dark theme, keyboard-accessible

### TASK-025: System tab redesign ✅
- OS zawsze widoczny; hostname/locale/timezone opcjonalne (puste = skip)
- Templates: if profile.hostname / if profile.system.locale / if profile.system.timezone
- DEFAULT_PROFILE: hostname=, locale=, timezone=
- Autostart tab usunięty

### TASK-026: Ikony aplikacji ✅
- PNG był 1408x1418 → wyrównano do 1418x1418
- Wygenerowano wszystkie rozmiary przez npm exec tauri icon

### TASK-027: Porządki w repo ✅
- Usunięto z gita: .claude/, Bagno.esx, logo.ico/png, run.bat
- Usunięto: src-tauri/gen/, src-tauri/icons/android/, ios/
- .gitignore zaktualizowany

---

## Następne zadania

### TASK-028: Ikony OS w Devices
- Status: pending
- Cel: inline SVG per OS zamiast kropki (ubuntu, debian, alpine, windows, unknown)
- Status ping = kolor obwódki wokół ikony
- Pliki: src/pages/Devices.tsx

### TASK-029: Walidacja pól numerycznych on blur
- Status: pending
- Swap: min 128, max 65536 MB; GRUB: min 0, max 60 sec; Extlinux: min 0, max 600
- Pliki: src/pages/Editor.tsx

### TASK-030: Portable exe workflow
- Status: pending (workflow napisany, nie uruchomiony)
- Plik: .github/workflows/build-windows-portable.yml

---

## Architektura (skrót)

src/theme.ts — theming
src/context/DevicesContext.tsx — persystentny stan urządzeń
src/components/Layout.tsx — sidebar + settings drawer
src/components/Select.tsx — custom dropdown
src/pages/: Dashboard, Editor, Preview, Deploy, Devices

src-tauri/commands/: profiles, generator, deploy, devices
src-tauri/templates/: provision.sh.tera, provision.ps1.tera

Testy Rust: 33/33 OK | npm run build: OK
