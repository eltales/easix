# summary/frontend.md — Easix Frontend (React)

---

### Stan rzeczywisty — feature-complete
Added: 2026-02-22 | Task: TASK-005..008 done

- `npm run build` → OK (777ms, 200kB JS gzip 62kB)
- Tailwind `primary` kolory zdefiniowane (blue-600 palette) w tailwind.config.js
- Routing: `/` Dashboard, `/editor` new, `/editor/:name` edit, `/preview`, `/deploy`
- Przekazywanie profilu między stronami: `sessionStorage.setItem("easix_preview_profile", name)` i `"easix_deploy_profile"`

---

### Dashboard — kluczowe szczegóły
Added: 2026-02-22 | Task: TASK-006

- Grid kart (1/2/3 kolumny responsive), każda karta: nazwa + 4 przyciski (Edit, Duplicate, Preview, Delete)
- Duplicate: auto-suffix `_01`, `_02`... (sprawdza collisions)
- Delete: `window.confirm()` przed usunięciem
- Error state + loading state

---

### Editor — kluczowe szczegóły
Added: 2026-02-22 | Task: TASK-007

- Tryby: New Profile / Edit: {name} / Duplicate Profile (via `?duplicate=true` query param)
- Rename inline: jeśli name zmieniony → `renameProfile(old, new)` + `saveProfile(new, data)`
- Sekcje: System, Software, User, Network, Security, Autostart, Scripts
- Disable/enable sekcji: checkbox, sekcja szara (opacity-40 + pointer-events-none), dane zachowane
- Software tab: common packages grid (Debian vs Alpine warianty) + custom pkg input (Enter lub Add)
- Scripts tab: lista edytowalnych skryptów (name + mode select + textarea), badge z liczbą

---

### Preview + Deploy — kluczowe szczegóły
Added: 2026-02-22 | Task: TASK-008

- Preview: select profil → generate + validate równolegle (Promise.all) → wyświetl warnings + script
- Przyciski: Copy to clipboard, Save as .sh, Deploy via SSH (redirect z sessionStorage)
- Deploy: `usePersistedState` (sessionStorage) dla wszystkich pól formularza
- Deploy history: localStorage, max 50 wpisów, accordion expand/collapse, success/fail dot

---
