# ADR-002: Rust Tera zamiast Python Jinja2

Date: 2026-02-22
Status: accepted

## Context

Aplikacja musi generować bash skrypty z szablonów z danymi z profilu użytkownika. Poprzednia wersja (v0.1) używała Python + Jinja2 jako subprocess.

## Options Considered

1. **Python Jinja2 (subprocess)** — wywołanie pythona jako zewnętrznego procesu
   - ✅ Jinja2 jest standardem, dobrze znany
   - ✅ Szablony można importować między projektami
   - ❌ Wymaga Pythona na maszynie użytkownika
   - ❌ Narzut subprocess na każde generowanie
   - ❌ Problemy z ścieżkami i środowiskiem na Windowsie
   - ❌ Dodatkowa zależność do bundlowania lub wymaganie instalacji

2. **Rust Tera** — natywna biblioteka Rust kompatybilna z Jinja2
   - ✅ Brak zewnętrznych zależności runtime
   - ✅ Składnia prawie identyczna z Jinja2 — łatwa migracja szablonów
   - ✅ Szybszy (natywny, bez subprocess)
   - ✅ Wbudowany w binary aplikacji
   - ❌ Nie 100% zgodny z Jinja2 (niektóre filtry mogą się różnić)

## Decision

Rust Tera. Eliminuje zależność od Pythona, co jest krytyczne dla dystrybucji jako instalator desktopowy. Składnia wystarczająco bliska Jinja2 dla naszego use case (bash templates).

## Consequences

- Positive: zero zależności runtime, działa na wszystkich systemach bez konfiguracji
- Negative: jeśli szablony będą bardzo złożone, mogą pojawić się subtelne różnice w składni vs Jinja2
