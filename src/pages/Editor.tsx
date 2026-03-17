import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Profile, CustomScript, DEFAULT_PROFILE, SoftwareItem } from "../types";

const TABS = ["System", "Software", "User", "Network", "Security", "Autostart", "Scripts"] as const;
type Tab = (typeof TABS)[number];

const DISABLEABLE: Tab[] = ["System", "Software", "User", "Network", "Security", "Autostart"];
const SECTION_KEY: Record<string, string> = {
  System: "system", Software: "packages", User: "user",
  Network: "network", Security: "security", Autostart: "autostart",
};

const SOFTWARE_PRESETS_DEB: SoftwareItem[] = [
  { name: "python3", commands: ["apt-get install -y python3"] },
  { name: "git", commands: ["apt-get install -y git"] },
  { name: "vim", commands: ["apt-get install -y vim"] },
  { name: "curl", commands: ["apt-get install -y curl"] },
  { name: "wget", commands: ["apt-get install -y wget"] },
  { name: "htop", commands: ["apt-get install -y htop"] },
  { name: "net-tools", commands: ["apt-get install -y net-tools"] },
  { name: "nginx", commands: ["apt-get install -y nginx", "systemctl enable nginx"] },
  { name: "openssh-server", commands: ["apt-get install -y openssh-server", "systemctl enable ssh"] },
  { name: "Docker", commands: [
    "apt-get install -y ca-certificates curl gnupg",
    "curl -fsSL https://get.docker.com | sh",
    "systemctl enable docker",
  ]},
  { name: "Node.js 20", commands: [
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
  ]},
  { name: "ufw", commands: ["apt-get install -y ufw"] },
];

const SOFTWARE_PRESETS_ALPINE: SoftwareItem[] = [
  { name: "python3", commands: ["apk add --quiet python3"] },
  { name: "git", commands: ["apk add --quiet git"] },
  { name: "vim", commands: ["apk add --quiet vim"] },
  { name: "curl", commands: ["apk add --quiet curl"] },
  { name: "wget", commands: ["apk add --quiet wget"] },
  { name: "htop", commands: ["apk add --quiet htop"] },
  { name: "net-tools", commands: ["apk add --quiet net-tools"] },
  { name: "nginx", commands: ["apk add --quiet nginx", "rc-update add nginx default"] },
  { name: "openssh", commands: ["apk add --quiet openssh", "rc-update add sshd default"] },
  { name: "Docker", commands: [
    "apk add --quiet docker",
    "rc-update add docker default",
  ]},
  { name: "Node.js", commands: ["apk add --quiet nodejs npm"] },
  { name: "iptables", commands: ["apk add --quiet iptables"] },
];

const TIMEZONES = [
  "UTC", "Europe/Warsaw", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
];

