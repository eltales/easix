// ── Accent color themes ───────────────────────────────────────────────────────

export interface AccentTheme {
  id: string;
  label: string;
  dot: string;
  p4: string;
  p5: string;
  p6: string;
  p7: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  { id: "blue",   label: "Blue",   dot: "#3b82f6", p4: "96 165 250",  p5: "59 130 246",  p6: "37 99 235",  p7: "29 78 216"  },
  { id: "purple", label: "Purple", dot: "#a855f7", p4: "192 132 252", p5: "168 85 247",  p6: "147 51 234", p7: "126 34 206" },
  { id: "teal",   label: "Teal",   dot: "#14b8a6", p4: "45 212 191",  p5: "20 184 166",  p6: "13 148 136", p7: "15 118 110" },
  { id: "green",  label: "Green",  dot: "#22c55e", p4: "74 222 128",  p5: "34 197 94",   p6: "22 163 74",  p7: "21 128 61"  },
  { id: "orange", label: "Orange", dot: "#f97316", p4: "251 146 60",  p5: "249 115 22",  p6: "234 88 12",  p7: "194 65 12"  },
  { id: "red",    label: "Red",    dot: "#ef4444", p4: "248 113 113", p5: "239 68 68",   p6: "220 38 38",  p7: "185 28 28"  },
  { id: "pink",   label: "Pink",   dot: "#ec4899", p4: "240 171 252", p5: "232 121 249", p6: "217 70 239", p7: "192 38 211" },
];

export function applyAccent(id: string): void {
  const t = ACCENT_THEMES.find((x) => x.id === id) ?? ACCENT_THEMES[0];
  const el = document.documentElement;
  el.style.setProperty("--p4", t.p4);
  el.style.setProperty("--p5", t.p5);
  el.style.setProperty("--p6", t.p6);
  el.style.setProperty("--p7", t.p7);
  localStorage.setItem("easix-accent", id);
}

// ── Background (surface) themes ───────────────────────────────────────────────

export interface BgTheme {
  id: string;
  label: string;
  preview: string; // swatch color
  s9: string; // surface-900  main bg
  s8: string; // surface-800  sidebar
  s7: string; // surface-700  cards
  s6: string; // surface-600  inputs
  s5: string; // surface-500  borders
  s4: string; // surface-400  hover
}

export const BG_THEMES: BgTheme[] = [
  {
    id: "abyss", label: "Abyss", preview: "#0a0a0a",
    s9: "10 10 10", s8: "15 15 15", s7: "18 18 18",
    s6: "24 24 24", s5: "30 30 30", s4: "44 44 44",
  },
  {
    id: "dark", label: "Dark", preview: "#141414",
    s9: "15 15 15", s8: "20 20 20", s7: "26 26 26",
    s6: "32 32 32", s5: "38 38 38", s4: "51 51 51",
  },
  {
    id: "dim", label: "Dim", preview: "#222222",
    s9: "24 24 24", s8: "30 30 30", s7: "38 38 38",
    s6: "46 46 46", s5: "56 56 56", s4: "70 70 70",
  },
  {
    id: "soft", label: "Soft", preview: "#2e2e2e",
    s9: "34 34 34", s8: "42 42 42", s7: "52 52 52",
    s6: "62 62 62", s5: "74 74 74", s4: "90 90 90",
  },
];

export function applyBg(id: string): void {
  const t = BG_THEMES.find((x) => x.id === id) ?? BG_THEMES[1];
  const el = document.documentElement;
  el.style.setProperty("--s9", t.s9);
  el.style.setProperty("--s8", t.s8);
  el.style.setProperty("--s7", t.s7);
  el.style.setProperty("--s6", t.s6);
  el.style.setProperty("--s5", t.s5);
  el.style.setProperty("--s4", t.s4);
  // Also update html background directly (before React paint)
  document.documentElement.style.backgroundColor = t.preview;
  localStorage.setItem("easix-bg", id);
}

// ── Font (text color) themes ──────────────────────────────────────────────────

export interface FontTheme {
  id: string;
  label: string;
  preview: string; // swatch hex
  value: string;   // CSS var value "R G B"
}

export const FONT_THEMES: FontTheme[] = [
  { id: "neutral", label: "Neutral", preview: "#e5e5e5", value: "229 229 229" },
  { id: "bright",  label: "Bright",  preview: "#f5f5f5", value: "245 245 245" },
  { id: "warm",    label: "Warm",    preview: "#f5f0e8", value: "245 240 232" },
  { id: "cool",    label: "Cool",    preview: "#e8f0ff", value: "232 240 255" },
  { id: "dimmed",  label: "Dimmed",  preview: "#a3a3a3", value: "163 163 163" },
];

export function applyFont(id: string): void {
  const t = FONT_THEMES.find((x) => x.id === id) ?? FONT_THEMES[0];
  document.documentElement.style.setProperty("--text-primary", t.value);
  localStorage.setItem("easix-font", id);
}

// ── Init (call before first render) ──────────────────────────────────────────

export function initTheme(): { accent: string; bg: string; font: string } {
  const accent = localStorage.getItem("easix-accent") ?? "blue";
  const bg     = localStorage.getItem("easix-bg")     ?? "dark";
  const font   = localStorage.getItem("easix-font")   ?? "neutral";
  applyAccent(accent);
  applyBg(bg);
  applyFont(font);
  return { accent, bg, font };
}

// Legacy alias
export const THEMES = ACCENT_THEMES;
export const applyTheme = applyAccent;
