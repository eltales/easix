import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Profile, CustomScript, DEFAULT_PROFILE, SoftwareItem, TaskType } from "../types";
import { Select } from "../components/Select";

const TABS = ["System", "Software", "User", "Network", "Security", "Scripts"] as const;
type Tab = (typeof TABS)[number];

const DISABLEABLE: Tab[] = ["System", "Software", "User", "Network", "Security"];
const SECTION_KEY: Record<string, string> = {
  System: "system", Software: "packages", User: "user",
  Network: "network", Security: "security",
};

const SOFTWARE_PRESETS_DEB: SoftwareItem[] = [
  { name: "python3",       task_type: "package", commands: ["apt-get install -y python3"] },
  { name: "git",           task_type: "package", commands: ["apt-get install -y git"] },
  { name: "vim",           task_type: "package", commands: ["apt-get install -y vim"] },
  { name: "curl",          task_type: "package", commands: ["apt-get install -y curl"] },
  { name: "wget",          task_type: "package", commands: ["apt-get install -y wget"] },
  { name: "htop",          task_type: "package", commands: ["apt-get install -y htop"] },
  { name: "net-tools",     task_type: "package", commands: ["apt-get install -y net-tools"] },
  { name: "nginx",         task_type: "package", commands: ["apt-get install -y nginx", "systemctl enable nginx"] },
  { name: "openssh-server",task_type: "package", commands: ["apt-get install -y openssh-server", "systemctl enable ssh"] },
  { name: "Docker",        task_type: "package", check_cmd: "command -v docker", commands: ["apt-get install -y ca-certificates curl gnupg", "curl -fsSL https://get.docker.com | sh", "systemctl enable docker"] },
  { name: "Node.js 20",    task_type: "package", check_cmd: "command -v node", commands: ["curl -fsSL https://deb.nodesource.com/setup_20.x | bash -", "apt-get install -y nodejs"] },
  { name: "ufw",           task_type: "package", commands: ["apt-get install -y ufw"] },
];

const SOFTWARE_PRESETS_ALPINE: SoftwareItem[] = [
  { name: "python3",  task_type: "package", commands: ["apk add --quiet python3"] },
  { name: "git",      task_type: "package", commands: ["apk add --quiet git"] },
  { name: "vim",      task_type: "package", commands: ["apk add --quiet vim"] },
  { name: "curl",     task_type: "package", commands: ["apk add --quiet curl"] },
  { name: "wget",     task_type: "package", commands: ["apk add --quiet wget"] },
  { name: "htop",     task_type: "package", commands: ["apk add --quiet htop"] },
  { name: "net-tools",task_type: "package", commands: ["apk add --quiet net-tools"] },
  { name: "nginx",    task_type: "package", commands: ["apk add --quiet nginx", "rc-update add nginx default"] },
  { name: "openssh",  task_type: "package", commands: ["apk add --quiet openssh", "rc-update add sshd default"] },
  { name: "Docker",   task_type: "package", check_cmd: "command -v docker", commands: ["apk add --quiet docker", "rc-update add docker default"] },
  { name: "Node.js",  task_type: "package", check_cmd: "command -v node", commands: ["apk add --quiet nodejs npm"] },
  { name: "iptables", task_type: "package", commands: ["apk add --quiet iptables"] },
];

const SOFTWARE_PRESETS_WIN: SoftwareItem[] = [
  { name: "git",             task_type: "package", check_cmd: "git --version", commands: ["winget install --id Git.Git -e --silent"] },
  { name: "python3",         task_type: "package", check_cmd: "python --version", commands: ["winget install --id Python.Python.3.12 -e --silent"] },
  { name: "nodejs",          task_type: "package", check_cmd: "node --version", commands: ["winget install --id OpenJS.NodeJS.LTS -e --silent"] },
  { name: "notepadplusplus", task_type: "package", commands: ["winget install --id Notepad++.Notepad++ -e --silent"] },
  { name: "7zip",            task_type: "package", commands: ["winget install --id 7zip.7zip -e --silent"] },
  { name: "googlechrome",    task_type: "package", commands: ["winget install --id Google.Chrome -e --silent"] },
  { name: "vlc",             task_type: "package", commands: ["winget install --id VideoLAN.VLC -e --silent"] },
  { name: "docker-desktop",  task_type: "package", check_cmd: "docker --version", commands: ["winget install --id Docker.DockerDesktop -e --silent"] },
  { name: "winscp",          task_type: "package", commands: ["winget install --id WinSCP.WinSCP -e --silent"] },
  { name: "putty",           task_type: "package", commands: ["winget install --id PuTTY.PuTTY -e --silent"] },
  { name: "openssh-server",  task_type: "service", check_cmd: "(Get-Service sshd -ErrorAction SilentlyContinue).Status -eq 'Running'", commands: ["Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0", "Start-Service sshd", "Set-Service -Name sshd -StartupType Automatic"] },
  { name: "wuauserv (Windows Update)", task_type: "service", commands: ["Set-Service wuauserv -StartupType Automatic", "Start-Service wuauserv"] },
];