const LOCALES = [
  "en_US.UTF-8", "pl_PL.UTF-8", "de_DE.UTF-8", "fr_FR.UTF-8",
  "es_ES.UTF-8", "pt_BR.UTF-8", "ja_JP.UTF-8", "zh_CN.UTF-8",
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
  const isAlpine = profile.os === "alpine318";
  const softwarePresets = isAlpine ? SOFTWARE_PRESETS_ALPINE : SOFTWARE_PRESETS_DEB;

  useEffect(() => {
    if (routeName) {
      api.getProfile(routeName).then((p) => {
        setProfile({
          ...p,
          custom_scripts: p.custom_scripts || [],
          disabled_sections: p.disabled_sections || [],
          system: p.system || DEFAULT_PROFILE.system,
        });
        if (!isDuplicate) setProfileName(routeName);
      });
    }
  }, [routeName, isDuplicate]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  const isDisabled = (t: Tab) =>
    profile.disabled_sections.includes(SECTION_KEY[t] || "");

  const toggleSection = (t: Tab) => {
    const key = SECTION_KEY[t];
    if (!key) return;
    const disabled = profile.disabled_sections.includes(key)
      ? profile.disabled_sections.filter((s) => s !== key)
      : [...profile.disabled_sections, key];
    update("disabled_sections", disabled);
  };

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

  const addSoftwareItem = (item: SoftwareItem) => {
    update("packages", [...profile.packages, { ...item, commands: [...item.commands] }]);
  };

  const addCustomSoftwareItem = () => {
    update("packages", [...profile.packages, { name: "", commands: [""] }]);
  };

  const removeSoftwareItem = (i: number) => {
    update("packages", profile.packages.filter((_, idx) => idx !== i));
  };

  const updateSoftwareName = (i: number, name: string) => {
    const updated = [...profile.packages];
    updated[i] = { ...updated[i], name };
    update("packages", updated);
  };

  const updateSoftwareCommand = (i: number, ci: number, cmd: string) => {
    const updated = [...profile.packages];
    const cmds = [...updated[i].commands];
    cmds[ci] = cmd;
    updated[i] = { ...updated[i], commands: cmds };
    update("packages", updated);
  };

  const addSoftwareCommand = (i: number) => {
    const updated = [...profile.packages];
    updated[i] = { ...updated[i], commands: [...updated[i].commands, ""] };
    update("packages", updated);
  };

  const removeSoftwareCommand = (i: number, ci: number) => {
    const updated = [...profile.packages];
    updated[i] = { ...updated[i], commands: updated[i].commands.filter((_, idx) => idx !== ci) };
    update("packages", updated);
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

  const sectionWrapper = (t: Tab, children: React.ReactNode) => {
    const disabled = isDisabled(t);
    const canDisable = DISABLEABLE.includes(t);
    return (
      <div>
        {canDisable && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!disabled}
                onChange={() => toggleSection(t)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-600">
                {disabled ? "Section disabled — settings preserved but skipped in script" : "Section enabled"}
              </span>
            </label>
          </div>
        )}
        <div className={disabled ? "opacity-40 pointer-events-none select-none" : ""}>
          {children}
        </div>
      </div>
    );
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Profile name</label>
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

      <div className="flex gap-1 border-b border-gray-200 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary-600 text-primary-600"
                : isDisabled(t)
                ? "border-transparent text-gray-300"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            {isDisabled(t) && <span className="ml-1 text-xs text-gray-300">(off)</span>}
            {t === "Scripts" && profile.custom_scripts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                {profile.custom_scripts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {tab === "System" && sectionWrapper("System",
          <div className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operating System</label>
                <select
                  value={profile.os}
                  onChange={(e) => update("os", e.target.value as Profile["os"])}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="ubuntu2404">Ubuntu 24.04</option>
                  <option value="ubuntu2204">Ubuntu 22.04</option>
                  <option value="debian11">Debian 11</option>
                  <option value="alpine318">Alpine 3.18</option>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
                <select
                  value={profile.system.locale}
                  onChange={(e) => update("system", { ...profile.system, locale: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {profile.os === "alpine318" && (
                  <p className="text-xs text-amber-500 mt-1">Alpine uses musl libc — locale support is limited</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={profile.system.timezone}
                  onChange={(e) => update("system", { ...profile.system, timezone: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Swap (MB)</label>
                <input
                  type="number"
                  value={profile.system.swap_mb ?? ""}
                  onChange={(e) => update("system", { ...profile.system, swap_mb: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 2048"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Leave empty to skip swap creation</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {profile.os === "alpine318" ? "Extlinux timeout (1/10s)" : "GRUB timeout (sec)"}
                </label>
                <input
                  type="number"
                  value={profile.system.grub_timeout ?? ""}
                  onChange={(e) => update("system", { ...profile.system, grub_timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 5"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.system.ntp}
                  onChange={(e) => update("system", { ...profile.system, ntp: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Enable NTP time synchronization</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.system.enable_tpm}
                  onChange={(e) => update("system", { ...profile.system, enable_tpm: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Enable TPM 2.0 support</span>
              </label>
            </div>
          </div>
        )}

        {tab === "Software" && sectionWrapper("Software",
          <div>
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-2">Quick add from presets:</p>
              <div className="flex flex-wrap gap-2">
                {softwarePresets.map((preset) => {
                  const alreadyAdded = profile.packages.some((p) => p.name === preset.name);
                  return (
                    <button
                      key={preset.name}
                      onClick={() => !alreadyAdded && addSoftwareItem(preset)}
                      disabled={alreadyAdded}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        alreadyAdded
                          ? "border-primary-300 bg-primary-50 text-primary-500 cursor-default"
                          : "border-gray-300 hover:bg-gray-50 hover:border-gray-400 cursor-pointer"
                      }`}
                    >
                      {alreadyAdded ? "✓ " : ""}{preset.name}
                    </button>
                  );
                })}
                <button
                  onClick={addCustomSoftwareItem}
                  className="px-3 py-1.5 text-sm rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
                >
                  + Custom
                </button>
              </div>
            </div>

            {profile.packages.length === 0 ? (
              <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                <p>No software added</p>
                <p className="text-sm mt-1">Use presets above or add a custom item</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Added: {profile.packages.length} item(s)
                </p>
                <div className="space-y-3">
                  {profile.packages.map((item, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          value={item.name}
                          onChange={(e) => updateSoftwareName(i, e.target.value)}
                          placeholder="Package / tool name"
                          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <button
                          onClick={() => removeSoftwareItem(i)}
                          className="px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        {item.commands.map((cmd, ci) => (
                          <div key={ci} className="flex gap-2">
                            <input
                              value={cmd}
                              onChange={(e) => updateSoftwareCommand(i, ci, e.target.value)}
                              placeholder="e.g. apt-get install -y vim"
                              className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            {item.commands.length > 1 && (
                              <button
                                onClick={() => removeSoftwareCommand(i, ci)}
                                className="text-gray-400 hover:text-red-500 px-2 transition-colors"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => addSoftwareCommand(i)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        + Add command
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "User" && sectionWrapper("User",
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

        {tab === "Network" && sectionWrapper("Network",
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={profile.network.mode}
                onChange={(e) => update("network", { ...profile.network, mode: e.target.value as "dhcp" | "static" })}
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

        {tab === "Security" && sectionWrapper("Security",
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.security.ufw}
                onChange={(e) => update("security", { ...profile.security, ufw: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">
                {profile.os === "alpine318" ? "Enable iptables firewall" : "Enable UFW firewall"}
              </span>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SSH Public Key</label>
              <textarea
                value={profile.security.ssh_key || ""}
                onChange={(e) => update("security", { ...profile.security, ssh_key: e.target.value || undefined })}
                placeholder="ssh-rsa AAAA..."
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
              />
            </div>
          </div>
        )}

        {tab === "Autostart" && sectionWrapper("Autostart",
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
                {profile.os === "alpine318"
                  ? "Will be registered as an OpenRC service running at boot."
                  : "Will be registered as a systemd service running at boot."}
                {" "}For custom scripts, use the Scripts tab instead.
              </p>
            </div>
          </div>
        )}

        {tab === "Scripts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Add custom bash scripts to run during provisioning.</p>
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
                        : profile.os === "alpine318"
                        ? "This script will be installed to /opt/easix/scripts/ and registered as an OpenRC service."
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
