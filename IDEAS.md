# IDEAS.md — Easix

## Zaimplementowane
- [ ] Custom Scripts (run_once / autostart)
- [ ] Duplikowanie profilu + rename w edytorze
- [ ] Dry run / validation (shellcheck, walidacja pakietów)

## Do rozważenia
- Profile templates — predefiniowane profile ("Lab workstation", "Web server", "Dev machine") jako punkt startowy
- Batch deploy — deploy na wiele maszyn jednocześnie (lista hostów CSV/ręcznie)
- Profile variables — zmienne typu `{{hostname_prefix}}-{{index}}` do generowania wariantów (lab01, lab02, lab03...)
- Import/Export profili — udostępnianie profili między użytkownikami (ZIP/JSON)
- Historia deployów — log kto, kiedy, na jaką maszynę
- Diff profili — porównanie dwóch profili obok siebie
