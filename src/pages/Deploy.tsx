import { useEffect, useState } from "react";
import { api } from "../api";
import { Device } from "../types";
import BatchDeploy from "./BatchDeploy";

interface DeployEntry {
  profile: string;
  device_name?: string;
  host: string;
  port: string;
  username: string;
  date: string;
  success: boolean;
  output: string;
}

function usePersistedState(key: string, initial: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => sessionStorage.getItem(key) ?? initial);
  const set = (v: string) => {
    setValue(v);
    sessionStorage.setItem(key, v);
  };
  return [value, set];
}

function loadHistory(): DeployEntry[] {
  try {
    return JSON.parse(localStorage.getItem("easix_deploy_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: DeployEntry[]) {
  localStorage.setItem("easix_deploy_history", JSON.stringify(entries.slice(0, 50)));
}

export default function Deploy() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = usePersistedState("easix_deploy_profile", "");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [host, setHost] = usePersistedState("easix_deploy_host", "");
  const [port, setPort] = usePersistedState("easix_deploy_port", "22");
  const [username, setUsername] = usePersistedState("easix_deploy_user", "root");
  const [password, setPassword] = usePersistedState("easix_deploy_pass", "");
  const [keyPath, setKeyPath] = usePersistedState("easix_deploy_key", "");
  const [output, setOutput] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<DeployEntry[]>(loadHistory);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [showBatch, setShowBatch] = useState(false);

  useEffect(() => {
    api.listProfiles().then(setProfiles);
    api.listDevices().then(setDevices);
  }, []);

  const sanitizeHost = (v: string) => v.replace(/[^0-9.:\[\]a-zA-Z-]/g, "");
  const sanitizePort = (v: string) => v.replace(/\D/g, "").slice(0, 5);

  const applyDevice = (deviceId: string) => {
    setSelectedDevice(deviceId);
    if (!deviceId) return;
    const d = devices.find((d) => d.id === deviceId);
    if (!d) return;
    setHost(d.host);
    setPort(String(d.port));
    setUsername(d.username);
    if (d.auth_type === "key" && d.key_path) {
      setKeyPath(d.key_path);
      setPassword("");
    }
  };

  const handleDeploy = async () => {
    if (!selected) return setError("Select a profile");
    if (!host.trim()) return setError("Host is required");
    const portNum = parseInt(port) || 22;
    if (portNum < 1 || portNum > 65535) return setError("Port must be between 1 and 65535");
    setError("");
    setOutput("");
    setDeploying(true);
    let success = false;
    let result = "";
    try {
      const profile = await api.getProfile(selected);
      result = await api.deploySsh({
        profile,
        host: host.trim(),
        port: portNum,
        username: username || "root",
        password: password || undefined,
        keyPath: keyPath || undefined,
      });
      setOutput(result);
      success = true;
    } catch (e) {
      result = String(e);
      setError(result);
    } finally {
      setDeploying(false);
      const deviceName = devices.find((d) => d.id === selectedDevice)?.name;
      const entry: DeployEntry = {
        profile: selected,
        device_name: deviceName,
        host: host.trim(),
        port,
        username: username || "root",
        date: new Date().toLocaleString(),
        success,
        output: result,
      };
      const updated = [entry, ...history];
      setHistory(updated);
      saveHistory(updated);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("easix_deploy_history");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">SSH Deploy</h2>
      <p className="text-gray-500 mb-6">Upload and execute a provisioning script on a remote machine</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">-- Choose --</option>
            {profiles.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {devices.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Saved Device <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => applyDevice(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">-- Enter manually --</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.username}@{d.host}:{d.port})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Host (IP)</label>
            <input
              value={host}
              onChange={(e) => { setSelectedDevice(""); setHost(sanitizeHost(e.target.value)); }}
              onPaste={(e) => {
                e.preventDefault();
                setSelectedDevice("");
                setHost(sanitizeHost(e.clipboardData.getData("text").trim()));
              }}
              placeholder="192.168.1.50"
              inputMode="decimal"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              value={port}
              onChange={(e) => setPort(sanitizePort(e.target.value))}
              inputMode="numeric"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for key auth"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SSH Key Path</label>
          <input
            value={keyPath}
            onChange={(e) => setKeyPath(e.target.value)}
            placeholder="~/.ssh/id_rsa"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex-1 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {deploying ? "Deploying..." : "Deploy Now"}
          </button>
          <button
            onClick={() => setShowBatch(true)}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Batch Deploy
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>}

      {output && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Output</h3>
          <pre className="bg-gray-900 text-green-400 p-5 rounded-lg text-sm overflow-auto max-h-[50vh] font-mono leading-relaxed">
            {output}
          </pre>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Deploy History</h3>
            <button
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear history
            </button>
          </div>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedEntry(expandedEntry === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${entry.success ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm font-medium truncate">{entry.profile}</span>
                    {entry.device_name && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{entry.device_name}</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{entry.username}@{entry.host}:{entry.port}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{entry.date}</span>
                    <span className="text-gray-300 text-xs">{expandedEntry === i ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedEntry === i && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-md text-xs overflow-auto max-h-[30vh] font-mono leading-relaxed">
                      {entry.output}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showBatch && (
        <BatchDeploy
          profiles={profiles}
          devices={devices}
          onClose={() => setShowBatch(false)}
        />
      )}
    </div>
  );
}
