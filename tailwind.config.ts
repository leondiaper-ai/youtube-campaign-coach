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
      },
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
