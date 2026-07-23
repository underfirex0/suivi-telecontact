import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        bg: "#F5F6F8",
        surface: "#FFFFFF",
        "surface-2": "#EEF0F3",
        ink: {
          DEFAULT: "#12131A",
          2: "#5B6072",
          3: "#9297A6",
        },
        border: "#E3E5EA",
        sidebar: {
          DEFAULT: "#14161F",
          2: "#1D2030",
          text: "#B8BCC9",
        },
        brand: {
          DEFAULT: "#0E7C7B",
          dark: "#0A5F5E",
          tint: "#E4F3F2",
        },
        neutral: {
          DEFAULT: "#6B7280",
          tint: "#F0F1F3",
        },
        warn: {
          DEFAULT: "#C2790A",
          tint: "#FCF1E1",
        },
        danger: {
          DEFAULT: "#C0392B",
          tint: "#FBEAE8",
        },
        juridique: {
          DEFAULT: "#5B3A8E",
          tint: "#F0EAF8",
        },
        success: {
          DEFAULT: "#1F8A55",
          tint: "#E7F5EE",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,19,26,0.04), 0 4px 16px rgba(18,19,26,0.06)",
        "card-lg": "0 8px 24px rgba(18,19,26,0.10), 0 2px 6px rgba(18,19,26,0.06)",
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.18s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
