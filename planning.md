# planning.md — Easix

*Ostatnia aktualizacja: 2026-09-01*

---

## TASK-039 — Wykrywanie urządzeń (Scan for devices), Faza 1 — done
- Status: done (kod + testy jednostkowe zielone; realny UI click-through w
  zbudowanej apce NIE zrobiony — brak lokalnego toolchaina Rust na Windows,
  tylko Docker/Linux do `cargo test`; ten sam gap co Settings/Updates)
- Zaimplementowane dokładnie wg planu z Fazy 1 (patrz niżej, zachowane jako
  dokumentacja): auto-detekcja interfejsów, presety, własny CIDR, ping+port
  sweep, MAC→vendor (OUI), hostname (nslookup, best-effort), UI wyników,
  "Dodaj jako urządzenie" → prefill Devices przez `navigate(..., {state})`
- Pliki: src-tauri/src/commands/discovery.rs (nowy), mod.rs, main.rs,
  Cargo.toml (+if-addrs), src/pages/Discovery.tsx (nowy), src/api.ts,
  src/types.ts, src/App.tsx, src/components/Layout.tsx, src/pages/Devices.tsx
  (hook na location.state.prefill)
- Weryfikacja: `cargo test --features ssh` 77/77 (11 nowych testów dla
  discovery.rs: parse_cidr, looks_like_ipv4/mac, lookup_vendor,
  parse_nslookup_hostname, netmask_to_prefix_len), `tsc --noEmit` czysto,
  `npm run build` czysto. Jeden test najpierw czerwony (parser nslookup nie
  łapał formatu Linuksowego "name = X" bo szukał tylko "Name:" na początku
  linii) — naprawiony przed commitem.
