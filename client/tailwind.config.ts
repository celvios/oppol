import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                void: "var(--void)",
                prism: "rgba(255, 255, 255, 0.05)",
                "outcome-a": "#4ADE80", // Green - YES
                "outcome-b": "#F87171", // Red - NO
                success: "#27E8A7",    // Spring Green
                "text-primary": "#FFFFFF",
                "text-secondary": "#94A3B8",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                heading: ["var(--font-space-grotesk)", "sans-serif"],
                mono: ["var(--font-jetbrains-mono)", "monospace"],
            },
            backgroundImage: {
                "glass": "linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))",
                "glass-hover": "linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))",
                "gradient-green": "linear-gradient(135deg, #22c55e 0%, #4ade80 100%)",
                "gradient-red": "linear-gradient(135deg, #ef4444 0%, #f87171 100%)",
                "gradient-cyan": "linear-gradient(135deg, #00F0FF 0%, #00C0FF 100%)",
                "gradient-coral": "linear-gradient(135deg, #FF2E63 0%, #FF0040 100%)",
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-out forwards",
                "slide-up": "slideUp 0.5s ease-out forwards",
                "shimmer": "shimmer 2s infinite linear",
                "float": "float 6s ease-in-out infinite",
                "pulse-glow": "pulseGlow 3s infinite ease-in-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                shimmer: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                pulseGlow: {
                    "0%, 100%": { opacity: "1", boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)" },
                    "50%": { opacity: "0.8", boxShadow: "0 0 20px rgba(0, 240, 255, 0.5)" }
                }
            },
        },
    },
    plugins: [],
};
export default config;
