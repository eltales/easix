import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Profile, CustomScript, DEFAULT_PROFILE } from "../types";

const TABS = ["System", "Software", "User", "Network", "Security", "Autostart", "Scripts"] as const;
type Tab = (typeof TABS)[number];

const COMMON_PACKAGES = [
  "python3", "docker.io", "vim", "curl", "wget", "git",
  "htop", "net-tools", "hwinfo", "openssh-server", "nginx", "ufw",
];

export default function Editor() {
  const { name: routeName } = useParams();
  const [searchParams] = useSearchParams();
  const isDuplicate = searchParams.get("duplicate") === "true";
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("System");
  const [profile, setProfile] = useState<Profile>({ ...DEFAULT_PROFILE });
  const [profileName, setProfileName] = useState(routeName && !isDuplicate ? routeName : "");
  const [originalName] = useState(routeName || "");
  const [saving, setSaving] = useState(false);
  const [customPkg, setCustomPkg] = useState("");

  useEffect(() => {
    if (routeName) {
      api.getProfile(routeName).then((p) => {
        setProfile({ ...p, custom_scripts: p.custom_scripts || [] });
        if (!isDuplicate) setProfileName(routeName);
      });
    }
  }, [routeName, isDuplicate]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const name = profileName.trim();
    if (!name) return alert("Profile name is required");
    setSaving(true);
    try {
      if (routeName && !isDuplicate && name !== originalName) {
        await api.renameProfile(originalName, name);
      }
      await api.saveProfile(name, profile);
      navigate("/");
    } catch (e) {
      alert(String(e));
    } finally {
      setSaving(false);
    }
  };

  const togglePackage = (pkg: string) => {
    setProfile((prev) => ({
      ...prev,
      packages: prev.packages.includes(pkg)
        ? prev.packages.filter((p) => p !== pkg)
        : [...prev.packages, pkg],
    }));
  };

  const addCustomPkg = () => {
    const pkg = customPkg.trim();
    if (pkg && !profile.packages.includes(pkg)) {
      update("packages", [...profile.packages, pkg]);
    }
    setCustomPkg("");
  };

  const addScript = () => {
    const newScript: CustomScript = { name: "", content: "#!/bin/bash\n", mode: "run_once" };
    update("custom_scripts", [...profile.custom_scripts, newScript]);
  };

  const updateScript = (index: number, field: keyof CustomScript, value: string) => {
    const updated = [...profile.custom_scripts];
    updated[index] = { ...updated[index], [field]: value };
    update("custom_scripts", updated);
  };

  const removeScript = (index: number) => {
    update("custom_scripts", profile.custom_scripts.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {isDuplicate ? "Duplicate Profile" : routeName ? `Edit: ${routeName}` : "New Profile"}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Profile name
        </label>
        <input
          value={profileName}
          onChange={(e) => setProfileName(e.target.value)}
          placeholder="e.g. lab-workstation"
          className="w-64 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        {routeName && !isDuplicate && profileName !== originalName && profileName.trim() && (
          <p className="text-xs text-amber-600 mt-1">
            Profile will be renamed from "{originalName}" to "{profileName.trim()}"
          </p>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            {t === "Scripts" && profile.custom_scripts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                {profile.custom_scripts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {tab === "System" && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Operating System</label>
              <select
                value={profile.os}
                onChange={(e) => update("os", e.target.value as Profile["os"])}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="ubuntu2204">Ubuntu 22.04</option>
                <option value="debian11">Debian 11</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hostname</label>
              <input
                value={profile.hostname}
                onChange={(e) => update("hostname", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        )}

        {tab === "Software" && (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Select packages to install. Selected: {profile.packages.length}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {COMMON_PACKAGES.map((pkg) => (
                <label
                  key={pkg}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                    profile.packages.includes(pkg)
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={profile.packages.includes(pkg)}
                    onChange={() => togglePackage(pkg)}
                    className="rounded"
                  />
                  {pkg}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input
                value={customPkg}
                onChange={(e) => setCustomPkg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomPkg()}
                placeholder="Custom package name..."
                className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <button
                onClick={addCustomPkg}
                className="px-3 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
            {profile.packages.filter((p) => !COMMON_PACKAGES.includes(p)).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.packages
                  .filter((p) => !COMMON_PACKAGES.includes(p))
                  .map((pkg) => (
                    <span
                      key={pkg}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                    >
                      {pkg}
                      <button onClick={() => togglePackage(pkg)} className="text-gray-400 hover:text-red-500">
                        ×
                      </button>
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {tab === "User" && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                value={profile.user.name}
                onChange={(e) => update("user", { ...profile.user, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.user.sudo}
                onChange={(e) => update("user", { ...profile.user, sudo: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Grant sudo privileges</span>
            </label>
          </div>
        )}

        {tab === "Network" && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={profile.network.mode}
                onChange={(e) =>
                  update("network", { ...profile.network, mode: e.target.value as "dhcp" | "static" })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="dhcp">DHCP</option>
                <option value="static">Static</option>
              </select>
            </div>
            {profile.network.mode === "static" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Address (CIDR)</label>
                  <input
                    value={profile.network.address || ""}
                    onChange={(e) => update("network", { ...profile.network, address: e.target.value })}
                    placeholder="192.168.1.100/24"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gateway</label>
                  <input
                    value={profile.network.gateway || ""}
                    onChange={(e) => update("network", { ...profile.network, gateway: e.target.value })}
                    placeholder="192.168.1.1"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">DNS</label>
                  <input
                    value={profile.network.dns || ""}
                    onChange={(e) => update("network", { ...profile.network, dns: e.target.value })}
                    placeholder="8.8.8.8"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {tab === "Security" && (
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.security.ufw}
                onChange={(e) => update("security", { ...profile.security, ufw: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Enable UFW firewall</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSH Public Key</label>
              <textarea
                value={profile.security.ssh_key || ""}
                onChange={(e) =>
                  update("security", { ...profile.security, ssh_key: e.target.value || undefined })
                }
                placeholder="ssh-rsa AAAA..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
              />
            </div>
          </div>
        )}

        {tab === "Autostart" && (
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Startup script path</label>
              <input
                value={profile.autostart || ""}
                onChange={(e) => update("autostart", e.target.value || undefined)}
                placeholder="/opt/myapp/start.sh"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">
                Will be registered as a systemd service running at boot.
                For custom scripts, use the Scripts tab instead.
              </p>
            </div>
          </div>
        )}

        {tab === "Scripts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Add custom bash scripts to run during provisioning.
              </p>
              <button
                onClick={addScript}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                + Add Script
              </button>
            </div>

            {profile.custom_scripts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No custom scripts</p>
                <p className="text-sm mt-1">Add scripts to run once or register as autostart services</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profile.custom_scripts.map((script, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Script name</label>
                        <input
                          value={script.name}
                          onChange={(e) => updateScript(i, "name", e.target.value)}
                          placeholder="e.g. setup-db"
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                      <div className="w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
                        <select
                          value={script.mode}
                          onChange={(e) => updateScript(i, "mode", e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        >
                          <option value="run_once">Run once</option>
                          <option value="autostart">Autostart</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={() => removeScript(i)}
                          className="px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                      <textarea
                        value={script.content}
                        onChange={(e) => updateScript(i, "content", e.target.value)}
                        rows={6}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                        placeholder="#!/bin/bash&#10;echo 'Hello from custom script'"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {script.mode === "run_once"
                        ? "This script will execute once during provisioning, then be removed."
                        : "This script will be installed to /opt/easix/scripts/ and registered as a systemd service."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
