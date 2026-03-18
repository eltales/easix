import { useEffect, useState } from "react";
import { api } from "../api";
import { Device } from "../types";

interface DeployTarget {
  id: string;
  profile: string;
  device_id: string;
  host: string;
  port: string;
  username: string;
  password: string;
  key_path: string;
  status: "idle" | "running" | "ok" | "error";
  output: string;
}

interface HistoryEntry {
  profile: string;
  device_name?: string;
  host: string;
  port: string;
  username: string;
  date: string;
  success: boolean;
  output: string;
}

function makeTarget(): DeployTarget {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    profile: "",
    device_id: "",
    host: "",
    port: "22",
    username: "root",
    password: "",
    key_path: "",
    status: "idle",
    output: "",
  };
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("easix_deploy_history") || "[]"); }
  catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem("easix_deploy_history", JSON.stringify(entries.slice(0, 50)));
}

export default function Deploy() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [targets, setTargets] = useState<DeployTarget[]>([makeTarget()]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  useEffect(() => {
    api.listProfiles().then(setProfiles);
    api.listDevices().then(setDevices);
  }, []);

  const deviceById = (id: string) => devices.find((d) => d.id === id);

  const updateTarget = (id: string, patch: Partial<DeployTarget>) => {
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  const applyDevice = (targetId: string, deviceId: string) => {
    const d = deviceById(deviceId);
    updateTarget(targetId, {
      device_id: deviceId,
      host: d?.host ?? "",
      port: String(d?.port ?? 22),
      username: d?.username ?? "root",
      key_path: d?.auth_type === "key" ? (d.key_path ?? "") : "",
      password: "",
    });
  };

  const addTarget = () => {
    if (targets.length >= 10) return;
    const last = targets[targets.length - 1];
    const next = makeTarget();
    // Pre-fill profile from previous row
    next.profile = last.profile;
    setTargets((prev) => [...prev, next]);
  };

  const removeTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const isBatch = targets.length > 1;

  const handleDeploy = async () => {
    for (const t of targets) {
      if (!t.profile) return setError("Every row needs a profile");
      if (!t.host.trim()) return setError("Every row needs a host");
    }
    setError("");
    setDeploying(true);

    const newHistory: HistoryEntry[] = [];

    for (const target of targets) {
      updateTarget(target.id, { status: "running", output: "" });
      const portNum = parseInt(target.port) || 22;
      let success = false;
      let result = "";
      try {
        const profile = await api.getProfile(target.profile);
        result = await api.deploySsh({
          profile,
          host: target.host.trim(),
          port: portNum,
          username: target.username || "root",
          password: target.password || undefined,
          keyPath: target.key_path || undefined,
        });
        updateTarget(target.id, { status: "ok", output: result });
        success = true;
      } catch (e) {
        result = String(e);
        updateTarget(target.id, { status: "error", output: result });
      }
      const d = deviceById(target.device_id);
      newHistory.push({
        profile: target.profile,
        device_name: d?.name,
        host: target.host.trim(),
        port: target.port,
        username: target.username || "root",
        date: new Date().toLocaleString(),
        success,
        output: result,
      });
    }

    const updated = [...newHistory, ...history];
    setHistory(updated);
    saveHistory(updated);
    setDeploying(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("easix_deploy_history");
  };

  const statusBadge = (t: DeployTarget) => {
    if (t.status === "running") return <span className="text-blue-500 text-xs animate-pulse">Deploying…</span>;
    if (t.status === "ok") return <span className="text-green-600 text-xs font-medium">✓ Done</span>;
    if (t.status === "error") return <span className="text-red-500 text-xs font-medium">✗ Failed</span>;
    return null;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Deploy</h2>
      <p className="text-gray-500 mb-6">Deploy a provisioning profile to one or more machines</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 space-y-3">
        {targets.map((t, i) => {
          const d = deviceById(t.device_id);
          const showPassword = !t.device_id || (d?.auth_type === "password");
          const showManual = !t.device_id;

          return (
            <div key={t.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 w-16 flex-shrink-0">
                  {isBatch ? `#${i + 1}` : "Target"}
                </span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <select
                    value={t.profile}
                    onChange={(e) => updateTarget(t.id, { profile: e.target.value })}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Profile…</option>
                    {profiles.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>

                  <select
                    value={t.device_id}
                    onChange={(e) => applyDevice(t.id, e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Device… (manual)</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.host}
                      </option>
                    ))}
                  </select>
                </div>

                {targets.length > 1 && t.status === "idle" && (
                  <button
                    onClick={() => removeTarget(t.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none px-1"
                  >
                    ×
                  </button>
                )}
                {statusBadge(t)}
              </div>

              {showManual && (
                <div className="grid grid-cols-3 gap-2 pl-16">
                  <div className="col-span-2">
                    <input
                      value={t.host}
                      onChange={(e) => updateTarget(t.id, { host: e.target.value })}
                      placeholder="Host / IP"
                      className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                    />
                  </div>
                  <input
                    value={t.port}
                    onChange={(e) => updateTarget(t.id, { port: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    placeholder="Port"
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                  />
                  <input
                    value={t.username}
                    onChange={(e) => updateTarget(t.id, { username: e.target.value })}
                    placeholder="Username"
                    className="col-span-3 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  <input
                    value={t.key_path}
                    onChange={(e) => updateTarget(t.id, { key_path: e.target.value })}
                    placeholder="SSH key path (optional)"
                    className="col-span-2 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                  />
                </div>
              )}

              {showPassword && (
                <div className="pl-16">
                  <input
                    type="password"
                    value={t.password}
                    onChange={(e) => updateTarget(t.id, { password: e.target.value })}
                    placeholder="Password (leave empty for key auth)"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              )}

              {(t.status === "ok" || t.status === "error") && t.output && (
                <div className="pl-16">
                  <pre className={`p-3 rounded-md text-xs font-mono overflow-auto max-h-32 leading-relaxed ${t.status === "ok" ? "bg-gray-900 text-green-400" : "bg-red-950 text-red-300"}`}>
                    {t.output.slice(0, 800)}{t.output.length > 800 ? "\n…" : ""}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-1">
          {targets.length < 10 && (
            <button
              onClick={addTarget}
              disabled={deploying}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium disabled:opacity-40 transition-colors"
            >
              + Add device
            </button>
          )}
          <div className="flex-1" />
          {error && <span className="text-red-500 text-sm">{error}</span>}
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className={`px-6 py-2 text-sm font-medium rounded-md text-white disabled:opacity-50 transition-colors ${isBatch ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {deploying ? "Deploying…" : isBatch ? "Batch Deploy Now" : "Deploy Now"}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Deploy History</h3>
            <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
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
    </div>
  );
}
