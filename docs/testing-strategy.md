# Testing Strategy — Easix

*Ostatnia aktualizacja: 2026-02-22*

---

## 1. Podejście

Easix to aplikacja desktopowa z logiką biznesową w Rust. Większość testowania koncentruje się na warstwie Rust (unit + integration), UI testowane manualnie na etapie MVP.

---

## 2. Piramida testów

```
         ┌──────────┐
         │   E2E    │  ← manualne (MVP), automatyczne (post-MVP)
         ├──────────┤
         │Integracyj│  ← Rust: SSH mock, plik I/O
         ├──────────┤
         │  Unitowe │  ← Rust: modele, generator, parsowanie
         └──────────┘
```

---

## 3. Testy jednostkowe (Rust)

Uruchamianie: `cargo test` w katalogu `src-tauri/`

### Moduł `models.rs`
- Serializacja/deserializacja profilu (serde_json roundtrip)
- Walidacja: pusty hostname → błąd
- Walidacja: niepoprawny adres IP → błąd
- Walidacja: pusta lista pakietów → OK (opcjonalne)

### Moduł `generator.rs`
- Profil z samym hostname → poprawny skrypt (tylko hostname section)
- Profil z pakietami → skrypt zawiera `apt-get install`
- Profil ze statycznym IP → skrypt zawiera `netplan`
- Profil z użytkownikiem → skrypt zawiera `useradd` i `usermod`
- Profil z custom script run_once → skrypt zawiera sekcję custom
- Generowanie nie panics dla edge cases (puste opcjonalne pola)

### Moduł `profiles.rs`
- save_profile → plik JSON istnieje po zapisie
- get_profile → odczytany profil = zapisany profil
- list_profiles → zwraca nazwy bez rozszerzenia .json
- delete_profile → plik usunięty po wywołaniu
- get_profile dla nieistniejącego → zwraca błąd

---

## 4. Testy integracyjne (Rust)

### Generator + szablon
- Wygenerowany skrypt przechodzi przez shellcheck (jeśli dostępny)
- Składnia skryptu jest poprawnym bash (bash -n)

### Profiles + filesystem
- CRUD pełny cykl: create → read → update → delete
- Równoległe zapisy nie powodują korupcji

---

## 5. Testy manualne (MVP)

Checklisty wykonywane przed każdym release:

### Dashboard
- [ ] Lista profili wyświetla się poprawnie (pusta, jeden profil, wiele)
- [ ] Klik "New" przechodzi do edytora
- [ ] Klik profilu przechodzi do edytora z załadowanymi danymi
- [ ] Duplikowanie profilu działa
- [ ] Usunięcie profilu działa (z potwierdzeniem)

### Edytor
- [ ] Wszystkie pola formularza zapisują się poprawnie
- [ ] Walidacja pokazuje błędy dla wymaganych pól
- [ ] Dodawanie/usuwanie pakietów
- [ ] Dodawanie/usuwanie użytkowników
- [ ] Przełączanie sieć DHCP ↔ statyczne IP
- [ ] Custom script — dodawanie, edycja, usunięcie

### Preview
- [ ] Wygenerowany skrypt wyświetla się
- [ ] Eksport skryptu otwiera natywny dialog
- [ ] Plik .sh zapisuje się w wybranej lokalizacji

### Deploy
- [ ] Połączenie SSH z hasłem działa
- [ ] Połączenie SSH z kluczem prywatnym działa
- [ ] Błąd połączenia jest czytelnie pokazany użytkownikowi
- [ ] Postęp wykonania skryptu wyświetla się w UI
- [ ] Sukces/błąd deploy jest sygnalizowany

---

## 6. Środowisko testowe

Do testowania SSH deploy:
- Lokalna VM (Vagrant, VirtualBox) z Debian 12
- Docker container z openssh-server (dla szybkich testów)

```bash
# Szybki kontener SSH do testów
docker run -d -p 2222:22 \
  -e USER_NAME=test -e USER_PASSWORD=test \
  linuxserver/openssh-server
```

---

## 7. CI (post-MVP)

```yaml
# GitHub Actions
- cargo test (unit + integration)
- cargo clippy -- -D warnings
- cargo fmt -- --check
- shellcheck na wygenerowanych skryptach (snapshot test)
```

---

## 8. Komenda testów (bieżąca)

```bash
# Backend
wsl -e bash -c "cd /home/projekty/easix/src-tauri && cargo test"

# Frontend (brak testów w MVP, placeholder)
npm test
```
