/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          // Static shades (used for opacity variants like /20)
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
          // Dynamic shades — controlled by CSS variables (theme switcher)
          400: "rgb(var(--p4) / <alpha-value>)",
          500: "rgb(var(--p5) / <alpha-value>)",
          600: "rgb(var(--p6) / <alpha-value>)",
          700: "rgb(var(--p7) / <alpha-value>)",
        },
        surface: {
          // App layers — dark to light
          // 900–400: dynamic via CSS vars (theme switcher controls these)
          950: "#0a0a0a",
          900: "rgb(var(--s9) / <alpha-value>)",
          800: "rgb(var(--s8) / <alpha-value>)",
          700: "rgb(var(--s7) / <alpha-value>)",
          600: "rgb(var(--s6) / <alpha-value>)",
          500: "rgb(var(--s5) / <alpha-value>)",
          400: "rgb(var(--s4) / <alpha-value>)",
          // 300–50: static (text / icons — not affected by bg theme)
          300: "#525252",
          200: "#737373",
          100: "#a3a3a3",
          50:  "#e5e5e5",
        },
      },
      borderRadius: {
        "xl":  "0.75rem",
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
