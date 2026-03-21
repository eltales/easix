# summary/frontend.md — Easix Frontend (React)

*Ostatnia aktualizacja: 2026-03-21*

---

## Stack

React 18 + TypeScript + Vite + Tailwind CSS + CSS variables

---

## Theming (theme.ts)

- ACCENT_THEMES (7), BG_THEMES (4), FONT_THEMES
- applyAccent/applyBg ustawiają CSS vars na documentElement; initTheme wczytuje z localStorage
- CSS vars: --p4..p7 (accent), --s9..s4 (surface)
- Tailwind: primary-400..700 = rgb(var(--pN)), surface-900..400 = rgb(var(--sN))

---

## Komponenty

### Layout.tsx
- Dark sidebar z NavLink
- Gear icon otwiera sliding settings drawer (prawa strona)
- Sekcje drawera: Accent Color, Background Color, Text Color
- Klikniecie poza zamyka; brak wyszarzania tla

### Select.tsx
- Custom dropdown zastepu jacy natywny select, styled dark, keyboard-accessible

### DevicesContext.tsx
- Laduje urzadzenia raz, persystuje miedzy nawigacja
- Dostarcza: devices, pingStatus, pingAll, reload, setDeviceConnected

---

## Strony

### Dashboard.tsx — grid kart profili, akcje CRUD + import/export .esx

### Editor.tsx (taby: System, Software, User, Network, Security, Scripts)
- System: OS zawsze widoczny; hostname/locale/timezone puste = skip w skrypcie
- System: NTP/Swap/GRUB/TPM opcjonalne; GRUB i TPM ukryte dla Windows
- Software: presety per OS (toggle dodaj/usun), edytowalne komendy
- Autostart tab usuniety (zastapiony przez Scripts z run_once/autostart)

### Preview.tsx — generuj skrypt, dry-run shellcheck, deploy

### Deploy.tsx
- SSH form: saved devices lub reczne dane
- Jeden przycisk Deploy Now / Batch Deploy Now
- Historia localStorage (ostatnie 50)

### Devices.tsx
- DeviceCard: kolor strip, ikona OS (TODO: SVG), tagi, grupy, glow ping dot
- Refresh: stala szerokosc + animowane kropki

---

## types.ts

- DEFAULT_PROFILE: os="none", hostname="", locale="", timezone=""
- Device: id, name, host, port, username, auth_type, key_path, description, group, tags, color, os
- PingStatus: "online" | "offline" | "pending" | "unknown"
