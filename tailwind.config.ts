import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper workshop — not cream (#F4F1EA), lighter and greyer.
        paper: "#FBFAF7",
        surface: "#FFFFFF",
        ink: {
          DEFAULT: "#181712",
          soft: "#3A382F",
          muted: "#6E6B60",
          faint: "#9A968A",
        },
        line: {
          DEFAULT: "#E8E4DA",
          strong: "#D9D4C7",
        },
        // Single restrained accent: deep ceramic blue. Not terracotta, not acid.
        accent: {
          DEFAULT: "#2F4C82",
          soft: "#4666A8",
          wash: "#EDF1F8",
        },
        signal: "#1F6F5C", // used only for "done/verified" states
        flag: "#B4531F", // used only for discrepancies/warnings
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        prose: "72ch",
      },
      boxShadow: {
        card: "0 1px 2px rgba(24,23,18,0.04), 0 8px 30px -12px rgba(24,23,18,0.12)",
        lift: "0 1px 2px rgba(24,23,18,0.05), 0 18px 50px -20px rgba(24,23,18,0.22)",
      },
      keyframes: {
        "reveal": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "line-draw": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        reveal: "reveal 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "line-draw": "line-draw 0.6s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-soft": "pulse-soft 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
