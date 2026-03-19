import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Device } from "../types";
import { useDevices, PingStatus } from "../context/DevicesContext";
import { Select } from "../components/Select";

// ── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  { label: "Red",    value: "#ef4444" },
  { label: "Orange", value: "#f97316" },
  { label: "Yellow", value: "#eab308" },
  { label: "Green",  value: "#22c55e" },
  { label: "Blue",   value: "#3b82f6" },
  { label: "Purple", value: "#a855f7" },
  { label: "Pink",   value: "#ec4899" },
  { label: "Gray",   value: "#6b7280" },
];

const OS_OPTIONS = [
  { value: "ubuntu",  label: "Ubuntu",      icon: "🟠" },
  { value: "debian",  label: "Debian",      icon: "🔴" },
  { value: "alpine",  label: "Alpine",      icon: "🔵" },
  { value: "centos",  label: "CentOS",      icon: "🟣" },
  { value: "fedora",  label: "Fedora",      icon: "🔵" },
  { value: "other",   label: "Other Linux", icon: "🐧" },
];

const osIcon = (os?: string) => OS_OPTIONS.find((o) => o.value === os)?.icon ?? "🖥️";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function relativeTime(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Status dot with glow ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: PingStatus }) {
  if (status === undefined) {
    return (
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-surface-400" title="Unknown" />
    );
  }
  if (status === null) {
    return (
      <span
        className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"
        title="Offline"
        style={{ boxShadow: "0 0 7px 2px rgba(239,68,68,0.55)" }}
      />
    );
  }
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0" title={`Online · ${status}ms`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"
        style={{ boxShadow: "0 0 9px 3px rgba(34,197,94,0.65)" }}
      />
    </span>
  );
}

// ── Empty device form ─────────────────────────────────────────────────────────

const EMPTY: Omit<Device, "id"> = {
  name: "", host: "", port: 22, username: "root",
  auth_type: "password", key_path: undefined,
  group: undefined, tags: [], description: undefined,
  color: undefined, os: undefined, last_connected: undefined,
};

// ── Device Card ───────────────────────────────────────────────────────────────

interface CardProps {
  device: Device;
  status: PingStatus;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
  onQuickDeploy: () => void;
  connecting: boolean;
}

