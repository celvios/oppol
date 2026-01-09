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
                background: "#030304", // Deep Void
                surface: "#0A0A0C", // Card Surface
                "surface-highlight": "#161618",
                primary: "#00E0FF", // Cyan Neon
                "primary-glow": "rgba(0, 224, 255, 0.3)",
                success: "#00FF94", // Terminal Green
                danger: "#FF0055", // Cyber Red
                border: "rgba(255, 255, 255, 0.1)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "glass": "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.0) 100%)",
                "glass-hover": "linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%)",
            },
            fontFamily: {
                mono: ["var(--font-geist-mono)", "monospace"],
                sans: ["var(--font-inter)", "sans-serif"],
            },
            animation: {
                "fade-in": "fadeIn 0.5s ease-out forwards",
                "slide-up": "slideUp 0.5s ease-out forwards",
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
            },
        },
    },
    plugins: [],
};
export default config;
