# ADR-003: JSON pliki zamiast SQLite

Date: 2026-02-22
Status: accepted

## Context

Profile konfiguracyjne muszą być gdzieś przechowywane. Do wyboru: pliki JSON per profil, lub baza danych SQLite.

## Options Considered

1. **SQLite** — jedna baza danych dla wszystkich profili
   - ✅ Atomowe transakcje, brak korupcji przy równoległym zapisie
   - ✅ Łatwe filtrowanie/sortowanie przy dużej liczbie profili
   - ❌ Trudne do edycji ręcznie (binarny format)
   - ❌ Trudniejsze do backupu i wersjonowania (git)
   - ❌ Dodatkowa zależność (rusqlite crate)
   - ❌ Over-engineering dla <1000 profili

2. **JSON pliki (jeden per profil)** — `~/.config/easix/profiles/<name>.json`
   - ✅ Czytelne i edytowalne ręcznie
   - ✅ Łatwe do backupu (cp) i wersjonowania (git)
   - ✅ Import/export profili = kopiowanie pliku
   - ✅ Zero dodatkowych zależności
   - ❌ Brak transakcji — edge case korupcji przy crash w trakcie zapisu
   - ❌ Może być wolne przy >1000 profilach (irrelevant dla naszego use case)

## Decision

JSON pliki. Użytkownicy Easix (admin lab, centrum szkoleniowe) będą mieć 5–50 profili maksymalnie. JSON jest prostszy, czytelniejszy i łatwiejszy do debugowania.

Mitygacja ryzyka korupcji: write-to-temp-then-rename atomicznie.

## Consequences

- Positive: prostota, brak dodatkowych zależności, czytelność
- Negative: przy write crash możliwa korupcja pliku (mitygowane przez atomic rename)
