# CLAUDE.md

## Język
Zawsze odpowiadaj po polsku. Kod, komentarze w kodzie i nazwy plików po angielsku.

---

## Inicjalizacja

Jeśli `planning.md` NIE istnieje lub `docs/PRD.md` NIE istnieje:
→ Przeczytaj `.claude/init.md` i wykonaj opisany tam protokół.
→ Po zakończeniu inicjalizacji i /clear, wróć do tego pliku.

---

## Struktura projektu

```
project-root/
├── CLAUDE.md
├── planning.md
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   └── testing-strategy.md
├── summary/
│   └── [category].md
└── .claude/
    ├── init.md
    ├── adr/
    ├── commands/
    ├── skills/
    └── hooks/
```

---

## Wczytywanie kontekstu

Przed każdym zadaniem:
1. Przeczytaj `planning.md` – znajdź aktualne zadanie i wymagane kategorie
2. Załaduj TYLKO pliki summary/ wymienione w polu "Needs:"
3. Nie ładuj innych plików summary bez wyraźnej potrzeby
4. Podaj które pliki załadowałeś przed rozpoczęciem pracy

---

## Przetwarzanie plików

- Czytaj pliki JEDEN PO JEDNYM, nigdy całych katalogów naraz
- Po każdym pliku wyciągnij: cel, kluczowe funkcje/klasy, zależności, TODOs
- Zapisz wnioski do `summary/[category].md` ZANIM przejdziesz do następnego pliku

---

## Dyscyplina zadań

Przed każdym zadaniem:
- Powtórz zadanie w 1–2 zdaniach żeby potwierdzić zrozumienie

Przed implementacją dotykającą >2 plików lub trwającą >15 minut:
1. Zapisz plan do `planning.md` w sekcji `## Proposed Plan`
2. Wymień: co zmienisz, czego NIE zmienisz, ryzyka
3. STOP – czekaj na zatwierdzenie ("go ahead" / "zaczynaj")

---

## Kiedy pytać

STOP i zapytaj gdy:
- Wymaganie ma wiele interpretacji
- Próbowałeś tego samego podejścia dwa razy bez sukcesu
- Masz zmienić więcej niż 3 pliki naraz
- Coś nieoczekiwanego zmienia podejście do zadania
- Operacja jest nieodwracalna

Działaj bez pytania przy:
- Czytaniu plików
- Uruchamianiu testów
- Zapisywaniu do summary/ i planning.md

---

## Protokół gdy utknąłem

Jeśli to samo podejście nie działa dwa razy:
1. Zapisz do `planning.md`:
   - Co próbowałem: ...
   - Dlaczego myślę że nie działa: ...
   - Alternatywne podejścia: [2–3 opcje]
2. STOP – przedstaw to użytkownikowi
3. NIE próbuj alternatyw bez zatwierdzenia

---

## Protokół pewności

- Wysoka (>80%): działaj, zapisz założenia
- Średnia (50–80%): powiedz założenia, zapytaj czy słuszne
- Niska (<50%): STOP, wymień co jest niejasne, zapytaj

Nigdy nie zakładaj po cichu. Zawsze pisz założenia jawnie:
> "Zakładam X ponieważ Y. Kontynuuję jeśli nie powiedzisz inaczej."

---

## Protokół złożonych problemów

Dla decyzji dotyczących architektury, bezpieczeństwa lub trudnych do cofnięcia:
1. Zapisz `## Analysis` do planning.md
2. Wymień min. 2 alternatywne podejścia z plusami/minusami
3. Powiedz które rekomendujeLJ i DLACZEGO
4. STOP – czekaj na zatwierdzenie

---

## Rollback

Przed modyfikacją istniejącego pliku:
1. Zapisz w planning.md: "Modyfikuję [plik] – stan oryginalny zachowany"
2. Napisz co spodziewasz się że się stanie
3. Napisz jak zweryfikujesz że zadziałało
4. Jeśli weryfikacja nie przechodzi: przywróć oryginał, oznacz zadanie jako blocked

---

## Definition of Done

Zadanie jest DONE tylko gdy:
- [ ] Kod działa dla głównej ścieżki
- [ ] Obsłużone edge cases (brak pliku, błąd sieci, pusty input)
- [ ] Testy przechodzą: `[wpisz komendę testów]`
- [ ] planning.md zaktualizowany: status: done, lista zmienionych plików
- [ ] Odpowiedni plik summary/ zaktualizowany
- [ ] Brak cichych TODOs w zmienionym kodzie

Raportuj które checkboxy przeszły, które nie. Nie oznaczaj jako done dopóki wszystkie nie są zaliczone.

---

## Aktualizacja plików

### planning.md – aktualizuj natychmiast gdy:
- Zaczynasz zadanie → status: in-progress
- Zadanie zablokowane → status: blocked, wypełnij pole Blocker
- Zadanie skończone → status: done, lista zmienionych plików

### summary/[category].md – aktualizuj po:
- Przetworzeniu grupy plików (zapisz wnioski zanim przejdziesz dalej)
- Rozwiązaniu nieoczywistego problemu (zapisz rozwiązanie)
- Odkryciu czegoś nieoczekiwanego w kodzie

---

## Zarządzanie sesją

Przed /clear lub końcem sesji:
1. Zaktualizuj planning.md: oznacz skończone zadania, zapisz następny krok
2. Dopisz nowe wnioski do odpowiednich plików summary/
3. Potwierdź: "Kontekst zapisany. Gotowy do wyczyszczenia."

Po /clear:
1. Przeczytaj CLAUDE.md
2. Przeczytaj planning.md – znajdź aktualny status i następny krok
3. Załaduj TYLKO pliki summary/ z pola "Needs:"
4. Wznów od pola "Next step:" w planning.md

---

## Dyscyplina kontekstu

- Nie czytaj całych katalogów naraz
- Po przetworzeniu każdych 5 plików: zapisz wnioski do summary/, poinformuj że kontekst rośnie
- Nie czekaj aż kontekst się zapełni – zarządzaj nim proaktywnie
- Gdy bieżąca faza skończona: zaproponuj /clear

---

## Spójność frameworka

Gdy wymagania się zmieniają, aktualizuj pliki w tej kolejności:
`docs/PRD.md` → `docs/architecture.md` → `planning.md` → `CLAUDE.md`

Jeśli instrukcje między plikami są sprzeczne: STOP i zapytaj o wyjaśnienie.

---

## Dostępne skills
(uzupełniane podczas inicjalizacji projektu)
