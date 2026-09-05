use serde::Serialize;
use std::collections::HashMap;
use std::net::{Ipv4Addr, TcpStream, ToSocketAddrs};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// CREATE_NO_WINDOW — without this, every `ping`/`arp`/`nslookup` child
/// process spawned from a GUI (non-console) app pops up its own console
/// window. A range scan spawns one per host, so a /24 scan opened ~250
/// windows before this fix.
#[cfg(windows)]
fn new_command(program: &str) -> Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
fn new_command(program: &str) -> Command {
    Command::new(program)
}

/// Smallest subnet we'll scan (host-bit count), i.e. largest allowed range.
/// /20 = 4094 usable hosts — enough for any realistic LAN, small enough to
/// finish in a reasonable time and not look like a port-scanning attack.
const MIN_PREFIX_LEN: u8 = 20;

const DEFAULT_SCAN_PORTS: [u16; 7] = [22, 23, 80, 443, 3389, 8291, 5985];

const PING_TIMEOUT: Duration = Duration::from_millis(600);
const PORT_TIMEOUT: Duration = Duration::from_millis(350);
const NSLOOKUP_TIMEOUT: Duration = Duration::from_millis(800);

// A curated (non-exhaustive) subset of IEEE OUI prefixes for vendors whose
// gear commonly shows up during LAN discovery. Best-effort identification,
// not an authoritative database — will drift out of date over time.
const OUI_VENDORS: &[(&str, &str)] = &[
    ("48:8F:5A", "MikroTik"),
    ("4C:5E:0C", "MikroTik"),
    ("64:D1:54", "MikroTik"),
    ("6C:3B:6B", "MikroTik"),
    ("D4:CA:6D", "MikroTik"),
    ("E4:8D:8C", "MikroTik"),
    ("B8:27:EB", "Raspberry Pi Foundation"),
    ("DC:A6:32", "Raspberry Pi Foundation"),
    ("E4:5F:01", "Raspberry Pi Foundation"),
    ("28:CD:C1", "Raspberry Pi Foundation"),
    ("D8:3A:DD", "Raspberry Pi Foundation"),
    ("24:A4:3C", "Ubiquiti Networks"),
    ("74:83:C2", "Ubiquiti Networks"),
    ("78:8A:20", "Ubiquiti Networks"),
    ("DC:9F:DB", "Ubiquiti Networks"),
    ("F0:9F:C2", "Ubiquiti Networks"),
    ("50:C7:BF", "TP-Link"),
    ("A4:2B:B0", "TP-Link"),
    ("EC:08:6B", "TP-Link"),
    ("F4:F2:6D", "TP-Link"),
    ("1C:61:B4", "D-Link"),
    ("C8:D3:A3", "D-Link"),
    ("A0:04:60", "Netgear"),
    ("E0:46:9A", "Netgear"),
    ("2C:B0:5D", "Espressif (ESP32/ESP8266)"),
    ("30:AE:A4", "Espressif (ESP32/ESP8266)"),
    ("84:CC:A8", "Espressif (ESP32/ESP8266)"),
    ("A4:CF:12", "Espressif (ESP32/ESP8266)"),
    ("00:1A:11", "Google"),
    ("F4:F5:D8", "Google"),
    ("44:65:0D", "Amazon"),
    ("74:C2:46", "Amazon"),
    ("00:11:32", "Synology"),
    ("00:08:9B", "QNAP"),
    ("00:1C:B3", "Apple"),
    ("AC:DE:48", "Apple"),
    ("F0:18:98", "Apple"),
    ("00:0C:29", "VMware"),
    ("00:50:56", "VMware"),
    ("08:00:27", "VirtualBox"),
    ("00:15:5D", "Hyper-V"),
];

