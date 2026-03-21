# summary/templates.md — Tera szablony

*Ostatnia aktualizacja: 2026-03-21*

---

## provision.sh.tera (Linux)

Generowany skrypt bash dla Debian/Ubuntu i Alpine 3.18.

Sekcje warunkowe (dis_* = disabled_sections):
- dis_system: hostname, locale, timezone, NTP, swap, GRUB, TPM
- dis_packages: petla per SoftwareItem (name + komendy)
- dis_user: adduser, sudo, SSH authorized_keys
- dis_network: /etc/network/interfaces lub netplan, statyczne IP
- dis_security: UFW, fail2ban, SSH hardening
- custom_scripts: run_once (jednorazowy) lub autostart (cron/rc.local)

Nowe w 2026-03: hostname/locale/timezone owinięte w if-guard:
  - hostname wyswietlany tylko jesli profile.hostname niepuste
  - locale tylko jesli profile.system.locale niepuste
  - timezone tylko jesli profile.system.timezone niepuste

Rozroznienie OS:
- is_alpine: apk zamiast apt, ash zamiast bash, rc-update zamiast systemctl
- is_windows: nigdy (oddzielny szablon)

---

## provision.ps1.tera (Windows)

PowerShell dla Windows Server 2019/2022 i Windows 10/11.

Sekcje:
- dis_system: hostname (Rename-Computer), timezone (Set-TimeZone), NTP (w32tm)
- hostname/timezone owinięte w if-guard (analogicznie do .sh)
- dis_packages: Chocolatey install per item
- dis_user: net user /add, net localgroup Administrators

---

## Zmienna kontekstowa

Profile serializowany do JSON -> Tera context:
- profile.hostname, profile.os
- profile.system.{locale, timezone, ntp, swap_mb, grub_timeout, enable_tpm}
- profile.packages: Vec<SoftwareItem { name, commands }>
- profile.user.{name, sudo, ssh_keys}
- profile.network.{mode, ip, gateway, dns}
- profile.security.{ufw, fail2ban, ssh_port, disable_root}
- profile.custom_scripts: Vec<CustomScript { name, content, mode }>
- dis_system, dis_packages, dis_user, dis_network, dis_security (bool)
- is_alpine, is_windows (bool)
