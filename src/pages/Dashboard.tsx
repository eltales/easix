import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Dashboard() {
  const [profiles, setProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api
      .listProfiles()
      .then(setProfiles)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    try {
      await api.deleteProfile(name);
      load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-gray-500 mt-1">Manage configuration profiles</p>
        </div>
        <button
          onClick={() => navigate("/editor")}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          + New Profile
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No profiles yet</p>
          <p className="text-sm mt-1">Create your first configuration profile</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((name) => (
            <div
              key={name}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-lg">{name}</h3>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate(`/editor/${name}`)}
                  className="text-sm px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => navigate(`/editor/${name}?duplicate=true`)}
                  className="text-sm px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem("easix_preview_profile", name);
                    navigate("/preview");
                  }}
                  className="text-sm px-3 py-1.5 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleDelete(name)}
                  className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
