import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Profile } from "../types";

export default function Preview() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [script, setScript] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (!selected) {
      setProfile(null);
      setScript("");
      setWarnings([]);
      return;
    }
    setLoading(true);
    setError("");
    setWarnings([]);
    api
      .getProfile(selected)
      .then(async (p) => {
        setProfile(p);
        const [s, w] = await Promise.all([
          api.generateScript(p),
          api.validateScript(p),
        ]);
        setScript(s);
        setWarnings(w);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selected]);

  const handleExport = async () => {
    if (!script) return;
    try {
      const path = await api.exportScript(script, `${selected || "provision"}.sh`);
      if (path) setError("");
    } catch (e) {
      setError(String(e));
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(script);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Preview & Export</h2>
          <p className="text-gray-500 mt-1">Review the generated provisioning script</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Select profile</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-64 border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">-- Choose --</option>
          {profiles.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>}
      {loading && <p className="text-gray-500">Generating script...</p>}

      {script && !loading && (
        <>
          {profile && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><span className="text-gray-500">OS:</span> {profile.os === "ubuntu2204" ? "Ubuntu 22.04" : "Debian 11"}</div>
              <div><span className="text-gray-500">Host:</span> {profile.hostname}</div>
              <div><span className="text-gray-500">User:</span> {profile.user.name}{profile.user.sudo && " (sudo)"}</div>
              <div><span className="text-gray-500">Packages:</span> {profile.packages.length}</div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-amber-800 mb-2">Validation warnings</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 mb-3">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Copy to clipboard
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Save as .sh
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem("easix_deploy_profile", selected);
                navigate("/deploy");
              }}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Deploy via SSH
            </button>
          </div>

          <pre className="bg-gray-900 text-gray-100 p-5 rounded-lg text-sm overflow-auto max-h-[60vh] font-mono leading-relaxed">
            {script}
          </pre>
        </>
      )}
    </div>
  );
}
