import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { api } from "../api";
import { AppSettings, DEFAULT_SETTINGS, Device } from "../types";
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
  totalSteps: number;
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

interface DeployLogPayload {
  targetId: string;
  line: string;
}

interface DeployMetaPayload {
  targetId: string;
  totalSteps: number;
}

interface DeploySummary {
  ok: number;
  warnings: number;
  errors: number;
}

interface DeployOutcome {
  target: DeployTarget;
  success: boolean;
  output: string;
}

function makeTarget(settings: AppSettings = DEFAULT_SETTINGS): DeployTarget {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    profile: "",
    device_id: "",
    host: "",
    port: String(settings.default_ssh_port),
    username: settings.default_username,
    password: "",
    key_path: "",
    status: "idle",
    output: "",
    totalSteps: 0,
  };
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem("easix_deploy_history") || "[]"); }
  catch { return []; }
}

function saveHistory(entries: HistoryEntry[], limit: number) {
  localStorage.setItem("easix_deploy_history", JSON.stringify(entries.slice(0, limit)));
}

function targetLabel(target: DeployTarget, devices: Device[], index: number): string {
  const device = devices.find((d) => d.id === target.device_id);
  if (device) return device.name;
  if (target.host.trim()) return target.host.trim();
  return `Target ${index + 1}`;
}

function tabStatusClass(status: DeployTarget["status"]): string {
  if (status === "running") return "border-blue-500 text-blue-400";
  if (status === "ok") return "border-green-500 text-green-400 bg-green-900/10";
  if (status === "error") return "border-red-500 text-red-400 bg-red-900/10";
  return "border-surface-500 text-surface-300";
}

function summarizeOutput(output: string): DeploySummary {
  const lines = output.split("\n");
  return {
    ok: lines.filter((l) => l.includes("[OK]")).length,
    warnings: lines.filter((l) => l.includes("[WARN]")).length,
    errors: lines.filter((l) => l.includes("[ERROR]")).length,
  };
}

function countCompletedSteps(output: string): number {
  const lines = output.split("\n");
  return lines.filter((l) =>
    l.includes("[OK]") || l.includes("[SKIP]") || l.includes("[WARN]") || l.includes("[ERROR]")
  ).length;
}

async function notifyDeployFinished(outcomes: DeployOutcome[]) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === "granted";
    }
    if (!granted) return;
    const okCount = outcomes.filter((o) => o.success).length;
    let body: string;
    if (outcomes.length > 1) {
      body = `${okCount}/${outcomes.length} devices succeeded`;
    } else if (outcomes[0]?.success) {
      body = "Deploy succeeded";
    } else {
      body = "Deploy failed";
    }
    sendNotification({ title: "Easix deploy finished", body });
  } catch {
    // Best-effort only — a notification failure shouldn't affect deploy results.
  }
}

