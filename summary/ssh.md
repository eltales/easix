# summary/ssh.md — SSH Deploy

---

### Plan modułu deploy
Added: 2026-02-22 | Task: init

- Crate: `ssh2` (Rust)
- Plik: `src-tauri/src/commands/deploy.rs`
- Tauri command: `deploy_ssh(host, port, user, auth, script) → DeployResult`

---

### Schemat działania
Added: 2026-02-22 | Task: init

1. TCP connect do `host:port`
2. SSH handshake
3. Autentykacja: hasło (`session.userauth_password()`) lub klucz (`session.userauth_pubkey_memory()`)
4. SFTP upload skryptu do `/tmp/easix_provision_<timestamp>.sh`
5. Exec channel: `chmod +x /tmp/easix_provision_<timestamp>.sh && sudo /tmp/easix_provision_<timestamp>.sh`
6. Streaming stdout/stderr przez Tauri events (`emit("deploy_output", line)`)
7. Cleanup: `rm /tmp/easix_provision_<timestamp>.sh`
8. Zwróć `DeployResult { success, exit_code, output }`

---

### Bezpieczeństwo
Added: 2026-02-22 | Task: init

- Hasła i klucze NIGDY nie są zapisywane — przekazywane tylko przez pamięć w runtime
- Połączenia SSH tylko na żądanie użytkownika (klik "Deploy")
- Skrypt tymczasowy na zdalnej maszynie usuwany po wykonaniu
- Walidacja host:port przed połączeniem (żeby nie crashować na złym input)

---
