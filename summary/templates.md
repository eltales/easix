# summary/templates.md — Tera szablony

---

### Struktura wygenerowanego skryptu
Added: 2026-02-22 | Task: init

Na podstawie przykładu `LLL.sh`:

1. **Header** — komentarz z nazwą maszyny, dystrybucją, datą
2. **Hostname** — `hostnamectl set-hostname "{{hostname}}"`
3. **Update** — `export DEBIAN_FRONTEND=noninteractive && apt-get update -qq`
4. **Packages** — `apt-get install -y -qq \\ {% for pkg in packages %}  {{pkg}} \\ {% endfor %}`
5. **Users** — dla każdego usera: `useradd -m -s /bin/bash`, `usermod -aG`
6. **Network** — jeśli static: zapis do `/etc/netplan/01-easix.yaml` + `netplan apply`
7. **Custom scripts** — inline bash per skrypt
8. **Footer** — `echo "=== Easix provisioning completed ==="`

---

### Uwagi o składni Tera
Added: 2026-02-22 | Task: init

- `{% if network.mode == "Static" %}` — warunek
- `{% for pkg in packages %}` — pętla
- `{{ variable }}` — interpolacja
- Tera jest prawie w 100% kompatybilny z Jinja2 dla tego use case
- Szablon w: `src-tauri/templates/provision.sh.tera`
- Ładowanie szablonu: `tera::Tera::new()` lub `tera::Tera::one_off()` dla prostych przypadków

---