export default function Deploy() {
  const { devices, setDeviceConnected } = useDevices();
  const location = useLocation();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [targets, setTargets] = useState<DeployTarget[]>([makeTarget()]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [historyFilter, setHistoryFilter] = useState("");
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    api.listProfiles().then(setProfiles);
  }, []);

  // Apply saved deploy defaults once loaded, but only to rows still untouched.
  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setTargets((prev) => prev.map((t) =>
        !t.device_id && t.port === String(DEFAULT_SETTINGS.default_ssh_port) && t.username === DEFAULT_SETTINGS.default_username
          ? { ...t, port: String(s.default_ssh_port), username: s.default_username }
          : t
      ));
    });
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

  const appendTargetLog = (id: string, line: string) => {
    setTargets((prev) => prev.map((t) =>
      t.id === id ? { ...t, output: t.output ? `${t.output}\n${line}` : line } : t
    ));
  };

  const updateTarget = (id: string, patch: Partial<DeployTarget>) => {
    setTargets((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  };

  useEffect(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenMeta: (() => void) | undefined;
    listen<DeployLogPayload>("deploy-log", (event) => {
      appendTargetLog(event.payload.targetId, event.payload.line);
    }).then((fn) => { unlistenLog = fn; });
    listen<DeployMetaPayload>("deploy-meta", (event) => {
      updateTarget(event.payload.targetId, { totalSteps: event.payload.totalSteps });
    }).then((fn) => { unlistenMeta = fn; });
    return () => { unlistenLog?.(); unlistenMeta?.(); };
  }, []);

  const deviceById = (id: string) => devices.find((d) => d.id === id);

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
    if (d?.auth_type === "password") {
      api.getDeviceSecret(deviceId).then((saved) => {
        if (saved) updateTarget(targetId, { password: saved });
      });
    }
  };

  const addTarget = () => {
    if (targets.length >= 10) return;
    const last = targets[targets.length - 1];
    const next = makeTarget(settings);
    // Pre-fill profile from previous row
    next.profile = last.profile;
    setTargets((prev) => [...prev, next]);
  };

  const removeTarget = (id: string) => {
    setTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const isBatch = targets.length > 1;
  const hasStarted = targets.some((t) => t.status !== "idle");
  const activeTarget = targets.find((t) => t.id === activeTabId) ?? targets[0];
  const activeSummary = activeTarget ? summarizeOutput(activeTarget.output) : null;
  const activeCompletedSteps = activeTarget ? countCompletedSteps(activeTarget.output) : 0;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [activeTarget?.output]);

  const deployOneTarget = async (target: DeployTarget): Promise<DeployOutcome> => {
    const portNum = Number.parseInt(target.port) || 22;
    try {
      const profile = await api.getProfile(target.profile);
      const output = await api.deploySsh({
        targetId: target.id,
        profile,
        host: target.host.trim(),
        port: portNum,
        username: target.username || "root",
        password: target.password || undefined,
        keyPath: target.key_path || undefined,
        connectTimeoutSecs: settings.connect_timeout_secs,
      });
      updateTarget(target.id, { status: "ok" });
      const d = deviceById(target.device_id);
      if (d) setDeviceConnected(d.id);
      return { target, success: true, output };
    } catch (e) {
      const message = String(e);
      updateTarget(target.id, { status: "error" });
      appendTargetLog(target.id, `[easix] ${message}`);
      return { target, success: false, output: message };
    }
  };

  const recordHistory = (outcomes: DeployOutcome[]) => {
    const newEntries: HistoryEntry[] = outcomes.map(({ target, success, output }) => ({
      profile: target.profile,
      device_name: deviceById(target.device_id)?.name,
      host: target.host.trim(),
      port: target.port,
      username: target.username || "root",
      date: new Date().toLocaleString(),
      success,
      output,
    }));
    const updated = [...newEntries, ...history];
    setHistory(updated);
    saveHistory(updated, settings.history_limit);
  };

  const handleDeploy = async () => {
    for (const t of targets) {
      if (!t.profile) return setError("Every row needs a profile");
      if (!t.host.trim()) return setError("Every row needs a host");
    }
    setError("");
    setDeploying(true);
    setActiveTabId(targets[0]?.id ?? null);
    setTargets((prev) => prev.map((t) => ({ ...t, status: "running", output: "", totalSteps: 0 })));

    // Deploy to every target concurrently instead of one at a time, so a
    // batch of machines finishes in the time of the slowest one, not the sum.
    const outcomes = await Promise.all(targets.map(deployOneTarget));

    recordHistory(outcomes);
    setDeploying(false);
    if (!document.hasFocus()) {
      notifyDeployFinished(outcomes);
    }
  };

  const handleRetry = async (target: DeployTarget) => {
    setError("");
    updateTarget(target.id, { status: "running", output: "", totalSteps: 0 });
    const outcome = await deployOneTarget(target);
    recordHistory([outcome]);
  };

  const handleCancel = async (targetId: string) => {
    try { await api.cancelDeploy(targetId); } catch { /* best-effort */ }
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

  let deployButtonLabel: string;
  if (deploying) {
    deployButtonLabel = "Deploying…";
  } else if (isBatch) {
    deployButtonLabel = "Batch Deploy Now";
  } else {
    deployButtonLabel = "Deploy Now";
  }

  const filteredHistory = history.filter((entry) => {
    const q = historyFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.profile.toLowerCase().includes(q) ||
      entry.host.toLowerCase().includes(q) ||
      (entry.device_name?.toLowerCase().includes(q) ?? false)
    );
  });

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
                  <button type="button" onClick={() => removeTarget(t.id)}
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
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-1">
          {targets.length < 10 && (
            <button type="button" onClick={addTarget} disabled={deploying}
              className="text-sm text-primary-400 hover:text-primary-300 font-medium disabled:opacity-40 transition-colors">
              + Add device
            </button>
          )}
          <div className="flex-1" />
          {error && <span className="text-red-400 text-sm">{error}</span>}
          <button type="button" onClick={handleDeploy} disabled={deploying}
            className={`px-6 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors ${isBatch ? "bg-blue-600 hover:bg-blue-500" : "bg-green-700 hover:bg-green-600"}`}>
            {deployButtonLabel}
          </button>
        </div>
      </div>

      {hasStarted && activeTarget && (
        <div className="bg-surface-700 border border-surface-500 rounded-xl mb-6 overflow-hidden">
          {isBatch && (
            <div className="flex gap-1 border-b border-surface-500 px-3 pt-3 flex-wrap">
              {targets.map((t, i) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setActiveTabId(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                    activeTabId === t.id
                      ? tabStatusClass(t.status)
                      : "border-transparent text-surface-300 hover:text-surface-100"
                  }`}
                >
                  {targetLabel(t, devices, i)}
                  {t.status === "running" && <span className="ml-1 animate-pulse">●</span>}
                  {t.status === "ok" && <span className="ml-1">✓</span>}
                  {t.status === "error" && <span className="ml-1">✗</span>}
                </button>
              ))}
            </div>
          )}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-surface-100">
                {targetLabel(activeTarget, devices, targets.indexOf(activeTarget))}
              </span>
              <div className="flex items-center gap-2">
                {activeTarget.status === "running" && (
                  <button type="button" onClick={() => handleCancel(activeTarget.id)}
                    className="text-xs text-surface-300 hover:text-red-400 border border-surface-500 rounded-lg px-2 py-1 transition-colors">
                    Cancel
                  </button>
                )}
                {activeTarget.status === "error" && (
                  <button type="button" onClick={() => handleRetry(activeTarget)}
                    className="text-xs text-primary-400 hover:text-primary-300 border border-surface-500 rounded-lg px-2 py-1 transition-colors">
                    Retry
                  </button>
                )}
                {statusBadge(activeTarget)}
              </div>
            </div>

            {activeTarget.status === "running" && activeTarget.totalSteps > 0 && (
              <div className="mb-2">
                <div className="text-xs text-surface-300 mb-1">
                  Step {Math.min(activeCompletedSteps, activeTarget.totalSteps)}/{activeTarget.totalSteps}
                </div>
                <div className="h-1.5 bg-surface-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${Math.min(100, (activeCompletedSteps / activeTarget.totalSteps) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <pre
              ref={logRef}
              className="bg-surface-900 text-green-400 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 leading-relaxed whitespace-pre-wrap"
            >
              {activeTarget.output || "Waiting for output..."}
            </pre>
            {(activeTarget.status === "ok" || activeTarget.status === "error") && activeSummary && (
              <div className="mt-2 text-xs text-surface-300">
                Summary: {activeSummary.ok} OK, {activeSummary.warnings} warnings, {activeSummary.errors} errors
              </div>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-lg font-semibold text-surface-50 flex-shrink-0">Deploy History</h3>
            <input
              value={historyFilter}
              onChange={(e) => setHistoryFilter(e.target.value)}
              placeholder="Filter by profile, host, device…"
              className="input text-sm flex-1 max-w-xs"
            />
            <button type="button" onClick={clearHistory} className="text-xs text-surface-300 hover:text-red-400 transition-colors flex-shrink-0">
              Clear history
            </button>
          </div>
          <div className="space-y-2">
            {filteredHistory.map((entry, i) => (
              <div
                key={`${entry.date}-${entry.host}-${entry.port}-${entry.profile}`}
                className="bg-surface-700 border border-surface-500 rounded-xl overflow-hidden"
              >
                <button
                  type="button"
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
            {filteredHistory.length === 0 && (
              <p className="text-sm text-surface-300 py-4 text-center">No history entries match "{historyFilter}"</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
