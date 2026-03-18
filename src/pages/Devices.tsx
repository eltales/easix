import { useEffect, useState } from "react";
import { api } from "../api";
import { Device } from "../types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const EMPTY_DEVICE: Omit<Device, "id"> = {
  name: "",
  host: "",
  port: 22,
  username: "root",
  auth_type: "password",
  key_path: undefined,
};

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<Omit<Device, "id">>(EMPTY_DEVICE);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.listDevices().then(setDevices).catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing({ id: generateId(), ...EMPTY_DEVICE });
    setForm(EMPTY_DEVICE);
    setError("");
  };

  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ name: d.name, host: d.host, port: d.port, username: d.username, auth_type: d.auth_type, key_path: d.key_path });
    setError("");
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Name is required");
    if (!form.host.trim()) return setError("Host is required");
    if (!editing) return;
    setSaving(true);
    try {
      await api.saveDevice({ ...form, id: editing.id });
      setEditing(null);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete device "${name}"?`)) return;
    try {
      await api.deleteDevice(id);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Devices</h2>
          <p className="text-gray-500 mt-1">Saved SSH targets for deployment</p>
        </div>
        <button
          onClick={openNew}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + Add Device
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>
      )}

      {devices.length === 0 && !editing ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No devices yet</p>
          <p className="text-sm mt-1">Add your first SSH target</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {devices.map((d) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="font-semibold text-lg">{d.name}</div>
              <div className="text-sm text-gray-500 font-mono mt-1">
                {d.username}@{d.host}:{d.port}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Auth: {d.auth_type === "key" ? `key (${d.key_path || "no path"})` : "password"}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => openEdit(d)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(d.id, d.name)}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {devices.find((d) => d.id === editing.id) ? "Edit Device" : "New Device"}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Lab PC 01"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Host (IP)</label>
                <input
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="192.168.1.50"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auth type</label>
              <select
                value={form.auth_type}
                onChange={(e) => setForm({ ...form, auth_type: e.target.value as "password" | "key" })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="password">Password</option>
                <option value="key">SSH Key</option>
              </select>
            </div>

            {form.auth_type === "key" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Path</label>
                <input
                  value={form.key_path ?? ""}
                  onChange={(e) => setForm({ ...form, key_path: e.target.value || undefined })}
                  placeholder="~/.ssh/id_rsa"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                />
              </div>
            )}

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
