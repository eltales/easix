import { useState } from "react";
import { api } from "../api";
import { Device } from "../types";

const MAX_DEVICES = 10;

interface BatchTarget {
  device_id: string;
  status: "pending" | "running" | "ok" | "error";
  output: string;
}

interface Props {
  profiles: string[];
  devices: Device[];
  onClose: () => void;
}

export default function BatchDeploy({ profiles, devices, onClose }: Props) {
  const [selectedProfile, setSelectedProfile] = useState("");
  const [targets, setTargets] = useState<BatchTarget[]>([]);
  const [running, setRunning] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const addTarget = (deviceId: string) => {
    if (targets.length >= MAX_DEVICES) return;
    if (targets.find((t) => t.device_id === deviceId)) return;
    setTargets([...targets, { device_id: deviceId, status: "pending", output: "" }]);
  };

  const removeTarget = (deviceId: string) => {
    setTargets(targets.filter((t) => t.device_id !== deviceId));
  };

  const deviceById = (id: string) => devices.find((d) => d.id === id);

  const handleBatchDeploy = async () => {
    if (!selectedProfile) return setError("Select a profile");
    if (targets.length === 0) return setError("Add at least one device");
    setError("");
    setRunning(true);

    const profile = await api.getProfile(selectedProfile).catch((e) => {
      setError(String(e));
      setRunning(false);
      return null;
    });
    if (!profile) return;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const d = deviceById(target.device_id);
      if (!d) continue;

      setTargets((prev) =>
        prev.map((t) => t.device_id === target.device_id ? { ...t, status: "running" } : t)
      );

      try {
        const output = await api.deploySsh({
          profile,
          host: d.host,
          port: d.port,
          username: d.username,
          password: d.auth_type === "password" ? password || undefined : undefined,
          keyPath: d.auth_type === "key" ? d.key_path : undefined,
        });
        setTargets((prev) =>
          prev.map((t) => t.device_id === target.device_id ? { ...t, status: "ok", output } : t)
        );
      } catch (e) {
        setTargets((prev) =>
          prev.map((t) => t.device_id === target.device_id ? { ...t, status: "error", output: String(e) } : t)
        );
      }
    }

    setRunning(false);
  };

  const availableDevices = devices.filter(
    (d) => !targets.find((t) => t.device_id === d.id)
  );

  const statusIcon = (s: BatchTarget["status"]) => {
    if (s === "ok") return <span className="text-green-500">✓</span>;
    if (s === "error") return <span className="text-red-500">✗</span>;
    if (s === "running") return <span className="text-blue-500 animate-pulse">⟳</span>;
    return <span className="text-gray-300">○</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Batch Deploy</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">-- Choose profile --</option>
            {profiles.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-gray-400 font-normal">(used for password-auth devices)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty if using SSH keys"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Devices ({targets.length}/{MAX_DEVICES})
            </label>
          </div>

          {availableDevices.length > 0 && targets.length < MAX_DEVICES && (
            <select
              onChange={(e) => { if (e.target.value) addTarget(e.target.value); e.target.value = ""; }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none mb-3"
            >
              <option value="">+ Add device...</option>
              {availableDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.username}@{d.host}:{d.port})
                </option>
              ))}
            </select>
          )}

          {targets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No devices selected</p>
          ) : (
            <div className="space-y-2">
              {targets.map((t) => {
                const d = deviceById(t.device_id);
                if (!d) return null;
                return (
                  <div key={t.device_id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="text-lg w-5 text-center">{statusIcon(t.status)}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{d.name}</span>
                        <span className="text-xs text-gray-400 ml-2 font-mono">{d.username}@{d.host}:{d.port}</span>
                      </div>
                      {!running && t.status === "pending" && (
                        <button
                          onClick={() => removeTarget(t.device_id)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {(t.status === "ok" || t.status === "error") && t.output && (
                      <div className="border-t border-gray-100 px-3 py-2">
                        <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-auto max-h-24 font-mono">
                          {t.output.slice(0, 500)}{t.output.length > 500 ? "\n..." : ""}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={running}
            className="flex-1 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleBatchDeploy}
            disabled={running || targets.length === 0}
            className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {running ? "Deploying..." : "Batch Deploy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