function DeviceCard({ device: d, status, onEdit, onDelete, onDuplicate, onConnect, onQuickDeploy, connecting }: CardProps) {
  const accentColor = d.color ?? (d.last_connected ? "#3b82f6" : "#262626");
  const connected = relativeTime(d.last_connected);

  return (
    <div
      className="bg-surface-700 rounded-xl p-5 transition-colors hover:bg-surface-600"
      style={{
        border: "1px solid #262626",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={status} />
          <span className="font-semibold text-white truncate">{d.name}</span>
          {d.os && <span className="text-base flex-shrink-0" title={d.os}>{osIcon(d.os)}</span>}
        </div>
        {status !== undefined && status !== null && (
          <span className="text-xs text-surface-300 flex-shrink-0 tabular-nums">{status}ms</span>
        )}
      </div>

      {/* Host */}
      <div className="text-sm text-surface-200 font-mono mt-2">
        {d.username}@{d.host}:{d.port}
      </div>

      {/* Auth + last connected */}
      <div className="text-xs text-surface-300 mt-0.5 flex gap-3 flex-wrap">
        <span>{d.auth_type === "key" ? "key auth" : "password auth"}</span>
        {connected && <span className="text-primary-400">connected {connected}</span>}
      </div>

      {/* Description */}
      {d.description && (
        <p className="text-xs text-surface-200 mt-2 line-clamp-2">{d.description}</p>
      )}

      {/* Tags */}
      {d.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {d.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-surface-600 text-surface-100 text-xs rounded-md">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <button onClick={onEdit}
          className="px-2.5 py-1 text-xs font-medium bg-surface-600 text-surface-100 rounded-lg hover:bg-surface-500 hover:text-white transition-colors">
          Edit
        </button>
        <button onClick={onDuplicate}
          className="px-2.5 py-1 text-xs font-medium bg-surface-600 text-surface-100 rounded-lg hover:bg-surface-500 hover:text-white transition-colors">
          Duplicate
        </button>
        <button onClick={onConnect} disabled={connecting}
          className="px-2.5 py-1 text-xs font-medium bg-green-700/80 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
          {connecting ? "Opening…" : "Connect"}
        </button>
        <button onClick={onQuickDeploy}
          className="px-2.5 py-1 text-xs font-medium bg-primary-600/80 text-white rounded-lg hover:bg-primary-600 transition-colors">
          Deploy
        </button>
        <button onClick={onDelete}
          className="px-2.5 py-1 text-xs font-medium text-red-400/80 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors ml-auto">
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Devices() {
  const { devices, status, refreshing, reload, pingAll, setDeviceConnected } = useDevices();
  const navigate = useNavigate();

  const [editing, setEditing]       = useState<Device | null>(null);
  const [form, setForm]             = useState<Omit<Device, "id">>(EMPTY);
  const [tagInput, setTagInput]     = useState("");
  const [error, setError]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  // ── Group devices ─────────────────────────────────────────────────────────

  const grouped: Record<string, Device[]> = {};
  for (const d of devices) {
    const key = d.group || "__ungrouped__";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  }
  const groupNames = Object.keys(grouped).sort((a, b) =>
    a === "__ungrouped__" ? 1 : b === "__ungrouped__" ? -1 : a.localeCompare(b)
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing({ id: generateId(), ...EMPTY });
    setForm(EMPTY); setTagInput(""); setError("");
  };

  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ name: d.name, host: d.host, port: d.port, username: d.username,
      auth_type: d.auth_type, key_path: d.key_path, group: d.group,
      tags: [...d.tags], description: d.description, color: d.color,
      os: d.os, last_connected: d.last_connected });
    setTagInput(""); setError("");
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm({ ...form, tags: [...form.tags, t] });
    setTagInput("");
  };

  const removeTag = (tag: string) =>
    setForm({ ...form, tags: form.tags.filter((t) => t !== tag) });

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Name is required");
    if (!form.host.trim()) return setError("Host is required");
    if (!editing) return;
    setSaving(true);
    try {
      await api.saveDevice({ ...form, id: editing.id });
      setEditing(null);
      await reload();
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  };

  const handleConnect = async (d: Device) => {
    setConnecting(d.id);
    try {
      await api.connectDevice(d.host, d.port, d.username);
      setDeviceConnected(d.id);
    } catch (e) { setError(String(e)); }
    finally { setConnecting(null); }
  };

  const handleDuplicate = async (d: Device) => {
    try { await api.duplicateDevice(d.id); await reload(); }
    catch (e) { setError(String(e)); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete device "${name}"?`)) return;
    try { await api.deleteDevice(id); await reload(); }
    catch (e) { setError(String(e)); }
  };

  const handleQuickDeploy = (d: Device) =>
    navigate("/deploy", { state: { deviceId: d.id } });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Devices</h2>
          <p className="text-surface-200 mt-1 text-sm">Saved SSH targets for deployment</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => pingAll()}
            disabled={devices.length === 0}
            className="w-28 py-2 text-sm font-medium border border-surface-500 text-surface-100 rounded-lg hover:bg-surface-700 hover:text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {refreshing ? (
              <>
                <span className="flex gap-0.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-100 animate-bounce" style={{ animationDelay: "240ms" }} />
                </span>
                <span>Pinging</span>
              </>
            ) : (
              "Refresh"
            )}
          </button>
          <button
            onClick={openNew}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-500 transition-colors"
          >
            + Add Device
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}

      {devices.length === 0 && (
        <div className="text-center py-20 text-surface-300">
          <p className="text-lg text-surface-100">No devices yet</p>
          <p className="text-sm mt-1">Add your first SSH target</p>
        </div>
      )}

      {/* Groups */}
      {groupNames.map((group) => (
        <div key={group} className="mb-8">
          {group !== "__ungrouped__" && (
            <h3 className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-3 px-1">
              {group}
            </h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[group].map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                status={status[d.id]}
                onEdit={() => openEdit(d)}
                onDelete={() => handleDelete(d.id, d.name)}
                onDuplicate={() => handleDuplicate(d)}
                onConnect={() => handleConnect(d)}
                onQuickDeploy={() => handleQuickDeploy(d)}
                connecting={connecting === d.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 border border-surface-500 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">
              {devices.find((d) => d.id === editing.id) ? "Edit Device" : "New Device"}
            </h3>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1.5">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Lab PC 01" className="input w-full" />
            </div>

            {/* Host + Port */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Host (IP)</label>
                <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="192.168.1.50" className="input w-full font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Port</label>
                <input type="number" value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
                  className="input w-full font-mono" />
              </div>
            </div>

            {/* Username + Auth */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Username</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Auth type</label>
                <Select
                  value={form.auth_type}
                  onChange={(v) => setForm({ ...form, auth_type: v as "password" | "key" })}
                  options={[{ value: "password", label: "Password" }, { value: "key", label: "SSH Key" }]}
                />
              </div>
            </div>

            {form.auth_type === "key" && (
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Key Path</label>
                <input value={form.key_path ?? ""}
                  onChange={(e) => setForm({ ...form, key_path: e.target.value || undefined })}
                  placeholder="~/.ssh/id_rsa" className="input w-full font-mono" />
              </div>
            )}

            {/* Group + OS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">Group</label>
                <input value={form.group ?? ""}
                  onChange={(e) => setForm({ ...form, group: e.target.value || undefined })}
                  placeholder="Production, Lab…" className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-100 mb-1.5">OS</label>
                <Select
                  value={form.os ?? ""}
                  onChange={(v) => setForm({ ...form, os: v || undefined })}
                  options={[{ value: "", label: "Unknown" }, ...OS_OPTIONS.map((o) => ({ value: o.value, label: `${o.icon} ${o.label}` }))]}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1.5">Description</label>
              <textarea value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value || undefined })}
                rows={2} placeholder="Notes about this device…"
                className="input w-full resize-none" />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-1.5">Tags</label>
              <div className="flex gap-2">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="nginx, backup… (Enter to add)" className="flex-1 input" />
                <button onClick={addTag}
                  className="px-3 py-2 text-sm bg-surface-600 hover:bg-surface-500 text-surface-100 rounded-lg transition-colors">
                  Add
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-surface-600 text-surface-100 text-xs rounded-lg">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-surface-300 hover:text-red-400 ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-surface-100 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setForm({ ...form, color: undefined })}
                  className={`w-7 h-7 rounded-full border-2 bg-surface-600 ${!form.color ? "border-white" : "border-transparent"}`}
                  title="No color" />
                {PRESET_COLORS.map((c) => (
                  <button key={c.value} onClick={() => setForm({ ...form, color: c.value })}
                    style={{ backgroundColor: c.value }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c.value ? "border-white scale-110" : "border-transparent"}`}
                    title={c.label} />
                ))}
              </div>
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)}
                className="flex-1 py-2 text-sm border border-surface-500 text-surface-100 rounded-lg hover:bg-surface-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-500 disabled:opacity-50 transition-colors">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
