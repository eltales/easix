import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { Device } from "../types";
import { useDevices } from "../context/DevicesContext";
import { Select } from "../components/Select";

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
  const { devices } = useDevices();
  const location = useLocation();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [targets, setTargets] = useState<DeployTarget[]>([makeTarget()]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  useEffect(() => {
    api.listProfiles().then(setProfiles);
  }, []);

  // Pre-select device when coming from Quick Deploy
  useEffect(() => {
    const deviceId = (location.state as { deviceId?: string } | null)?.deviceId;
    if (deviceId && devices.length > 0) {
      setTargets((prev) => {
        const first = prev[0];
        if (first.device_id) return prev; // already selected, don't override
        const d = devices.find((x) => x.id === deviceId);
        if (!d) return prev;
        return prev.map((t, i) => i === 0 ? {
          ...t, device_id: d.id, host: d.host, port: String(d.port),
          username: d.username, key_path: d.auth_type === "key" ? (d.key_path ?? "") : "",
        } : t);
      });
    }
  }, [location.state, devices]);

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
      <h2 className="text-2xl font-bold text-surface-50 mb-1">Deploy</h2>
      <p className="text-surface-200 text-sm mb-6">Deploy a provisioning profile to one or more machines</p>

      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6 mb-6 space-y-3">
        {targets.map((t, i) => {
          const d = deviceById(t.device_id);
          const showPassword = !t.device_id || (d?.auth_type === "password");
          const showManual = !t.device_id;

          return (
            <div key={t.id} className="border border-surface-500 rounded-xl p-4 bg-surface-800">
              {/* Row header: badge + selects + status */}
              <div className="flex items-center gap-2 mb-2">
                {isBatch && (
                  <span className="text-xs font-medium text-surface-400 w-6 flex-shrink-0 text-center">
                    {i + 1}
                  </span>
                )}
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Select
                    value={t.profile}
                    onChange={(v) => updateTarget(t.id, { profile: v })}
                    options={[{ value: "", label: "Profile…" }, ...profiles.map((n) => ({ value: n, label: n }))]}
                  />
                  <Select
                    value={t.device_id}
                    onChange={(v) => applyDevice(t.id, v)}
                    options={[{ value: "", label: "Device… (manual)" }, ...devices.map((d) => ({ value: d.id, label: `${d.name} — ${d.host}` }))]}
                  />
                </div>
                {targets.length > 1 && t.status === "idle" && (
                  <button onClick={() => removeTarget(t.id)}
                    className="text-surface-300 hover:text-red-400 transition-colors text-lg leading-none px-1">×</button>
                )}
                {statusBadge(t)}
              </div>

              {/* Manual fields — no indent, flush with selects above */}
              {showManual && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <input value={t.host} onChange={(e) => updateTarget(t.id, { host: e.target.value })}
                    placeholder="Host / IP" className="input col-span-2 font-mono" />
                  <input value={t.port} onChange={(e) => updateTarget(t.id, { port: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                    placeholder="Port" className="input font-mono" />
                  <input value={t.username} onChange={(e) => updateTarget(t.id, { username: e.target.value })}
                    placeholder="Username" className="input col-span-3" />
                  <input value={t.key_path} onChange={(e) => updateTarget(t.id, { key_path: e.target.value })}
                    placeholder="SSH key path (optional)" className="input col-span-3 font-mono" />
                </div>
              )}

              {showPassword && (
                <div className="mt-2">
                  <input type="password" value={t.password} onChange={(e) => updateTarget(t.id, { password: e.target.value })}
                    placeholder="Password (leave empty for key auth)" className="input w-full" />
                </div>
              )}

              {(t.status === "ok" || t.status === "error") && t.output && (
                <div className="mt-2">
                  <pre className={`p-3 rounded-lg text-xs font-mono overflow-auto max-h-32 leading-relaxed ${t.status === "ok" ? "bg-surface-900 text-green-400" : "bg-red-950/40 text-red-300"}`}>
                    {t.output.slice(0, 800)}{t.output.length > 800 ? "\n…" : ""}
                  </pre>
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-1">
          {targets.length < 10 && (
            <button onClick={addTarget} disabled={deploying}
              className="text-sm text-primary-400 hover:text-primary-300 font-medium disabled:opacity-40 transition-colors">
              + Add device
            </button>
          )}
          <div className="flex-1" />
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <button onClick={handleDeploy} disabled={deploying}
            className={`px-6 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors ${isBatch ? "bg-blue-600 hover:bg-blue-500" : "bg-green-700 hover:bg-green-600"}`}>
            {deploying ? "Deploying…" : isBatch ? "Batch Deploy Now" : "Deploy Now"}
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-surface-50">Deploy History</h3>
            <button onClick={clearHistory} className="text-xs text-surface-300 hover:text-red-400 transition-colors">
              Clear history
            </button>
          </div>
          <div className="space-y-2">
            {history.map((entry, i) => (
              <div key={i} className="bg-surface-700 border border-surface-500 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedEntry(expandedEntry === i ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-600 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`flex-shrink-0 w-2 h-2 rounded-full ${entry.success ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-sm font-medium text-surface-50 truncate">{entry.profile}</span>
                    {entry.device_name && (
                      <span className="text-xs bg-surface-600 text-surface-100 px-2 py-0.5 rounded-md">{entry.device_name}</span>
                    )}
                    <span className="text-xs text-surface-300 font-mono">{entry.username}@{entry.host}:{entry.port}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-surface-300">{entry.date}</span>
                    <span className="text-surface-400 text-xs">{expandedEntry === i ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedEntry === i && (
                  <div className="border-t border-surface-500 px-4 py-3">
                    <pre className="bg-surface-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-[30vh] font-mono leading-relaxed">
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