#[derive(Debug, Clone, Serialize)]
pub struct NetworkInterface {
    pub name: String,
    pub ip: String,
    pub prefix_len: u8,
    pub cidr: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct DiscoveredHost {
    pub ip: String,
    pub mac: Option<String>,
    pub vendor: Option<String>,
    pub open_ports: Vec<u16>,
    pub hostname: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DevicePreset {
    pub name: String,
    pub ips: Vec<String>,
}

#[tauri::command]
pub fn list_network_interfaces() -> Result<Vec<NetworkInterface>, String> {
    let addrs = if_addrs::get_if_addrs().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for iface in addrs {
        if iface.is_loopback() {
            continue;
        }
        if let if_addrs::IfAddr::V4(v4) = iface.addr {
            let prefix_len = netmask_to_prefix_len(v4.netmask);
            if prefix_len == 0 {
                continue;
            }
            let network = u32::from(v4.ip) & u32::from(v4.netmask);
            out.push(NetworkInterface {
                name: iface.name,
                ip: v4.ip.to_string(),
                prefix_len,
                cidr: format!("{}/{}", Ipv4Addr::from(network), prefix_len),
            });
        }
    }
    Ok(out)
}

fn netmask_to_prefix_len(mask: Ipv4Addr) -> u8 {
    u32::from(mask).count_ones() as u8
}

#[tauri::command]
pub fn list_device_presets() -> Vec<DevicePreset> {
    vec![
        DevicePreset { name: "MikroTik (RouterOS)".into(), ips: vec!["192.168.88.1".into()] },
        DevicePreset { name: "TP-Link".into(), ips: vec!["192.168.0.1".into(), "192.168.1.1".into()] },
        DevicePreset { name: "Ubiquiti (UniFi/EdgeOS)".into(), ips: vec!["192.168.1.20".into(), "192.168.1.1".into()] },
        DevicePreset { name: "D-Link".into(), ips: vec!["192.168.0.1".into()] },
        DevicePreset { name: "Netgear".into(), ips: vec!["192.168.1.1".into(), "192.168.0.1".into()] },
        DevicePreset { name: "Generic home router".into(), ips: vec!["192.168.1.1".into(), "192.168.0.1".into(), "10.0.0.1".into()] },
    ]
}

fn parse_cidr(cidr: &str) -> Result<Vec<Ipv4Addr>, String> {
    let (ip_str, prefix_str) = cidr
        .split_once('/')
        .ok_or_else(|| "Expected CIDR format, e.g. 192.168.1.0/24".to_string())?;
    let ip: Ipv4Addr = ip_str
        .trim()
        .parse()
        .map_err(|_| format!("Invalid IP address: {ip_str}"))?;
    let prefix: u8 = prefix_str
        .trim()
        .parse()
        .map_err(|_| format!("Invalid prefix length: {prefix_str}"))?;
    if prefix > 32 {
        return Err("Prefix length must be between 0 and 32".into());
    }
    if prefix < MIN_PREFIX_LEN {
        return Err(format!(
            "Range too large — use at least a /{MIN_PREFIX_LEN} (narrower CIDR)"
        ));
    }

    let host_bits = 32 - prefix as u32;
    let network = u32::from(ip) & (!0u32).checked_shl(host_bits).unwrap_or(0);
    let host_count = 1u32 << host_bits;

    // Skip the network and broadcast addresses for anything bigger than a /31.
    let (first, last) = if host_bits == 0 {
        (0, 0)
    } else {
        (1, host_count.saturating_sub(2))
    };

    Ok((first..=last).map(|i| Ipv4Addr::from(network + i)).collect())
}

fn ping_alive(ip: &str) -> bool {
    #[cfg(windows)]
    let (program, args): (&str, Vec<String>) = (
        "ping",
        vec!["-n".into(), "1".into(), "-w".into(), PING_TIMEOUT.as_millis().to_string(), ip.into()],
    );
    #[cfg(not(windows))]
    let (program, args): (&str, Vec<String>) = (
        "ping",
        vec!["-c".into(), "1".into(), "-W".into(), "1".into(), ip.into()],
    );

    new_command(program)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn scan_ports(ip: &str, ports: &[u16]) -> Vec<u16> {
    let mut open = Vec::new();
    for &port in ports {
        let addr = format!("{ip}:{port}");
        if let Ok(mut socket_addrs) = addr.to_socket_addrs() {
            if let Some(a) = socket_addrs.next() {
                if TcpStream::connect_timeout(&a, PORT_TIMEOUT).is_ok() {
                    open.push(port);
                }
            }
        }
    }
    open
}

/// Runs a short-lived command with a hard wall-clock timeout, killing it if
/// it doesn't exit in time (e.g. `nslookup` against an unreachable DNS
/// server can otherwise hang for many seconds).
fn run_capture_with_timeout(program: &str, args: &[&str], timeout: Duration) -> Option<String> {
    let mut child = new_command(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child.wait_with_output().ok()?;
                return Some(String::from_utf8_lossy(&output.stdout).into_owned());
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(30));
            }
            Err(_) => return None,
        }
    }
}

