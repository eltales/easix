import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Profile } from "../types";
import { Select } from "../components/Select";

export default function Preview() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [script, setScript] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dryRunResult, setDryRunResult] = useState<string | null>(null);
  const [dryRunning, setDryRunning] = useState(false);

  useEffect(() => {
    api.listProfiles().then((list) => {
      setProfiles(list);
      const stored = sessionStorage.getItem("easix_preview_profile");
      if (stored && list.includes(stored)) {
        setSelected(stored);
        sessionStorage.removeItem("easix_preview_profile");
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) { setProfile(null); setScript(""); setWarnings([]); return; }
    setLoading(true); setError(""); setWarnings([]);
    api.getProfile(selected)
      .then(async (p) => {
        setProfile(p);
        const [s, w] = await Promise.all([api.generateScript(p), api.validateScript(p)]);
        setScript(s); setWarnings(w);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  const handleExport = async () => {
    if (!script) return;
    try { await api.exportScript(script, `${selected || "provision"}.sh`); }
    catch (e) { setError(String(e)); }
  };

  const handleCopy = () => navigator.clipboard.writeText(script);

  const handleDryRun = async () => {
    if (!script) return;
    setDryRunning(true); setDryRunResult(null);
    try { setDryRunResult(await api.dryRunScript(script)); }
    catch (e) { setDryRunResult(String(e)); }
    finally { setDryRunning(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-surface-50">Preview & Export</h2>
          <p className="text-surface-200 mt-1 text-sm">Review the generated provisioning script</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-surface-100 mb-1.5">Select profile</label>
        <Select
          value={selected}
          onChange={setSelected}
          options={[{ value: "", label: "-- Choose --" }, ...profiles.map((n) => ({ value: n, label: n }))]}
          className="w-64"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 p-4 rounded-xl mb-4 text-sm">{error}</div>
      )}
      {loading && <p className="text-surface-200 text-sm">Generating script...</p>}

      {script && !loading && (
        <>
          {profile && (
            <div className="bg-surface-700 border border-surface-500 rounded-xl p-4 mb-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><span className="text-surface-200">OS: </span><span className="text-surface-50">{profile.os === "ubuntu2404" ? "Ubuntu 24.04" : profile.os === "ubuntu2204" ? "Ubuntu 22.04" : profile.os === "alpine318" ? "Alpine 3.18" : "Debian 11"}</span></div>
              <div><span className="text-surface-200">Host: </span><span className="text-surface-50">{profile.hostname}</span></div>
              <div><span className="text-surface-200">User: </span><span className="text-surface-50">{profile.user.name}{profile.user.sudo && " (sudo)"}</span></div>
              <div><span className="text-surface-200">Packages: </span><span className="text-surface-50">{profile.packages.length}</span></div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-medium text-amber-400 mb-2">Validation warnings</h4>
              <ul className="text-sm text-amber-300/80 space-y-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mb-3 flex-wrap">
            <button onClick={handleCopy}
              className="px-3 py-1.5 text-sm bg-surface-600 text-surface-100 rounded-lg hover:bg-surface-500 transition-colors border border-surface-500">
              Copy to clipboard
            </button>
            <button onClick={handleExport}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors">
              Save as .sh
            </button>
            <button onClick={handleDryRun} disabled={dryRunning}
              className="px-3 py-1.5 text-sm bg-amber-600/80 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {dryRunning ? "Running..." : "Dry Run (shellcheck)"}
            </button>
            <button onClick={() => { sessionStorage.setItem("easix_deploy_profile", selected); navigate("/deploy"); }}
              className="px-3 py-1.5 text-sm bg-green-700/80 text-white rounded-lg hover:bg-green-700 transition-colors">
              Deploy via SSH
            </button>
          </div>

          {dryRunResult !== null && (
            <div className={`mb-4 rounded-xl border p-4 ${dryRunResult === "shellcheck: no issues found"
              ? "bg-green-900/20 border-green-700/40"
              : "bg-amber-900/20 border-amber-700/40"}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-medium ${dryRunResult === "shellcheck: no issues found" ? "text-green-400" : "text-amber-400"}`}>
                  Dry Run Result
                </h4>
                <button onClick={() => setDryRunResult(null)} className="text-surface-300 hover:text-surface-100 text-sm">✕</button>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap text-surface-100">{dryRunResult}</pre>
            </div>
          )}

          <pre className="bg-surface-800 border border-surface-500 text-green-400 p-5 rounded-xl text-sm overflow-auto max-h-[60vh] font-mono leading-relaxed">
            {script}
          </pre>
        </>
      )}
    </div>
  );
}