const TASK_TYPE_OPTIONS = [
  { value: "package", label: "Package" },
  { value: "service", label: "Service" },
  { value: "user",    label: "User" },
  { value: "file",    label: "File" },
  { value: "command", label: "Command" },
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
  const isAlpine   = profile.os === "alpine318";
  const isWindows  = profile.os.startsWith("windows");
  const softwarePresets = isWindows
    ? SOFTWARE_PRESETS_WIN
    : isAlpine
    ? SOFTWARE_PRESETS_ALPINE
    : SOFTWARE_PRESETS_DEB;

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
    update("packages", [...profile.packages, { name: "", task_type: "command" as TaskType, commands: [""] }]);
  const removeSoftwareItem = (i: number) =>
    update("packages", profile.packages.filter((_, idx) => idx !== i));
  const updateSoftwareName = (i: number, name: string) => {
    const u = [...profile.packages]; u[i] = { ...u[i], name }; update("packages", u);
  };
  const updateSoftwareTaskType = (i: number, task_type: TaskType) => {
    const u = [...profile.packages]; u[i] = { ...u[i], task_type }; update("packages", u);
  };
  const updateSoftwareCheckCmd = (i: number, check_cmd: string) => {
    const u = [...profile.packages]; u[i] = { ...u[i], check_cmd: check_cmd || undefined }; update("packages", u);
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
          <div className="space-y-3 max-w-lg">
            {/* OS — always visible */}
            <div>
              <label className={labelCls}>Operating System</label>
              <Select
                value={profile.os}
                onChange={(v) => update("os", v as Profile["os"])}
                options={[
                  { value: "ubuntu2404",  label: "Ubuntu 24.04" },
                  { value: "ubuntu2204",  label: "Ubuntu 22.04" },
                  { value: "debian11",    label: "Debian 11" },
                  { value: "alpine318",   label: "Alpine 3.18" },
                  { value: "windows2022", label: "Windows Server 2022" },
                  { value: "windows2019", label: "Windows Server 2019" },
                  { value: "windows11",   label: "Windows 11 Pro" },
                  { value: "windows10",   label: "Windows 10 Pro" },
                ]}
              />
            </div>

            <div className="border-t border-surface-500 pt-4 space-y-4">
              {/* Hostname */}
              <div>
                <label className={labelCls}>Hostname</label>
                <input
                  value={profile.hostname}
                  onChange={(e) => update("hostname", e.target.value)}
                  className={inputCls}
                  placeholder="— No change —"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Locale */}
                <div>
                  <label className={labelCls}>Locale</label>
                  <Select
                    value={profile.system.locale}
                    onChange={(v) => update("system", { ...profile.system, locale: v })}
                    options={[
                      { value: "", label: "— No change —" },
                      ...LOCALES.map((l) => ({ value: l, label: l })),
                    ]}
                  />
                  {isAlpine && profile.system.locale && (
                    <p className="text-xs text-amber-400 mt-1">Alpine: musl libc — limited locale support</p>
                  )}
                </div>

                {/* Timezone */}
                <div>
                  <label className={labelCls}>Timezone</label>
                  <Select
                    value={profile.system.timezone}
                    onChange={(v) => update("system", { ...profile.system, timezone: v })}
                    options={[
                      { value: "", label: "— No change —" },
                      ...TIMEZONES.map((tz) => ({ value: tz, label: tz })),
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Swap */}
                <div>
                  <label className={labelCls}>Swap (MB)</label>
                  <input
                    type="number"
                    value={profile.system.swap_mb ?? ""}
                    onChange={(e) => update("system", { ...profile.system, swap_mb: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="— No change —"
                    className={inputCls}
                  />
                </div>

                {/* GRUB / Extlinux timeout */}
                {!isWindows && (
                  <div>
                    <label className={labelCls}>{isAlpine ? "Extlinux timeout (×100ms)" : "GRUB timeout (sec)"}</label>
                    <input
                      type="number"
                      value={profile.system.grub_timeout ?? ""}
                      onChange={(e) => update("system", { ...profile.system, grub_timeout: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="— No change —"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>

              {/* Checkboxes — NTP / TPM (genuinely boolean, no "no change" concept) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={profile.system.ntp}
                    onChange={(e) => update("system", { ...profile.system, ntp: e.target.checked })}
                    className="rounded accent-primary-500" />
                  <span className="text-sm text-surface-100">Enable NTP time synchronization</span>
                </label>
                {!isWindows && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={profile.system.enable_tpm}
                      onChange={(e) => update("system", { ...profile.system, enable_tpm: e.target.checked })}
                      className="rounded accent-primary-500" />
                    <span className="text-sm text-surface-100">Enable TPM 2.0 support</span>
                  </label>
                )}
              </div>
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
                  const addedIdx = profile.packages.findIndex((p) => p.name === preset.name);
                  const added = addedIdx !== -1;
                  return (
                    <button key={preset.name}
                      onClick={() => added ? removeSoftwareItem(addedIdx) : addSoftwareItem(preset)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        added
                          ? "border-primary-600/40 bg-primary-600/10 text-primary-400 hover:bg-red-900/20 hover:border-red-500/40 hover:text-red-400"
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
                      <div className="flex items-center gap-2 mb-3">
                        <input value={item.name} onChange={(e) => updateSoftwareName(i, e.target.value)}
                          placeholder="Package / tool name"
                          className="flex-1 input font-medium" />
                        <div className="w-32">
                          <Select
                            value={item.task_type}
                            onChange={(v) => updateSoftwareTaskType(i, v as TaskType)}
                            options={TASK_TYPE_OPTIONS}
                          />
                        </div>
                        <button onClick={() => removeSoftwareItem(i)}
                          className="px-2 py-1.5 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-colors">
                          Remove
                        </button>
                      </div>
                      {item.task_type !== "command" && (
                        <div className="mb-2">
                          <input
                            value={item.check_cmd ?? ""}
                            onChange={(e) => updateSoftwareCheckCmd(i, e.target.value)}
                            placeholder={
                              item.task_type === "package" ? "Check cmd (e.g. command -v vim) — auto if empty" :
                              item.task_type === "service" ? "Check cmd (e.g. systemctl is-active nginx) — auto if empty" :
                              item.task_type === "user"    ? "Check cmd (e.g. id username) — auto if empty" :
                              item.task_type === "file"    ? "File path to check (e.g. /etc/app.conf) — auto if empty" :
                              "Custom idempotency check command"
                            }
                            className="w-full input font-mono text-xs text-surface-300"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        {item.commands.map((cmd, ci) => (
                          <div key={ci} className="flex gap-2">
                            <input value={cmd} onChange={(e) => updateSoftwareCommand(i, ci, e.target.value)}
                              placeholder={isWindows ? "e.g. winget install --id Git.Git -e --silent" : "e.g. apt-get install -y vim"}
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
              <span className="text-sm text-surface-100">
                {isAlpine ? "Enable iptables firewall" : isWindows ? "Enable Windows Defender Firewall" : "Enable UFW firewall"}
              </span>
            </label>
            <div>
              <label className={labelCls}>SSH Public Key</label>
              <textarea value={profile.security.ssh_key || ""} onChange={(e) => update("security", { ...profile.security, ssh_key: e.target.value || undefined })}
                placeholder="ssh-rsa AAAA..." rows={3}
                className="input w-full font-mono resize-none" />
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
                        ? isWindows
                          ? "Script runs once as a temporary .ps1 file, then is removed."
                          : "Script runs once during provisioning, then is removed."
                        : isAlpine
                        ? "Installed to /opt/easix/scripts/ and registered as an OpenRC service."
                        : isWindows
                        ? "Saved to C:\\easix\\scripts\\ and registered as a Scheduled Task at startup."
                        : "Installed to /opt/easix/scripts/ and registered as a systemd service."}
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