fn reverse_hostname(ip: &str) -> Option<String> {
    let output = run_capture_with_timeout("nslookup", &[ip], NSLOOKUP_TIMEOUT)?;
    parse_nslookup_hostname(&output)
}

fn parse_nslookup_hostname(output: &str) -> Option<String> {
    for line in output.lines() {
        let lower = line.to_ascii_lowercase();
        // Windows: "Name:    host.local"  /  Linux: "...arpa    name = host.local."
        let marker = if lower.contains("name =") {
            "name ="
        } else if lower.contains("name:") {
            "name:"
        } else {
            continue;
        };
        if let Some(idx) = lower.find(marker) {
            let name = line[idx + marker.len()..].trim().trim_end_matches('.');
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn looks_like_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 4 && parts.iter().all(|p| p.parse::<u8>().is_ok())
}

fn looks_like_mac(s: &str) -> bool {
    let cleaned = s.replace('-', ":");
    let parts: Vec<&str> = cleaned.split(':').collect();
    parts.len() == 6 && parts.iter().all(|p| p.len() == 2 && p.chars().all(|c| c.is_ascii_hexdigit()))
}

/// Reads the OS's ARP/neighbor cache (`arp -a`, available on both Windows
/// and Linux) to map IPs we just talked to onto MAC addresses. Best-effort:
/// only works for hosts on the same L2 segment, and if `arp` isn't
/// installed the map is simply empty — MAC/vendor stay unset.
fn read_arp_table() -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Some(output) = run_capture_with_timeout("arp", &["-a"], Duration::from_secs(2)) else {
        return map;
    };
    for line in output.lines() {
        let tokens: Vec<&str> = line.split_whitespace().collect();
        let ip = tokens.iter().find(|t| looks_like_ipv4(t));
        let mac = tokens.iter().find(|t| looks_like_mac(t));
        if let (Some(ip), Some(mac)) = (ip, mac) {
            let normalized = mac.replace('-', ":").to_ascii_uppercase();
            map.insert(ip.to_string(), normalized);
        }
    }
    map
}

fn lookup_vendor(mac: &str) -> Option<String> {
    let prefix = mac.get(0..8)?; // "AA:BB:CC"
    OUI_VENDORS
        .iter()
        .find(|(p, _)| p.eq_ignore_ascii_case(prefix))
        .map(|(_, vendor)| vendor.to_string())
}

async fn scan_ip_list(ips: Vec<Ipv4Addr>, ports: Vec<u16>) -> Vec<DiscoveredHost> {
    let mut handles = Vec::with_capacity(ips.len());
    for ip in ips {
        let ports = ports.clone();
        handles.push(tauri::async_runtime::spawn_blocking(move || {
            let ip_str = ip.to_string();
            let alive = ping_alive(&ip_str);
            let open_ports = scan_ports(&ip_str, &ports);
            if alive || !open_ports.is_empty() {
                Some((ip_str, open_ports))
            } else {
                None
            }
        }));
    }

    let mut alive_hosts = Vec::new();
    for handle in handles {
        if let Ok(Some(result)) = handle.await {
            alive_hosts.push(result);
        }
    }

    if alive_hosts.is_empty() {
        return Vec::new();
    }

    let arp_table = tauri::async_runtime::spawn_blocking(read_arp_table)
        .await
        .unwrap_or_default();

    let mut hostname_handles = Vec::with_capacity(alive_hosts.len());
    for (ip, _) in &alive_hosts {
        let ip = ip.clone();
        hostname_handles.push(tauri::async_runtime::spawn_blocking(move || {
            (ip.clone(), reverse_hostname(&ip))
        }));
    }
    let mut hostnames = HashMap::new();
    for handle in hostname_handles {
        if let Ok((ip, name)) = handle.await {
            if let Some(name) = name {
                hostnames.insert(ip, name);
            }
        }
    }

    alive_hosts
        .into_iter()
        .map(|(ip, open_ports)| {
            let mac = arp_table.get(&ip).cloned();
            let vendor = mac.as_deref().and_then(lookup_vendor);
            let hostname = hostnames.get(&ip).cloned();
            DiscoveredHost { ip, mac, vendor, open_ports, hostname }
        })
        .collect()
}

#[tauri::command]
pub async fn scan_cidr(cidr: String, ports: Option<Vec<u16>>) -> Result<Vec<DiscoveredHost>, String> {
    let ips = parse_cidr(&cidr)?;
    let ports = ports.unwrap_or_else(|| DEFAULT_SCAN_PORTS.to_vec());
    Ok(scan_ip_list(ips, ports).await)
}

#[tauri::command]
pub async fn scan_hosts(ips: Vec<String>, ports: Option<Vec<u16>>) -> Result<Vec<DiscoveredHost>, String> {
    let parsed: Vec<Ipv4Addr> = ips
        .iter()
        .map(|s| s.parse::<Ipv4Addr>().map_err(|_| format!("Invalid IP address: {s}")))
        .collect::<Result<_, _>>()?;
    let ports = ports.unwrap_or_else(|| DEFAULT_SCAN_PORTS.to_vec());
    Ok(scan_ip_list(parsed, ports).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_cidr_slash_24() {
        let ips = parse_cidr("192.168.1.0/24").unwrap();
        assert_eq!(ips.len(), 254);
        assert_eq!(ips[0], Ipv4Addr::new(192, 168, 1, 1));
        assert_eq!(ips[253], Ipv4Addr::new(192, 168, 1, 254));
    }

    #[test]
    fn test_parse_cidr_rejects_too_large_range() {
        assert!(parse_cidr("10.0.0.0/8").is_err());
    }

    #[test]
    fn test_parse_cidr_rejects_invalid_ip() {
        assert!(parse_cidr("not-an-ip/24").is_err());
    }

    #[test]
    fn test_parse_cidr_rejects_missing_prefix() {
        assert!(parse_cidr("192.168.1.1").is_err());
    }

    #[test]
    fn test_parse_cidr_slash_30_skips_network_and_broadcast() {
        let ips = parse_cidr("192.168.1.0/30").unwrap();
        assert_eq!(ips, vec![Ipv4Addr::new(192, 168, 1, 1), Ipv4Addr::new(192, 168, 1, 2)]);
    }

    #[test]
    fn test_looks_like_ipv4() {
        assert!(looks_like_ipv4("192.168.1.1"));
        assert!(!looks_like_ipv4("not.an.ip.address"));
        assert!(!looks_like_ipv4("aa:bb:cc:dd:ee:ff"));
    }

    #[test]
    fn test_looks_like_mac_both_separators() {
        assert!(looks_like_mac("AA:BB:CC:DD:EE:FF"));
        assert!(looks_like_mac("aa-bb-cc-dd-ee-ff"));
        assert!(!looks_like_mac("192.168.1.1"));
        assert!(!looks_like_mac("AA:BB:CC"));
    }

    #[test]
    fn test_lookup_vendor_known_prefix() {
        assert_eq!(lookup_vendor("B8:27:EB:11:22:33").as_deref(), Some("Raspberry Pi Foundation"));
        assert_eq!(lookup_vendor("48:8F:5A:11:22:33").as_deref(), Some("MikroTik"));
    }

    #[test]
    fn test_lookup_vendor_unknown_prefix() {
        assert_eq!(lookup_vendor("00:00:00:11:22:33"), None);
    }

    #[test]
    fn test_parse_nslookup_hostname_windows_style() {
        let output = "Server:  UnKnown\nAddress:  10.0.0.1\n\nName:    myhost.local\nAddress:  192.168.1.50\n";
        assert_eq!(parse_nslookup_hostname(output).as_deref(), Some("myhost.local"));
    }

    #[test]
    fn test_parse_nslookup_hostname_linux_style() {
        let output = "50.1.168.192.in-addr.arpa       name = myhost.local.\n";
        assert_eq!(parse_nslookup_hostname(output).as_deref(), Some("myhost.local"));
    }

    #[test]
    fn test_parse_nslookup_hostname_missing() {
        let output = "Server:  UnKnown\n** server can't find 1.1.168.192.in-addr.arpa: NXDOMAIN\n";
        assert_eq!(parse_nslookup_hostname(output), None);
    }

    #[test]
    fn test_netmask_to_prefix_len() {
        assert_eq!(netmask_to_prefix_len(Ipv4Addr::new(255, 255, 255, 0)), 24);
        assert_eq!(netmask_to_prefix_len(Ipv4Addr::new(255, 255, 0, 0)), 16);
    }
}
