import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Preserve legacy tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Shared design system (aligned with landing page)
        cream: "#F6F1E7",
        ink: {
          DEFAULT: "#0E0E0E",
          5: "rgba(14, 14, 14, 0.05)",
          8: "rgba(14, 14, 14, 0.08)",
          12: "rgba(14, 14, 14, 0.12)",
          20: "rgba(14, 14, 14, 0.20)",
          30: "rgba(14, 14, 14, 0.30)",
          40: "rgba(14, 14, 14, 0.40)",
          50: "rgba(14, 14, 14, 0.50)",
          60: "rgba(14, 14, 14, 0.60)",
          70: "rgba(14, 14, 14, 0.70)",
          80: "rgba(14, 14, 14, 0.80)",
        },
        paper: "#FAF7F2",
        signal: "#FF4A1C",    // decision / alert
        electric: "#2C25FF",  // artist / health
        mint: "#1FBE7A",      // youtube / content
        sun: "#FFD24C",       // track signals
        blush: "#FFD3C9",     // soft surface

        /* ── Semantic set, mirrors src/lib/design/tokens.ts ──────────
           Kept in step with that file by hand: Tailwind classes cannot
           reach into an inline style object or an SVG fill, so both
           forms have to exist. */
        surface: "#FFFFFF",
        raised: "#F6F1E7",
        sunken: "#F1ECE3",
        line: { DEFAULT: "#E8E3DA", strong: "#D9D2C6", faint: "#F0EBE2" },
        secondary: "#55504A",
        muted: "#7D776E",
        faint: "#A8A199",
        positive: { DEFAULT: "#0C6A3F", soft: "#E6F2EB" },
        negative: { DEFAULT: "#A32915", soft: "#FBEAE6" },
        warn: { DEFAULT: "#9A6324", soft: "#FAF0E2" },
        longform: "#2C6BFF",
        shorts: "#C77A16",
      },
      fontFamily: {
        /* next/font sets --font-inter in layout.tsx. Before that, both of
           these named Inter and nothing ever loaded it, so the whole app
           rendered in the system fallback. */
        display: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      /* ── Type scale ──────────────────────────────────────────────────
         There were 714 arbitrary text-[Npx] values in the codebase and no
         scale to reach for, which is the main reason everything carried
         the same visual weight. These are the steps; `micro` is the floor
         for anything a user has to read. */
      fontSize: {
        micro: ["11px", { lineHeight: "1.45" }],
        meta: ["12px", { lineHeight: "1.5" }],
        body: ["13px", { lineHeight: "1.55" }],
        bodyLg: ["15px", { lineHeight: "1.6" }],
        h4: ["17px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        h3: ["21px", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        h2: ["28px", { lineHeight: "1.15", letterSpacing: "-0.022em" }],
        h1: ["38px", { lineHeight: "1.08", letterSpacing: "-0.028em" }],
        display: ["56px", { lineHeight: "1.0", letterSpacing: "-0.035em" }],
        /* Figures. Tabular by convention wherever these are used. */
        kpi: ["34px", { lineHeight: "1", letterSpacing: "-0.025em" }],
        kpiLg: ["44px", { lineHeight: "1", letterSpacing: "-0.03em" }],
      },
      /* Three tracking steps instead of the ten that had accumulated. */
      letterSpacing: {
        tightest: "-0.04em",
        label: "0.08em",
        eyebrow: "0.16em",
      },
      borderRadius: {
        card: "10px",
        control: "7px",
      },
      /* Depth comes from a hairline and a surface change, not a shadow.
         The one exception is a lifted control, which needs to read as
         sitting above the rail it is in. */
      boxShadow: {
        control: "0 1px 2px rgba(14,14,14,0.05)",
        lifted: "0 1px 3px rgba(14,14,14,0.07), 0 0 0 1px rgba(14,14,14,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
