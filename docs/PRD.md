# PRD — Easix

*Ostatnia aktualizacja: 2026-02-22*

---

## 1. Problem

Konfiguracja i provisioning systemów wymaga dziś głębokiej wiedzy technicznej. Ansible, Puppet, Chef — każde z tych narzędzi ma stromą krzywą uczenia: pliki YAML, inventory, playbooki, role, moduły. Dla administratorów, którzy wiedzą tylko "mam SSH i sudo" — nie ma nic prostego.

**Docelowa luka:** osoba, która potrafi zalogować się przez SSH i wykonać `sudo apt install`, NIE jest w stanie w ciągu godziny skonfigurować narzędzia do powtarzalnego provisioningu 20 maszyn laboratoryjnych.

---

## 2. Rozwiązanie

**Easix** — desktopowa aplikacja GUI do tworzenia profili konfiguracyjnych i wdrażania ich przez SSH.

Użytkownik:
1. Tworzy profil w GUI (hostname, pakiety, użytkownicy, sieć, skrypty)
2. Aplikacja generuje bash script
3. Użytkownik przegląda wygenerowany skrypt (opcjonalnie)
4. Klik "Deploy" → aplikacja łączy się przez SSH, uploaduje i wykonuje skrypt

Output jest zwykłym bash scriptem — przejrzystym, audytowalnym, bez magii.

---

## 3. Użytkownicy docelowi

| Persona | Środowisko | Potrzeba |
|---------|-----------|----------|
| Admin laboratorium (uczelnia) | 10–50 maszyn, Debian/Ubuntu | Powtarzalne provisioning przed zajęciami |
| Admin centrum szkoleniowego | 10–30 maszyn, wymiana config między kursami | Reset/provisioning między kursami |
| IT w małej firmie | 5–20 maszyn dev | Spójność środowisk developerskich |
| Tech lead / DevOps junior | własne potrzeby | Provisioning bez nauki Ansible |

**Poziom wiedzy:** zna SSH, zna sudo, używa Linuxa. Nie zna Ansible, Puppet, Terraform.

---

## 4. MVP — Zakres

### 4.1 Profile

Profil to zestaw konfiguracji dla jednej maszyny lub klasy maszyn:

- **Hostname** — nazwa hosta
- **System** — dystrybucja (Debian/Ubuntu), wersja
- **Pakiety** — lista pakietów do zainstalowania (apt)
- **Użytkownicy** — tworzenie/konfiguracja kont, grupy (w tym sudo)
- **Sieć** — DHCP lub statyczne IP (netplan)
- **Custom scripts** — run_once lub autostart (własny bash inline)

### 4.2 Funkcje

| Funkcja | Priorytet | Opis |
|---------|-----------|------|
| Tworzenie/edycja profilu | MUST | GUI formularz, pola per sekcja |
| Lista profili (dashboard) | MUST | Przegląd, duplikowanie, usuwanie |
| Generowanie bash script | MUST | Tera template → plik .sh |
| Podgląd skryptu | MUST | Readonly preview przed deploy |
| Eksport skryptu | MUST | Zapis .sh na dysk (native dialog) |
| Deploy przez SSH | MUST | Upload skryptu + exec przez SSH |
| Walidacja profilu | SHOULD | Brak pustych wymaganych pól |
| Dry run (shellcheck) | COULD | Walidacja skryptu przed deploy |

### 4.3 Poza MVP (backlog)

- Batch deploy (wiele maszyn jednocześnie z listy CSV)
- Profile templates (predefiniowane: "Lab workstation", "Web server")
- Profile variables (`{{hostname_prefix}}-{{index}}`)
- Import/export profili (ZIP/JSON) — współdzielenie między użytkownikami
- Historia deployów (log: kto, kiedy, co, na jaką maszynę)
- Diff profili (porównanie dwóch wersji)
- Wsparcie dla Red Hat / Rocky / CentOS (dnf)

---

## 5. Model biznesowy

**Per-seat desktop license**
- Jedna licencja = jedna instalacja aplikacji
- Aktywacja przez klucz licencyjny (offline-capable)
- Model: jednorazowy zakup LUB subskrypcja roczna (TBD)

**Dystrybucja:** instalatory natywne (.deb, .AppImage, .msi)

---

## 6. Wymagania niefunkcjonalne

| Wymaganie | Wartość |
|-----------|---------|
| Działanie offline | MUST — po aktywacji licencji |
| Systemy docelowe (UI) | Linux, Windows, macOS |
| Systemy zarządzane | Debian 11/12, Ubuntu 22.04/24.04 |
| Rozmiar instalatora | < 50 MB |
| Czas startu | < 3 sekundy |
| Przechowywanie profili | Lokalnie (`~/.config/easix/profiles/`) |

---

## 7. Wymagania bezpieczeństwa

- Hasła SSH i klucze prywatne NIGDY nie są zapisywane na dysk
- Połączenia SSH tylko inicjowane przez użytkownika (nie w tle, nie automatycznie)
- Generowane skrypty nie zawierają hardkodowanych haseł
- Aplikacja nie zbiera telemetrii bez zgody użytkownika

---

## 8. Definition of Done (MVP)

- [ ] Użytkownik może stworzyć, edytować i usunąć profil
- [ ] Aplikacja generuje poprawny bash script z profilu
- [ ] Użytkownik może wdrożyć profil na zdalną maszynę przez SSH
- [ ] Użytkownik może wyeksportować skrypt do pliku
- [ ] Aplikacja działa offline (bez internetu)
- [ ] Instalator dla Linux (.deb/.AppImage) i Windows (.msi)
