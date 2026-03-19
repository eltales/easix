import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Profile, CustomScript, DEFAULT_PROFILE, SoftwareItem } from "../types";
import { Select } from "../components/Select";

const TABS = ["System", "Software", "User", "Network", "Security", "Autostart", "Scripts"] as const;
type Tab = (typeof TABS)[number];

const DISABLEABLE: Tab[] = ["System", "Software", "User", "Network", "Security", "Autostart"];
const SECTION_KEY: Record<string, string> = {
  System: "system", Software: "packages", User: "user",
  Network: "network", Security: "security", Autostart: "autostart",
};

const SOFTWARE_PRESETS_DEB: SoftwareItem[] = [
  { name: "python3", commands: ["apt-get install -y python3"] },
  { name: "git",     commands: ["apt-get install -y git"] },
  { name: "vim",     commands: ["apt-get install -y vim"] },
  { name: "curl",    commands: ["apt-get install -y curl"] },
  { name: "wget",    commands: ["apt-get install -y wget"] },
  { name: "htop",    commands: ["apt-get install -y htop"] },
  { name: "net-tools", commands: ["apt-get install -y net-tools"] },
  { name: "nginx",   commands: ["apt-get install -y nginx", "systemctl enable nginx"] },
  { name: "openssh-server", commands: ["apt-get install -y openssh-server", "systemctl enable ssh"] },
  { name: "Docker",  commands: ["apt-get install -y ca-certificates curl gnupg", "curl -fsSL https://get.docker.com | sh", "systemctl enable docker"] },
  { name: "Node.js 20", commands: ["curl -fsSL https://deb.nodesource.com/setup_20.x | bash -", "apt-get install -y nodejs"] },
  { name: "ufw",     commands: ["apt-get install -y ufw"] },
];

