# .claude/init.md – Project Initialization Protocol

> Ten plik jest używany TYLKO przy pierwszym uruchomieniu projektu.
> Po zakończeniu inicjalizacji i /clear nie jest już ładowany.

---

## Phase 1: Discovery

Zadawaj pytania JEDNO PO JEDNYM. Czekaj na odpowiedź przed następnym.
Po każdej odpowiedzi: podsumuj co zrozumiałeś, zapytaj "czy dobrze rozumiem?"

1. Jaki jest cel projektu w jednym zdaniu?
2. Jaki problem rozwiązuje?
3. Kto będzie używał / w jakim środowisku będzie działać?
4. Jakie technologie są preferowane lub wymagane?
5. Co już istnieje? (istniejący kod, infrastruktura, ograniczenia)
6. Jak wygląda "gotowe" dla pierwszej wersji?
7. Czy są twarde ograniczenia? (bezpieczeństwo, brak internetu, brak roota, itp.)

Nie zadawaj wszystkich pytań naraz.

---

## Phase 2: Build Project Structure

Tylko po tym jak wszystkie pytania zostały odpowiedziane i potwierdzone:

1. Utwórz `docs/PRD.md` z zebranych odpowiedzi
2. Utwórz `docs/architecture.md` z 2–3 proponowanymi podejściami
   - STOP: przedstaw podejścia, czekaj na wybór użytkownika
3. Utwórz wpisy ADR w `.claude/adr/` dla kluczowych decyzji architektonicznych
4. Utwórz `planning.md` z pierwszymi zadaniami podzielonymi na fazy
5. Utwórz katalog `summary/` z odpowiednimi pustymi plikami kategorii
6. Utwórz `.claude/skills/` dla powtarzalnych workflow które zidentyfikowałeś
7. Zaktualizuj sekcję `## Dostępne skills` w CLAUDE.md

### Format wpisu planning.md:
```
### TASK-[numer]: [krótka nazwa]
- Status: [ pending | in-progress | blocked | done ]
- Goal: [jedno zdanie]
- Needs: summary/[kategoria].md, summary/[kategoria].md
- Skip: [kategorie niepotrzebne]
- Blocker: -
- Next step: [konkretny następny krok]
- Modified files: -
```

### Format wpisu summary/[kategoria].md:
```
### [temat]
Added: [data] | Task: TASK-[numer]
- [wniosek 1]
- [wniosek 2]
- [wniosek 3 max]
---
```

### Format wpisu .claude/adr/[numer]-[nazwa].md:
```
# ADR-[numer]: [tytuł decyzji]
Date: [data]
Status: accepted

## Context
[Dlaczego ta decyzja była potrzebna]

## Options Considered
1. [opcja A] – plusy/minusy
2. [opcja B] – plusy/minusy

## Decision
[Co wybrano i dlaczego]

## Consequences
- Positive: ...
- Negative: ...
```

---

## Phase 3: Context Reset

Po zbudowaniu kompletnej struktury:
1. Wylistuj użytkownikowi wszystkie utworzone pliki
2. Powiedz: "Struktura gotowa. Czyszczę kontekst żeby zacząć implementację z czystym oknem. Cały kontekst zapisany w plikach projektu."
3. Wykonaj /clear

---

## Phase 4: Resume After Clear

Po /clear:
1. Przeczytaj CLAUDE.md
2. Przeczytaj planning.md – znajdź pierwsze zadanie ze statusem pending
3. Załaduj TYLKO pliki summary/ wymienione w polu "Needs:"
4. Rozpocznij pierwsze zadanie zgodnie z CLAUDE.md
