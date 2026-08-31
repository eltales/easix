# planning.md — Easix

*Ostatnia aktualizacja: 2026-09-01*

---

## TASK-037: Live-test deployu na prawdziwej VM Debian — done

Postawiono jednorazową VM Debian 13 w VMware (`D:\VMs\debian-test`, 192.168.230.130,
tester/admin) i przepuszczono przez nią realny skrypt wygenerowany przez easix
(profil: debian11, pakiety htop+curl, user 'deploy', firewall=enabled, custom
script). Wykryto i naprawiono 4 realne bugi w `provision.sh.tera`/`generator.rs`,
niewidoczne dla żadnego testu jednostkowego (asercje typu `contains()` nie
łapią końców linii ani brakujących binarek w PATH):

1. **CRLF w szablonach** — `provision.sh.tera` był na dysku z końcami linii
   CRLF (checkout Windows), więc KAŻDY wygenerowany skrypt Linux dziedziczył
   `\r\n`, co wywalało `set -euo pipefail` i psuło heredocs. Fix:
   `generate_script` w `generator.rs` normalizuje `\r\n`→`\n` dla skryptów
   nie-Windows. Dodano `.gitattributes` (`eol=lf` dla `.tera`) jako drugą linię
   obrony.
2. **Brak pakietu `locales`** — minimalna instalacja Debiana nie ma
   `locale-gen`/`update-locale`. Fix: `apt-get install -y -qq locales` przed
   ich użyciem.
3. **PATH bez `/usr/sbin`** — sesje SSH exec / `su` bez loginu często dają
   PATH bez `/usr/sbin`, więc `locale-gen`, `update-locale`, `useradd` itp.
   "nie istnieją" mimo że są zainstalowane. Fix: jawny `export PATH=...` z
   `/usr/sbin:/sbin` na początku skryptu (obie gałęzie: alpine i debian/ubuntu).
4. **`locale-gen <locale>` jako argument nic nie generuje** — trzeba najpierw
   dopisać locale do `/etc/locale.gen` i wywołać `locale-gen` bez argumentów.

Po wszystkich poprawkach pełny deploy przeszedł od początku do końca na
żywej maszynie: pakiety, user+sudo, UFW (SSH przetrwało włączenie zapory —
sprawdzone przez faktyczne ponowne połączenie SSH), custom script.
Testy Rust: 63/63 → 64/64 z nowymi regresjami dla wszystkich 4 przypadków.

---

## Stan projektu

**Aktualny etap:** Feature-complete + UI redesign + prawdziwe Settings + auto-update — gotowy do buildu i testów. Code-signing (Authenticode) świadomie odłożony do momentu wypuszczenia narzędzia poza jednego użytkownika.

---

## TASK-035: Wybór trybu zapory sieciowej (Security tab) — done

Status: **zaimplementowane i zweryfikowane** (tsc/build OK, cargo check/test OK — 58/58, w tym 4 nowe testy)

### Kontekst / decyzje użytkownika
- 3 tryby: Domyślny (nie dotykaj) / Włączony (obecne zachowanie) / Wyłączony (NOWY, jawne wyłączenie)
- Implementacja per rodzina OS — inne komendy dla Debiana/Ubuntu (ufw), Alpine (iptables), Windows (Set-NetFirewallProfile); bez dodatkowego 4. trybu "Wymuś profil Private" na razie
- Bez auto-migracji starych profili z `ufw: bool` — po wczytaniu dostają wartość domyślną, trzeba ustawić ręcznie

### Co się zmieni
1. `src-tauri/src/models.rs` — `SecurityConfig.ufw: bool` → `SecurityConfig.firewall: String` (`#[serde(default = "default_firewall")]`, wartości `"default"|"enabled"|"disabled"`), `Default for SecurityConfig`, testy `test_default_profile_values`/`test_security_config_default`
2. `src-tauri/src/commands/generator.rs` — wszystkie odwołania `security.ufw` → `security.firewall == "enabled"/"disabled"`; aktualizacja `test_generate_ufw_enabled`, `test_generate_windows11_firewall_default_deny`; nowe testy dla trybu "disabled" (ufw, iptables, Windows) i "default" (pomija sekcję)
3. `src-tauri/templates/provision.sh.tera` (sekcja Firewall) — trójstanowe rozgałęzienie zamiast `{% if ufw %}`:
   - Debian/Ubuntu disabled: `ufw --force disable`
   - Alpine disabled: `iptables -P INPUT/FORWARD/OUTPUT ACCEPT` + `iptables -F` + `rc-update del iptables default` + `/etc/init.d/iptables save` (żeby reboot nie przywrócił starej polityki DROP)
4. `src-tauri/templates/provision.ps1.tera` (sekcja Firewall) — dodanie gałęzi disabled: `Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled False`
5. `src/types.ts` — `SecurityConfig.ufw: boolean` → `SecurityConfig.firewall: "default"|"enabled"|"disabled"`, `DEFAULT_PROFILE.security`
6. `src/pages/Editor.tsx` — checkbox → `Select` (3 opcje, etykiety per OS jak dziś w `firewallLabel`) + krótki opis skutku wybranej opcji

### Czego NIE zmieniam
- SSH key deployment (osobna sekcja) — bez zmian
- Toggle "Section Enabled" dla całej zakładki Security (`disabled_sections`) — inny mechanizm, zostaje
- Brak auto-migracji — zgodnie z decyzją użytkownika