const SOFTWARE_PRESETS_ALPINE: SoftwareItem[] = [
  { name: "python3", commands: ["apk add --quiet python3"] },
  { name: "git",     commands: ["apk add --quiet git"] },
  { name: "vim",     commands: ["apk add --quiet vim"] },
  { name: "curl",    commands: ["apk add --quiet curl"] },
  { name: "wget",    commands: ["apk add --quiet wget"] },
  { name: "htop",    commands: ["apk add --quiet htop"] },
  { name: "net-tools", commands: ["apk add --quiet net-tools"] },
  { name: "nginx",   commands: ["apk add --quiet nginx", "rc-update add nginx default"] },
  { name: "openssh", commands: ["apk add --quiet openssh", "rc-update add sshd default"] },
  { name: "Docker",  commands: ["apk add --quiet docker", "rc-update add docker default"] },
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
        setProfile({ ...p, custom_scripts: p.custom_scripts || [], disabled_sections: p.disabled_sections || [], system: p.system || DEFAULT_PROFILE.system });
        if (!isDuplicate) setProfileName(routeName);
      });
    }
  }, [routeName, isDuplicate]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  const isDisabled = (t: Tab) => profile.disabled_sections.includes(SECTION_KEY[t] || "");

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
      if (routeName && !isDuplicate && name !== originalName) await api.renameProfile(originalName, name);
      await api.saveProfile(name, profile);
      navigate("/");
    } catch (e) { alert(String(e)); }
    finally { setSaving(false); }
  };

  const addSoftwareItem = (item: SoftwareItem) =>
    update("packages", [...profile.packages, { ...item, commands: [...item.commands] }]);
  const addCustomSoftwareItem = () =>
    update("packages", [...profile.packages, { name: "", commands: [""] }]);
  const removeSoftwareItem = (i: number) =>
    update("packages", profile.packages.filter((_, idx) => idx !== i));
  const updateSoftwareName = (i: number, name: string) => {
    const u = [...profile.packages]; u[i] = { ...u[i], name }; update("packages", u);
  };
  const updateSoftwareCommand = (i: number, ci: number, cmd: string) => {
    const u = [...profile.packages]; const c = [...u[i].commands]; c[ci] = cmd; u[i] = { ...u[i], commands: c }; update("packages", u);
  };
  const addSoftwareCommand = (i: number) => {
    const u = [...profile.packages]; u[i] = { ...u[i], commands: [...u[i].commands, ""] }; update("packages", u);
  };
  const removeSoftwareCommand = (i: number, ci: number) => {
    const u = [...profile.packages]; u[i] = { ...u[i], commands: u[i].commands.filter((_, idx) => idx !== ci) }; update("packages", u);
  };
  const addScript = () =>
    update("custom_scripts", [...profile.custom_scripts, { name: "", content: "#!/bin/bash\n", mode: "run_once" }]);
  const updateScript = (index: number, field: keyof CustomScript, value: string) => {
    const u = [...profile.custom_scripts]; u[index] = { ...u[index], [field]: value }; update("custom_scripts", u);
  };
  const removeScript = (index: number) =>
    update("custom_scripts", profile.custom_scripts.filter((_, i) => i !== index));

  const sectionWrapper = (t: Tab, children: React.ReactNode) => {
    const disabled = isDisabled(t);
    const canDisable = DISABLEABLE.includes(t);
    return (
      <div>
        {canDisable && (
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-500">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={!disabled} onChange={() => toggleSection(t)} className="rounded accent-primary-500" />
              <span className="text-sm text-surface-100">
                {disabled ? "Section disabled — settings preserved but skipped in script" : "Section enabled"}
              </span>
            </label>
          </div>
        )}
        <div className={disabled ? "opacity-40 pointer-events-none select-none" : ""}>{children}</div>
      </div>
    );
  };

  const labelCls = "block text-sm font-medium text-surface-100 mb-1.5";
  const inputCls = "input w-full";
  const hintCls  = "text-xs text-surface-300 mt-1";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-surface-50">
          {isDuplicate ? "Duplicate Profile" : routeName ? `Edit: ${routeName}` : "New Profile"}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => navigate("/")}
            className="px-4 py-2 text-sm rounded-lg border border-surface-500 text-surface-100 hover:bg-surface-700 transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* Profile name */}
      <div className="mb-6">
        <label className={labelCls}>Profile name</label>
        <input value={profileName} onChange={(e) => setProfileName(e.target.value)}
          placeholder="e.g. lab-workstation" className="w-64 input" />
        {routeName && !isDuplicate && profileName !== originalName && profileName.trim() && (
          <p className="text-xs text-amber-400 mt-1">
            Profile will be renamed from "{originalName}" to "{profileName.trim()}"
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-surface-500 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-primary-500 text-primary-400"
                : isDisabled(t)
                ? "border-transparent text-surface-300"
                : "border-transparent text-surface-200 hover:text-surface-50"
            }`}
          >
            {t}
            {isDisabled(t) && <span className="ml-1 text-xs text-surface-300">(off)</span>}
            {t === "Scripts" && profile.custom_scripts.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-primary-600/20 text-primary-400 rounded-full">
                {profile.custom_scripts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-surface-700 border border-surface-500 rounded-xl p-6">

        {/* ── System ─────────────────────────────────────────────────────── */}
        {tab === "System" && sectionWrapper("System",
          <div className="space-y-4 max-w-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Operating System</label>
                <Select
                  value={profile.os}
                  onChange={(v) => update("os", v as Profile["os"])}
                  options={[
                    { value: "ubuntu2404", label: "Ubuntu 24.04" },
                    { value: "ubuntu2204", label: "Ubuntu 22.04" },
                    { value: "debian11",   label: "Debian 11" },
                    { value: "alpine318",  label: "Alpine 3.18" },
                  ]}
                />
              </div>
              <div>
                <label className={labelCls}>Hostname</label>
                <input value={profile.hostname} onChange={(e) => update("hostname", e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Locale</label>
                <Select
                  value={profile.system.locale}
                  onChange={(v) => update("system", { ...profile.system, locale: v })}
                  options={LOCALES.map((l) => ({ value: l, label: l }))}
                />
                {profile.os === "alpine318" && <p className="text-xs text-amber-400 mt-1">Alpine uses musl libc — locale support is limited</p>}
              </div>
              <div>
                <label className={labelCls}>Timezone</label>
                <Select
                  value={profile.system.timezone}
                  onChange={(v) => update("system", { ...profile.system, timezone: v })}
                  options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Swap (MB)</label>
                <input type="number" value={profile.system.swap_mb ?? ""}
                  onChange={(e) => update("system", { ...profile.system, swap_mb: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 2048" className={inputCls} />
                <p className={hintCls}>Leave empty to skip swap creation</p>
              </div>
              <div>
                <label className={labelCls}>{profile.os === "alpine318" ? "Extlinux timeout (1/10s)" : "GRUB timeout (sec)"}</label>
                <input type="number" value={profile.system.grub_timeout ?? ""}
                  onChange={(e) => update("system", { ...profile.system, grub_timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g. 5" className={inputCls} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.system.ntp} onChange={(e) => update("system", { ...profile.system, ntp: e.target.checked })} className="rounded accent-primary-500" />
                <span className="text-sm text-surface-100">Enable NTP time synchronization</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={profile.system.enable_tpm} onChange={(e) => update("system", { ...profile.system, enable_tpm: e.target.checked })} className="rounded accent-primary-500" />
                <span className="text-sm text-surface-100">Enable TPM 2.0 support</span>
              </label>
            </div>
          </div>
        )}

        {/* ── Software ───────────────────────────────────────────────────── */}
        {tab === "Software" && sectionWrapper("Software",
          <div>
            <div className="mb-5">
              <p className="text-sm text-surface-200 mb-3">Quick add from presets:</p>
              <div className="flex flex-wrap gap-2">
                {softwarePresets.map((preset) => {
                  const added = profile.packages.some((p) => p.name === preset.name);
                  return (
                    <button key={preset.name} onClick={() => !added && addSoftwareItem(preset)} disabled={added}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        added
                          ? "border-primary-600/40 bg-primary-600/10 text-primary-400 cursor-default"
                          : "border-surface-500 text-surface-100 hover:bg-surface-600 hover:border-surface-400 cursor-pointer"
                      }`}>
                      {added ? "✓ " : ""}{preset.name}
                    </button>
                  );
                })}
                <button onClick={addCustomSoftwareItem}
                  className="px-3 py-1.5 text-sm rounded-lg border border-dashed border-surface-400 text-surface-200 hover:border-primary-500 hover:text-primary-400 transition-colors">
                  + Custom
                </button>
              </div>
            </div>
            {profile.packages.length === 0 ? (
              <div className="text-center py-10 text-surface-300 border border-dashed border-surface-500 rounded-xl">
                <p className="text-surface-200">No software added</p>
                <p className="text-sm mt-1">Use presets above or add a custom item</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-surface-100 mb-3">Added: {profile.packages.length} item(s)</p>
                <div className="space-y-3">
                  {profile.packages.map((item, i) => (
                    <div key={i} className="border border-surface-500 rounded-xl p-4 bg-surface-800">
                      <div className="flex items-center gap-3 mb-3">
                        <input value={item.name} onChange={(e) => updateSoftwareName(i, e.target.value)}
                          placeholder="Package / tool name"
                          className="flex-1 input font-medium" />
                        <button onClick={() => removeSoftwareItem(i)}
                          className="px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        {item.commands.map((cmd, ci) => (
                          <div key={ci} className="flex gap-2">
                            <input value={cmd} onChange={(e) => updateSoftwareCommand(i, ci, e.target.value)}
                              placeholder="e.g. apt-get install -y vim"
                              className="flex-1 input font-mono text-xs" />
                            {item.commands.length > 1 && (
                              <button onClick={() => removeSoftwareCommand(i, ci)}
                                className="text-surface-300 hover:text-red-400 px-2 transition-colors">×</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addSoftwareCommand(i)}
                        className="mt-2 text-xs text-primary-400 hover:text-primary-300 transition-colors">
                        + Add command
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── User ───────────────────────────────────────────────────────── */}
        {tab === "User" && sectionWrapper("User",
          <div className="space-y-4 max-w-md">
            <div>
              <label className={labelCls}>Username</label>
              <input value={profile.user.name} onChange={(e) => update("user", { ...profile.user, name: e.target.value })} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profile.user.sudo} onChange={(e) => update("user", { ...profile.user, sudo: e.target.checked })} className="rounded accent-primary-500" />
              <span className="text-sm text-surface-100">Grant sudo privileges</span>
            </label>
          </div>
        )}

        {/* ── Network ────────────────────────────────────────────────────── */}
        {tab === "Network" && sectionWrapper("Network",
          <div className="space-y-4 max-w-md">
            <div>
              <label className={labelCls}>Mode</label>
              <Select
                value={profile.network.mode}
                onChange={(v) => update("network", { ...profile.network, mode: v as "dhcp" | "static" })}
                options={[{ value: "dhcp", label: "DHCP" }, { value: "static", label: "Static" }]}
              />
            </div>
            {profile.network.mode === "static" && (
              <>
                <div>
                  <label className={labelCls}>IP Address (CIDR)</label>
                  <input value={profile.network.address || ""} onChange={(e) => update("network", { ...profile.network, address: e.target.value })} placeholder="192.168.1.100/24" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gateway</label>
                  <input value={profile.network.gateway || ""} onChange={(e) => update("network", { ...profile.network, gateway: e.target.value })} placeholder="192.168.1.1" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>DNS</label>
                  <input value={profile.network.dns || ""} onChange={(e) => update("network", { ...profile.network, dns: e.target.value })} placeholder="8.8.8.8" className={inputCls} />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Security ───────────────────────────────────────────────────── */}
        {tab === "Security" && sectionWrapper("Security",
          <div className="space-y-4 max-w-md">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profile.security.ufw} onChange={(e) => update("security", { ...profile.security, ufw: e.target.checked })} className="rounded accent-primary-500" />
              <span className="text-sm text-surface-100">{profile.os === "alpine318" ? "Enable iptables firewall" : "Enable UFW firewall"}</span>
            </label>
            <div>
              <label className={labelCls}>SSH Public Key</label>
              <textarea value={profile.security.ssh_key || ""} onChange={(e) => update("security", { ...profile.security, ssh_key: e.target.value || undefined })}
                placeholder="ssh-rsa AAAA..." rows={3}
                className="input w-full font-mono resize-none" />
            </div>
          </div>
        )}

        {/* ── Autostart ──────────────────────────────────────────────────── */}
        {tab === "Autostart" && sectionWrapper("Autostart",
          <div className="space-y-4 max-w-md">
            <div>
              <label className={labelCls}>Startup script path</label>
              <input value={profile.autostart || ""} onChange={(e) => update("autostart", e.target.value || undefined)}
                placeholder="/opt/myapp/start.sh" className="input w-full font-mono" />
              <p className={hintCls}>
                {profile.os === "alpine318"
                  ? "Will be registered as an OpenRC service running at boot."
                  : "Will be registered as a systemd service running at boot."}
                {" "}For custom scripts, use the Scripts tab instead.
              </p>
            </div>
          </div>
        )}

        {/* ── Scripts ────────────────────────────────────────────────────── */}
        {tab === "Scripts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-surface-200">Add custom bash scripts to run during provisioning.</p>
              <button onClick={addScript}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors">
                + Add Script
              </button>
            </div>
            {profile.custom_scripts.length === 0 ? (
              <div className="text-center py-12 text-surface-300 border border-dashed border-surface-500 rounded-xl">
                <p className="text-surface-200">No custom scripts</p>
                <p className="text-sm mt-1">Add scripts to run once or register as autostart services</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profile.custom_scripts.map((script, i) => (
                  <div key={i} className="border border-surface-500 rounded-xl p-4 bg-surface-800">
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-surface-200 mb-1">Script name</label>
                        <input value={script.name} onChange={(e) => updateScript(i, "name", e.target.value)}
                          placeholder="e.g. setup-db" className="input w-full" />
                      </div>
                      <div className="w-40">
                        <label className="block text-xs font-medium text-surface-200 mb-1">Mode</label>
                        <Select
                          value={script.mode}
                          onChange={(v) => updateScript(i, "mode", v)}
                          options={[{ value: "run_once", label: "Run once" }, { value: "autostart", label: "Autostart" }]}
                        />
                      </div>
                      <div className="flex items-end">
                        <button onClick={() => removeScript(i)}
                          className="px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-200 mb-1">Content</label>
                      <textarea value={script.content} onChange={(e) => updateScript(i, "content", e.target.value)}
                        rows={6} className="input w-full font-mono text-xs resize-none"
                        placeholder={"#!/bin/bash\necho 'Hello from custom script'"} />
                    </div>
                    <p className={hintCls}>
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
