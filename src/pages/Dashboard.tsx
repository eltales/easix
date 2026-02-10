import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
  </svg>
);

const IconDuplicate = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
  </svg>
);

const IconPreview = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

const IconDelete = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
);

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

  const handleDuplicate = async (name: string) => {
    try {
      const existing = await api.listProfiles();
      let suffix = 1;
      let target = `${name}_${String(suffix).padStart(2, "0")}`;
      while (existing.includes(target)) {
        suffix++;
        target = `${name}_${String(suffix).padStart(2, "0")}`;
      }
      await api.duplicateProfile(name, target);
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
              <div className="mt-4 flex gap-1">
                <button
                  onClick={() => navigate(`/editor/${name}`)}
                  title="Edit"
                  className="p-2 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-700 transition-colors"
                >
                  <IconEdit />
                </button>
                <button
                  onClick={() => handleDuplicate(name)}
                  title="Duplicate"
                  className="p-2 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-700 transition-colors"
                >
                  <IconDuplicate />
                </button>
                <button
                  onClick={() => {
                    sessionStorage.setItem("easix_preview_profile", name);
                    navigate("/preview");
                  }}
                  title="Preview"
                  className="p-2 text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200 hover:text-gray-700 transition-colors"
                >
                  <IconPreview />
                </button>
                <button
                  onClick={() => handleDelete(name)}
                  title="Delete"
                  className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors ml-auto"
                >
                  <IconDelete />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
