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
        ink: "#0E0E0E",
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
