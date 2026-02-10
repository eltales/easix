import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/editor", label: "Editor" },
  { to: "/preview", label: "Preview" },
  { to: "/deploy", label: "Deploy" },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      <nav className="w-56 bg-gray-900 text-gray-100 flex flex-col">
        <div className="px-5 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Easix</h1>
          <p className="text-xs text-gray-400 mt-1">System provisioning</p>
        </div>
        <ul className="flex-1 px-3 space-y-1">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="px-5 py-4 text-xs text-gray-500">v0.1.0</div>
      </nav>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
