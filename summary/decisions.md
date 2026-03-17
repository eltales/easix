# summary/decisions.md — Kluczowe decyzje

---

### Stack technologiczny
Added: 2026-02-22 | Task: init

- **Tauri 2 + Rust + React** — desktop app, offline, mały instalator
- Pełna dokumentacja w ADR: `.claude/adr/001`, `002`, `003`
- Nie SaaS — użytkownicy (admini lab, centra szkoleniowe) często w izolowanych sieciach

---

### Model biznesowy
Added: 2026-02-22 | Task: init

- **Per-seat desktop license** — jedna licencja = jedna instalacja
- Aktywacja offline (klucz licencyjny) — do zaimplementowania po MVP
- Format instalatora: .deb/.AppImage (Linux), .msi (Windows)
- Mechanizm update: Tauri built-in updater (wymaga code signing certificate)

---

### Pozycjonowanie produktu
Added: 2026-02-22 | Task: init

- Gap: Ansible jest za skomplikowany dla osób które "znają tylko SSH + sudo"
- Target: 10–50 maszyn, Debian/Ubuntu, admin z podstawową wiedzą Linuxa
- Przewaga: GUI zamiast YAML/pliki inventory, output to przejrzysty bash (audytowalny)
- Backlog (nie MVP): batch deploy, profile variables, import/export, historia deployów

---