### Ryzyka
- Breaking change kształtu JSON `SecurityConfig` — stare `.esx`/zapisane profile z polem `ufw` nadal się wczytają (dzięki serde default), ale bez zachowania poprzedniego ustawienia firewalla (świadomie zaakceptowane)
- Alpine "disabled" wymaga usunięcia usługi z autostartu, nie tylko flush na żywo — uwzględnione w planie

### Weryfikacja
- `cargo check`/`cargo test` w Dockerze (w tym nowe testy)
- `tsc --noEmit` + `npm run build`
- Ręczny przegląd wygenerowanego skryptu dla 3 trybów × 3 rodziny OS przez Preview/dry-run

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

### TASK-031: Prawdziwe Settings (poza kolorami) — done
- Cel: rozszerzyć drawer "Appearance" o zakładki: Deploy / Appearance / Updates
- Backend: src-tauri/src/commands/settings.rs — AppSettings (port, username,
  connect timeout, default OS, history limit), JSON w config dir, get/save_settings
- Frontend: Layout.tsx (zakładki w drawerze), types.ts (AppSettings, OS_OPTIONS),
  api.ts (getSettings/saveSettings)
- Wpięte do: Deploy.tsx (domyślny port/username/timeout/history limit),
  Editor.tsx (domyślny OS dla nowych profili), deploy.rs (connect_timeout_secs
  jako override zamiast stałej)
- Weryfikacja: tsc --noEmit OK, npm run build OK, cargo check/test w Dockerze OK (54/54)

### TASK-032: Auto-update (tauri-plugin-updater) — done (czeka na sekrety GitHub)
- Dodano tauri-plugin-updater + tauri-plugin-process (Cargo.toml, package.json)
- capabilities/default.json: updater:default, process:default
- tauri.conf.json: plugins.updater.pubkey (wygenerowany lokalnie przez
  `npx tauri signer generate --ci`, klucz BEZ hasła) + endpoints wskazujące na
  GitHub Releases latest.json
- Prywatny klucz podpisujący NIE jest w repo — użytkownik musi dodać go sam
  jako sekrety GitHub Actions (TAURI_SIGNING_PRIVATE_KEY, puste
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD)
- .github/workflows/release.yml (nowy) — tag v*.*.* buduje, podpisuje i publikuje
  draft release z tauri-apps/tauri-action
- UI: zakładka "Updates" w Settings drawer — Check for Updates / Install & Restart
- To NIE jest podpis Authenticode (SmartScreen) — ten pozostaje odłożony do
  momentu wypuszczenia narzędzia poza jednego użytkownika, zgodnie z decyzją

### TASK-033: Version bump script — done
- scripts/bump-version.mjs (+ npm run bump) synchronizuje wersję w
  package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json
- Przetestowane na kopiach plików (patch 0.1.0 -> 0.1.1), oryginały nietknięte

### TASK-034: Domknięcie Settings/auto-update/version-bump
- Status: pending
- [ ] Push commitu `dbd981a` na `origin/main` (na razie tylko lokalnie)
- [ ] Dodać sekret GitHub Actions `TAURI_SIGNING_PRIVATE_KEY` (wartość podana
      użytkownikowi w czacie; `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` zostawić puste)
- [ ] Zrobić pierwszy prawdziwy release: `npm run bump patch` → commit → `git tag vX.Y.Z`
      → push + push --tags → sprawdzić, czy `release.yml` przechodzi i publikuje
      `latest.json` (dopiero wtedy auto-update ma do czego się odnosić)
- [ ] Realny test UI w zbudowanej apce: zakładki Settings (Deploy/Appearance/
      Updates), zapis/odczyt ustawień, przycisk Check for Updates — nie było
      testowane na żywo, tylko statycznie (tsc, build, cargo test)
- Code-signing (Authenticode / SmartScreen) — świadomie odłożone do momentu
  wypuszczenia narzędzia poza jednego użytkownika, nie ruszać bez pytania

### TASK-028: Ikony OS w Devices
- Status: pending
- Cel: inline SVG per OS zamiast kropki (ubuntu, debian, alpine, windows, unknown)
- Status ping = kolor obwódki wokół ikony
- Pliki: src/pages/Devices.tsx

### TASK-029: Walidacja pól numerycznych on blur
- Status: pending
- Swap: min 128, max 65536 MB; GRUB: min 0, max 60 sec; Extlinux: min 0, max 600
- Pliki: src/pages/Editor.tsx

### TASK-030: Portable exe workflow — done
- Potwierdzone przez użytkownika jako działające i używane w praktyce
  (`.github/workflows/build-windows-portable.yml`, --no-bundle)

### TASK-036: Domyślna treść custom scriptu zależna od OS — done
- Problem: przycisk dodania nowego custom scriptu w zakładce Scripts zawsze
  wstawiał `#!/bin/bash\n`, także dla profili Windows, gdzie skrypty lecą
  jako PowerShell (.ps1) — mylący/błędny domyślny shebang
- Naprawa: src/pages/Editor.tsx — domyślna treść i placeholder zależne od
  isWindows (Windows: puste/PowerShell przykład, Linux/Alpine: bash jak dotąd)
- Weryfikacja: tsc --noEmit OK

---

## Architektura (skrót)

src/theme.ts — theming
src/context/DevicesContext.tsx — persystentny stan urządzeń
src/components/Layout.tsx — sidebar + settings drawer
src/components/Select.tsx — custom dropdown
src/pages/: Dashboard, Editor, Preview, Deploy, Devices

src-tauri/commands/: profiles, generator, deploy, devices
src-tauri/templates/: provision.sh.tera, provision.ps1.tera

Testy Rust: 58/58 OK | npm run build: OK | tsc --noEmit: OK
