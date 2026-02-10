import { useEffect, useState } from "react";
import { api } from "../api";

export default function Deploy() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [output, setOutput] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProfiles().then((list) => {
      setProfiles(list);
      const stored = sessionStorage.getItem("easix_deploy_profile");
      if (stored && list.includes(stored)) {
        setSelected(stored);
        sessionStorage.removeItem("easix_deploy_profile");
      }
    });
  }, []);

  const handleDeploy = async () => {
    if (!selected) return setError("Select a profile");
    if (!host.trim()) return setError("Host is required");
    setError("");
    setOutput("");
    setDeploying(true);
    try {
      const profile = await api.getProfile(selected);
      const res = await api.deploySsh({
        profile,
        host: host.trim(),
        port: parseInt(port) || 22,
        username: username || "root",
        password: password || undefined,
        keyPath: keyPath || undefined,
      });
      setOutput(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">SSH Deploy</h2>
      <p className="text-gray-500 mb-6">Upload and execute a provisioning script on a remote machine</p>

      <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-lg space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">-- Choose --</option>
            {profiles.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.50"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for key auth"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">SSH Key Path</label>
          <input
            value={keyPath}
            onChange={(e) => setKeyPath(e.target.value)}
            placeholder="~/.ssh/id_rsa"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
          />
        </div>

        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="w-full py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {deploying ? "Deploying..." : "Deploy Now"}
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">{error}</div>}

      {output && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Output</h3>
          <pre className="bg-gray-900 text-green-400 p-5 rounded-lg text-sm overflow-auto max-h-[50vh] font-mono leading-relaxed">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}
