import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { DevicePreset, DiscoveredHost, NetworkInterface } from "../types";
import { Select } from "../components/Select";

type ScanMode = "interface" | "preset" | "custom";

const MODES: { id: ScanMode; label: string }[] = [
  { id: "interface", label: "Network interfaces" },
  { id: "preset", label: "Common devices" },
  { id: "custom", label: "Custom range" },
];

function guessDeviceType(host: DiscoveredHost): string {
  if (host.vendor) return host.vendor;
  if (host.open_ports.includes(8291)) return "Likely MikroTik (Winbox port open)";
  if (host.open_ports.includes(3389)) return "Likely Windows (RDP open)";
  if (host.open_ports.includes(22) && !host.open_ports.includes(3389)) return "Likely Linux/Unix (SSH open)";
  return "Unknown device";
}

export default function Discovery() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<ScanMode>("interface");
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [presets, setPresets] = useState<DevicePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [customCidr, setCustomCidr] = useState("192.168.1.0/24");

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<DiscoveredHost[] | null>(null);

  useEffect(() => {
    api.listNetworkInterfaces().then(setInterfaces).catch((e) => setError(String(e)));
    api.listDevicePresets().then((p) => {
      setPresets(p);
      if (p.length > 0) setSelectedPreset(p[0].name);
    });
  }, []);

  const runScan = async (fn: () => Promise<DiscoveredHost[]>) => {
    setScanning(true);
    setError("");
    setResults(null);
    try {
      const hosts = await fn();
      setResults(hosts);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const scanInterface = (iface: NetworkInterface) => runScan(() => api.scanCidr(iface.cidr));

  const scanPreset = () => {
    const preset = presets.find((p) => p.name === selectedPreset);
    if (preset) runScan(() => api.scanHosts(preset.ips));
  };

  const scanCustom = () => runScan(() => api.scanCidr(customCidr.trim()));

  const addAsDevice = (host: DiscoveredHost) => {
    navigate("/devices", {
      state: {
        prefill: {
          name: host.hostname ?? host.vendor ?? host.ip,
          host: host.ip,
          port: host.open_ports.includes(22) ? 22 : host.open_ports[0] ?? 22,
          username: host.open_ports.includes(3389) ? "administrator" : "root",
          description: guessDeviceType(host),
        },
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Discovery</h2>
        <p className="text-surface-200 mt-1 text-sm">
          Find devices on your local network — connected by Ethernet or a USB-Ethernet adapter
        </p>
      </div>

      <div className="bg-amber-900/20 border border-amber-700/40 text-amber-300 p-3 rounded-xl mb-6 text-xs">
        Scanning sends real network traffic (ping + port probes) to every address in range.
        Only scan networks you own or are authorized to test — some firewalls/security tools may flag it.
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-surface-500 mb-5">
        {MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              mode === m.id
                ? "border-primary-500 text-primary-400"
                : "border-transparent text-surface-200 hover:text-surface-100"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Mode body */}
      <div className="bg-surface-800 border border-surface-500 rounded-xl p-5 mb-6">
        {mode === "interface" && (
          <div>
            {interfaces.length === 0 ? (
              <p className="text-sm text-surface-300">No active network interfaces detected.</p>
            ) : (
              <div className="space-y-2">
                {interfaces.map((iface) => (
                  <div key={iface.name} className="flex items-center justify-between border border-surface-500 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-surface-100">{iface.name}</p>
                      <p className="text-xs text-surface-300 font-mono mt-0.5">{iface.ip} — scans {iface.cidr}</p>
                    </div>
                    <button
                      type="button"
                      disabled={scanning}
                      onClick={() => scanInterface(iface)}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-colors"
                    >
                      Scan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mode === "preset" && (
          <div className="flex items-end gap-3 max-w-lg">
            <div className="flex-1">
              <label htmlFor="preset-select" className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-2 block">
                Device type
              </label>
              <Select
                id="preset-select"
                value={selectedPreset}
                onChange={setSelectedPreset}
                options={presets.map((p) => ({ value: p.name, label: p.name }))}
              />
              <p className="text-xs text-surface-300 mt-2 font-mono">
                {presets.find((p) => p.name === selectedPreset)?.ips.join(", ")}
              </p>
            </div>
            <button
              type="button"
              disabled={scanning || !selectedPreset}
              onClick={scanPreset}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-colors"
            >
              Scan
            </button>
          </div>
        )}

        {mode === "custom" && (
          <div className="flex items-end gap-3 max-w-lg">
            <div className="flex-1">
              <label htmlFor="custom-cidr" className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-2 block">
                CIDR range
              </label>
              <input
                id="custom-cidr"
                value={customCidr}
                onChange={(e) => setCustomCidr(e.target.value)}
                placeholder="192.168.1.0/24"
                className="input w-full font-mono"
              />
              <p className="text-xs text-surface-300 mt-2">Minimum /20 (largest allowed range)</p>
            </div>
            <button
              type="button"
              disabled={scanning || !customCidr.trim()}
              onClick={scanCustom}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 hover:bg-primary-500 text-white disabled:opacity-50 transition-colors"
            >
              Scan
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {scanning && (
        <div className="text-center py-16 text-surface-300">
          <p className="flex items-center justify-center gap-2">
            <span className="flex gap-0.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "240ms" }} />
            </span>
            Scanning…
          </p>
        </div>
      )}

      {results !== null && !scanning && (
        results.length === 0 ? (
          <div className="text-center py-16 text-surface-300 border border-dashed border-surface-500 rounded-xl">
            <p className="text-surface-100">No devices found</p>
            <p className="text-sm mt-1">Nothing responded in this range</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-100 mb-1">Found {results.length} device(s)</p>
            {results.map((host) => (
              <div key={host.ip} className="flex items-center justify-between border border-surface-500 rounded-xl p-4 bg-surface-800">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-surface-100">{host.ip}</span>
                    {host.hostname && <span className="text-sm text-surface-300">({host.hostname})</span>}
                  </div>
                  <p className="text-xs text-primary-400 mt-1">{guessDeviceType(host)}</p>
                  <div className="flex gap-3 mt-1.5 text-xs text-surface-300 flex-wrap">
                    {host.mac && <span className="font-mono">{host.mac}</span>}
                    {host.open_ports.length > 0 && (
                      <span>Ports: {host.open_ports.join(", ")}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addAsDevice(host)}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg border border-surface-500 text-surface-100 hover:bg-surface-700 hover:text-white transition-colors flex-shrink-0"
                >
                  Add as device
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
