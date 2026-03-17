# ADR-001: Tauri zamiast Electron

Date: 2026-02-22
Status: accepted

## Context

Potrzebujemy cross-platform frameworka do aplikacji desktopowej z widokiem webowym (React) i dostępem do systemu plików, SSH, natywnych dialogów.

## Options Considered

1. **Electron** — sprawdzony, ogromna społeczność, łatwy development
   - ✅ Największy ekosystem, mnóstwo przykładów
   - ✅ Node.js backend — JavaScript fullstack
   - ❌ Instalator 100–200 MB (bundluje Chromium + Node)
   - ❌ Wysoki RAM overhead (~200MB baseline)
   - ❌ Bezpieczeństwo: Node.js ma dostęp do wszystkiego domyślnie

2. **Tauri 2** — nowoczesny, oparty na natywnym webview systemu operacyjnego
   - ✅ Instalator 10–15 MB
   - ✅ Niski RAM (~50MB baseline)
   - ✅ Rust backend — bezpieczeństwo pamięci, wydajność
   - ✅ Model uprawnień (capabilities) — minimalne uprawnienia domyślnie
   - ✅ Aktywnie rozwijany, dobra dokumentacja
   - ❌ Mniejsza społeczność niż Electron
   - ❌ Rust learning curve

## Decision

Tauri 2. Dla produktu komercyjnego: mały instalator i niskie zużycie zasobów to zalety marketingowe. Rust backend daje bezpieczeństwo przy operacjach SSH.

## Consequences

- Positive: mały instalator, szybki start, bezpieczny backend
- Negative: Rust jest wymagany dla logiki biznesowej — wolniejszy development jeśli dev nie zna Rust
