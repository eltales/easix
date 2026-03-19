import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  ACCENT_THEMES, BG_THEMES, FONT_THEMES,
  applyAccent, applyBg, applyFont,
} from "../theme";

const links = [
  { to: "/",        label: "Dashboard" },
  { to: "/editor",  label: "Editor"    },
  { to: "/preview", label: "Preview"   },
  { to: "/deploy",  label: "Deploy"    },
  { to: "/devices", label: "Devices"   },
];

const IconGear = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M8.34 1.804A1 1 0 019.32 1h1.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.416.587l1.25-.834a1 1 0 011.262.125l.962.962a1 1 0 01.125 1.262l-.834 1.25c.245.445.443.919.587 1.416l1.473.294a1 1 0 01.804.98v1.361a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.587 1.416l.834 1.25a1 1 0 01-.125 1.262l-.962.962a1 1 0 01-1.262.125l-1.25-.834a6.953 6.953 0 01-1.416.587l-.294 1.473a1 1 0 01-.98.804H9.32a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.416-.587l-1.25.834a1 1 0 01-1.262-.125l-.962-.962a1 1 0 01-.125-1.262l.834-1.25a6.957 6.957 0 01-.587-1.416l-1.473-.294A1 1 0 011 10.68V9.32a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.587-1.416l-.834-1.25a1 1 0 01.125-1.262l.962-.962A1 1 0 015.38 3.03l1.25.834a6.957 6.957 0 011.416-.587L8.34 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const IconClose = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

export default function Layout() {
  const [showSettings, setShowSettings] = useState(false);
  const [accent, setAccent] = useState(
    () => localStorage.getItem("easix-accent") ?? "blue"
  );
  const [bg, setBg] = useState(
    () => localStorage.getItem("easix-bg") ?? "dark"
  );
  const [font, setFont] = useState(
    () => localStorage.getItem("easix-font") ?? "neutral"
  );

  const handleAccent = (id: string) => { applyAccent(id); setAccent(id); };
  const handleBg     = (id: string) => { applyBg(id);     setBg(id);     };
  const handleFont   = (id: string) => { applyFont(id);   setFont(id);   };

  return (
    <div className="flex h-screen bg-surface-900">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <nav className="w-56 bg-surface-800 flex flex-col border-r border-surface-500 flex-shrink-0">
        {/* Logo */}
        <div className="px-5 py-6">
          <h1 className="text-xl font-bold tracking-tight text-white">Easix</h1>
          <p className="text-xs text-surface-200 mt-0.5">System provisioning</p>
        </div>

        {/* Nav links */}
        <ul className="flex-1 px-3 space-y-0.5">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-600/20 text-primary-400 border border-primary-600/30"
                      : "text-surface-100 hover:bg-surface-700 hover:text-white"
                  }`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Bottom: settings gear + version */}
        <div className="px-3 pb-4 space-y-1">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-200 hover:bg-surface-700 hover:text-white transition-colors"
          >
            <IconGear />
            <span>Appearance</span>
          </button>
          <div className="px-3 py-1 text-xs text-surface-400">v0.1.0</div>
        </div>
      </nav>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>

      {/* ── Settings drawer backdrop (invisible, closes on click) ─── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* ── Settings drawer ───────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 right-0 w-72 bg-surface-800 border-l border-surface-500 shadow-2xl z-50
          flex flex-col transform transition-transform duration-300 ease-in-out
          ${showSettings ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-500">
          <h2 className="text-sm font-semibold text-white">Appearance</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="text-surface-300 hover:text-white transition-colors"
          >
            <IconClose />
          </button>
        </div>

        {/* Drawer body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* ── Accent Color ──────────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-3">
              Accent Color
            </p>
            <div className="flex flex-wrap gap-2.5">
              {ACCENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAccent(t.id)}
                  title={t.label}
                  style={{ backgroundColor: t.dot }}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    accent === t.id ? "border-white scale-110" : "border-transparent"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-surface-300 mt-2 capitalize">
              {ACCENT_THEMES.find((t) => t.id === accent)?.label}
            </p>
          </section>

          {/* ── Background Color ──────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-3">
              Background
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BG_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleBg(t.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    bg === t.id
                      ? "border-primary-500 bg-primary-600/10"
                      : "border-surface-500 hover:border-surface-400 hover:bg-surface-700"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-surface-400"
                    style={{ backgroundColor: t.preview }}
                  />
                  <span className={`text-xs font-medium ${bg === t.id ? "text-primary-400" : "text-surface-100"}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Font Color ────────────────────────────────────────── */}
          <section>
            <p className="text-xs font-semibold text-surface-200 uppercase tracking-wider mb-3">
              Text Color
            </p>
            <div className="space-y-1.5">
              {FONT_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleFont(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                    font === t.id
                      ? "border-primary-500 bg-primary-600/10"
                      : "border-surface-500 hover:border-surface-400 hover:bg-surface-700"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 border border-surface-400"
                    style={{ backgroundColor: t.preview }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium block ${font === t.id ? "text-primary-400" : "text-surface-100"}`}>
                      {t.label}
                    </span>
                    <span className="text-xs block mt-0.5" style={{ color: t.preview }}>
                      Sample text
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