- Napotkany blocker środowiskowy (rozwiązany): Docker Desktop crashował przy
  starcie ("sailor-ingest.sock: file cannot be accessed") — stare pliki
  socket w `%LOCALAPPDATA%\Docker\run\` to reparse pointy, których Windows
  (Explorer/PowerShell Remove-Item) nie potrafi usunąć; trzeba je skasować
  z poziomu WSL (`wsl -d Ubuntu -e rm /mnt/c/.../Docker/run/*`), potem
  restart Docker Desktop.

### Bug + poprawki po pierwszym realnym użyciu (live test na VM)
- **Bug (krytyczny)**: `ping`/`arp`/`nslookup` odpalane z apki okienkowej
  (bez własnej konsoli) otwierały nowe okno cmd PER PROCES — użytkownik
  odpalił skan /24 na swoim realnym PC i dostał ~250 okien cmd naraz.
  Naprawa: `CREATE_NO_WINDOW` (0x08000000) jako creation flag na Windowsie
  dla każdego spawnowanego procesu w discovery.rs. Zweryfikowane live na
  VM (stary build bez fixa) — reprodukcja potwierdzona na małym /29 (kilka
  okien mignęło), fix wgrany i wypchnięty, czeka na nowy build do
  potwierdzenia że faktycznie znika.
- **Feedback użytkownika → 3 nowe funkcje**:
  - "Already visible" — 4. tryb skanu, czysto pasywny (czyta tylko ARP
    cache hosta, zero ping/portów), natychmiastowy wynik dla urządzeń już
    znanych systemowi
  - "Stop scan" — przycisk podczas skanu, `cancel_scan(scan_id)` ustawia
    flagę sprawdzaną przed startem pracy dla każdego hosta i przed fazą
    wzbogacania (ARP+hostname); nie zabija już odpalonych procesów ping,
    ale ogranicza ile NOWEJ pracy ruszy po kliknięciu
  - Zakładki trybu skanu zablokowane podczas trwania skanu (mniej
    mylącego stanu)
- Dodano `.gitignore: /*.exe` — użytkownik wrzucił zbudowany `easix.exe`
  bezpośrednio do katalogu repo, o mały włos by się nie zacommitował

### Poza zakresem Fazy 1 (Faza 2, jeśli będzie potrzebna)
- IPv6 link-local NDP discovery (`ff02::1`) — wykrywa urządzenie nawet bez
  znanego IPv4
- Banner grabbing / tytuł strony logowania HTTP — mocniejsza identyfikacja
- Realne wykrywanie fizycznych urządzeń USB (RPi w trybie gadget)

<details>
<summary>Oryginalny plan Fazy 1 (zachowany dla kontekstu)</summary>

- Status: in-progress (zatwierdzone przez użytkownika, Faza 1)

### Cel
Nowa zakładka w panelu bocznym do wykrywania urządzeń w sieci lokalnej
(podłączonych kablem Ethernet lub przez adapter USB-Ethernet), żeby nie
trzeba było ręcznie znać/wpisywać IP przed dodaniem urządzenia do Devices.
Szczególnie przydatne dla świeżych/fabrycznych urządzeń (MikroTik, Raspberry
Pi) które mają znane domyślne adresy albo dopiero co dostały IP z DHCP.

### Zakres — Faza 1 (ten PR)
1. **Auto-detekcja interfejsów**: lista aktywnych kart sieciowych hosta
   (w tym USB-Ethernet — system i tak widzi to jako zwykłą kartę) i ich
   podsieci IPv4, wybierane jako cel skanu jednym kliknięciem.
2. **Presety popularnych urządzeń** — dropdown z listą (MikroTik
   192.168.88.1, TP-Link 192.168.0.1/192.168.1.1, Ubiquiti 192.168.1.20,
   generyczny domowy router 192.168.1.1/192.168.0.1, itd.) — statyczna lista
   w kodzie, łatwa do rozszerzenia później.
3. **Własny zakres** — pole na CIDR (np. `192.168.1.0/24`) albo zakres IP.
4. **Sam skan**: ping sweep po wybranym zakresie + sprawdzenie wybranych
   portów (22 SSH, 23 Telnet, 80/443 HTTP(S), 3389 RDP, 8291 Winbox,
   5985/5986 WinRM) na hostach które odpowiedziały na ping.
5. **Identyfikacja per-host**:
   - MAC adres (z tablicy ARP hosta po zakończeniu ping) → producent przez
     lokalną bazę OUI (pierwsze 3 bajty MAC, statyczny plik/tabela w repo,
     np. wyciąg z publicznej listy IEEE — tylko popularne prefiksy, nie
     cała baza ~30k wpisów, żeby nie pompować binarki)
   - Lista otwartych portów z kroku 4 jako wskazówka typu urządzenia
   - Hostname jeśli rozwiązywalny (DNS/mDNS `.local`)
6. **UI wyników**: lista/karty z IP, MAC, producentem, otwartymi portami,
   przyciskiem **"Dodaj jako urządzenie"** który wypełnia istniejący
   formularz dodawania w Devices (host/port/domyślny user wg zgadniętego
   typu).
7. **Implementacja przez narzędzia systemowe, nie surowe sockety** —
   `arp -a`, `ping`, natywny TCP connect-scan na portach (Rust
   `std::net::TcpStream` z timeoutem, bez podnoszenia uprawnień). Bez UAC,
   bez adminskich raw socketów.
8. **Windows + Linux** (Mac pomijamy — apka i tak nie buduje bundla na
   Mac, patrz `tauri.conf.json` bundle.targets: deb/appimage/nsis) — komendy
   systemowe różnią się (`arp -a` działa na obu, ale parsing wyjścia inny;
   enumeracja interfejsów przez różne API).

### Poza zakresem Fazy 1 (możliwa Faza 2, osobny PR)
- **IPv6 link-local NDP discovery** (`ff02::1` multicast ping + odczyt
  cache sąsiadów) — wykrywa urządzenia nawet bez znanego IPv4/DHCP, bardzo
  przydatne dla świeżego MikroTika/Linuksa podłączonego bezpośrednio
  kablem. Zostawione na Fazę 2 bo wymaga osobnej ścieżki kodu (ICMPv6,
  parsing `netsh interface ipv6 show neighbors` / `ip -6 neigh`).
- **Banner grabbing / HTTP title scraping** (SSH banner, tytuł strony
  logowania) — mocniejsza identyfikacja typu urządzenia, ale dodatkowa
  złożoność (parsowanie odpowiedzi HTTP/SSH). Faza 2.
- Realne wykrywanie fizycznych urządzeń USB (np. RPi w trybie gadget przez
  kabel USB, bez sieci) — inna kategoria niż skan sieciowy, osobna decyzja
  jeśli okaże się potrzebna.

### Pliki do zmiany/dodania
- `src-tauri/src/commands/discovery.rs` (nowy) — komendy Tauri: lista
  interfejsów, skan zakresu, lookup OUI
- `src-tauri/src/oui_db.rs` lub `assets/oui_prefixes.json` (nowy) — statyczna
  baza popularnych prefiksów MAC → producent
- `src-tauri/src/main.rs` — rejestracja nowych komend
- `src/pages/Discovery.tsx` (nowa strona)
- `src/App.tsx` / routing — nowa trasa
- komponent sidebar (znaleźć plik nawigacji) — nowa pozycja w menu
- `src/pages/Devices.tsx` — hook do "Dodaj jako urządzenie" (prefill
  formularza z wyniku skanu)

### Ryzyka
- Aktywne skanowanie sieci może wywołać alert firewalla/EDR na skanowanej
  sieci — to narzędzie do własnej infrastruktury użytkownika, ale warto
  dodać w UI krótką notkę/ostrzeżenie.
- Czas skanu dla dużych zakresów (/24 = 254 hosty) — trzeba
  zrównoleglić (skan portów per-host równolegle z timeoutem), inaczej
  UI będzie "wisieć" sekundy/minuty.
- Baza OUI = statyczna lista w repo, będzie się starzeć (nowe prefiksy
  producentów) — akceptowalne dla MVP, nie auto-aktualizowana.

### Czego NIE zmieniam
- Istniejący flow dodawania urządzeń ręcznie (Devices.tsx) zostaje bez
  zmian poza dodaniem opcjonalnego prefill z wyniku skanu.
- Generator skryptów provisioningu (`generator.rs`, `.tera`) — bez zmian,
  to osobna funkcja niezwiązana z discovery.

</details>

---

## TASK-038: Live-test deployu na prawdziwej VM Windows 11 — done

VM `D:\VMs\windows-test` (Windows 11 Enterprise Evaluation 25H2, build
26100.6584, dysk SATA nie SCSI — lsilogic nie ma wbudowanego sterownika w
instalatorze, VNC port 5902 hasło "wintest"). Wymagania TPM/Secure
Boot/RAM/CPU ominięte przez `HKLM\SYSTEM\Setup\LabConfig` (Shift+F10 podczas
Setup). Konto lokalne przez "Sign-in options" → "Domain join instead"
(Enterprise edition to oferuje, omija Microsoft account) — user
`tester`/`Admin1234!`, lokalny administrator.

**Ważne dla przyszłych sesji:** `vncdo type` bez `--force-caps` psuje znaki
`_ $ ( )` (np. `REG_DWORD` → `reg-dword`) — **zawsze używać `--force-caps`**
na tej maszynie. `Add-WindowsCapability`/`DISM /Add-Capability` dla OpenSSH
potrafi wyglądać na zawieszone (pasek postępu w konsoli PowerShell nie
odświeża się widocznie przez VNC) mimo że `TiWorker.exe` realnie liczy CPU w
tle — sprawdzać przez `(Get-Process TiWorker).CPU` w osobnym oknie zamiast
ufać samemu paskowi; operacja trwała ~10 minut na tej VM (2 vCPU/4GB RAM).

OpenSSH Server włączony (`Start-Service sshd` + firewall rule na port 22).
Wygenerowano i uruchomiono realny `provision.ps1` (profil windows11, user
`deploy`, `security.firewall="disabled"`, custom script PowerShell) —
**pełny sukces, `=== Easix provisioning completed ===`, exit 0**:
- User `deploy` utworzony i dodany do Administrators
- Firewall wyłączony na wszystkich 3 profilach (`Get-NetFirewallProfile`
  potwierdza `Enabled: False` na Domain/Private/Public) — SSH przetrwało
- Custom script wykonany, plik znacznikowy zapisany poprawnie

**Jedno drobne, nie-easix-owe zaobserwowane zachowanie:** `Set-TimeZone -Name
UTC` zwraca błąd "not found on the local computer" na tym konkretnym
buildzie, mimo że `Get-TimeZone -ListAvailable` faktycznie listuje "UTC" —
skrypt poprawnie łapie to jako `[WARN]` i kontynuuje, nie jest to blokujące.
Nie zmieniano kodu w tym miejscu — wygląda na kwirk tego builda/VM, nie na
błąd w szablonie.

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
- Prywatny klucz podpisujący NIE jest w repo — użytkownik trzyma go sam jako
  sekrety GitHub Actions (TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD).
  Klucz z hasłem zgubionym po drodze został 2026-09-01 zrotowany (nowy pubkey
  w tauri.conf.json, nowy prywatny klucz + hasło w sekretach) — 0 użytkowników
  z zainstalowaną apką w tym momencie, więc bez problemu zgodności
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
- Status: done (jądro auto-update działa; UI live-test wciąż nie zrobiony)
- [x] Push na `origin/main`
- [x] Sekrety GitHub Actions `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
      dodane (po rotacji klucza, patrz TASK-032)
- [x] `.github/workflows/bump-and-release.yml` (nowy) — workflow_dispatch (patch/
      minor/major) robi bump+commit+tag+push, a na końcu jawnie odpala `release.yml`
      przez `gh workflow run` (bo push taga z domyślnym GITHUB_TOKEN NIE odpala
      innych workflowów automatycznie — trzeba było to obejść jawnym wywołaniem)
- [x] `release.yml` dostał dodatkowo `workflow_dispatch:` (potrzebne do powyższego)
- [x] Pierwszy prawdziwy release zrobiony i zweryfikowany (Release #1, v0.1.1,
      podpisywanie działa po rotacji klucza)
- [ ] Realny test UI w zbudowanej apce: zakładki Settings (Deploy/Appearance/
      Updates), zapis/odczyt ustawień, przycisk Check for Updates — nie było
      testowane na żywo, tylko statycznie (tsc, build, cargo test)
- Code-signing (Authenticode / SmartScreen) — świadomie odłożone do momentu
  wypuszczenia narzędzia poza jednego użytkownika, nie ruszać bez pytania

### TASK-028: Ikony OS w Devices — done
- Status: done (zweryfikowane w kodzie — było już zaimplementowane, nie stale)
- Cel: inline SVG per OS zamiast kropki (ubuntu, debian, alpine, windows, unknown)
- Status ping = kolor obwódki wokół ikony
- Pliki: src/pages/Devices.tsx — OsSvg (per-OS <svg>) + OsIcon (obwódka wg PingStatus)

### TASK-029: Walidacja pól numerycznych on blur — done
- Status: done (zweryfikowane w kodzie — było już zaimplementowane, nie stale)
- Swap: min 128, max 65536 MB; GRUB: min 0, max 60 sec; Extlinux: min 0, max 600
- Pliki: src/pages/Editor.tsx — swapRaw/grubRaw + onBlur clamping, progi zgodne ze specyfikacją

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

### TASK-037: 4 realne bugi w deploy Windows, znalezione live-testem na VM — done
- Kontekst: pierwszy raz przetestowano faktyczny kod `deploy_ssh` (nie ręczny
  skrypt paramiko) end-to-end na realnej VM Windows 11 (192.168.230.131)
- Bug 1 — `src-tauri/src/commands/deploy.rs`: upload skryptu przez legacy SCP
  (`scp_send`) padał z `Session(-28)` / `LIBSSH2_ERROR_SCP_PROTOCOL` na
  Win32-OpenSSH Server. Naprawa: przejście na SFTP (`sess.sftp().create()`)
  dla obu gałęzi OS — Win32-OpenSSH i każdy Linux OpenSSH solidnie to wspierają
- Bug 2 — `src-tauri/src/commands/generator.rs`: skrypt PowerShell wysyłany bez
  BOM. Windows PowerShell 5.1 bez BOM czyta plik w kodowaniu systemowym, nie
  UTF-8 — znaki spoza ASCII (em dash w szablonie) rozjeżdżały parser kilka
  linii dalej ("Array index expression is missing or not valid"), zrywając
  CAŁY skrypt przed jakimkolwiek wykonaniem. Naprawa: prefiks `\u{FEFF}` dla
  wyjścia Windows w `generate_script()`
- Bug 3 — `src-tauri/templates/provision.ps1.tera`: sekcja NTP używała złej
  nazwy usługi (`w32tm` to CLI, usługa nazywa się `W32Time`) — pod
  `Set-StrictMode`/`$ErrorActionPreference="Stop"` to przerywało CAŁY skrypt
  na NTP (włączonym domyślnie), więc żaden Windows deploy z domyślnym
  profilem nie doszedłby dalej niż Timezone. Naprawiono nazwę + dodano
  try/catch (spójnie z resztą opcjonalnych sekcji)
- Bug 4 — `provision.ps1.tera`: `check_cmd` dla pakietów na Windows sprawdzał
  tylko `$?` (czy komenda nie rzuciła błędu), nie faktyczny wynik — więc
  cmdlet zwracający `$false` bez wyjątku (np. `Test-Path`) był zawsze
  traktowany jako "spełniony" i praca była cicho pomijana. Naprawa: capture
  realnego zwróconego wyniku + reset `$LASTEXITCODE` przed wywołaniem
- Weryfikacja: po każdej poprawce ponowny live-deploy na VM z pełnym profilem
  (wszystkie sekcje: hostname/locale/timezone/ntp/pagefile/tpm/5 typów
  pakietów/user/firewall enabled/ssh_key/custom scripts run_once+autostart)
  — ostatni przebieg: exit 0, pusty stderr, wszystkie sekcje wykonane
  poprawnie. 64/64 testów jednostkowych (dodano 2 regresyjne na BOM)
- Efekt uboczny: SCP→SFTP fix dotyczy też Linuksa (ten sam kod uploadu),
  choć bug -28 manifestował się tylko na Win32-OpenSSH

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
