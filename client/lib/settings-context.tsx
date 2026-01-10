"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SettingsContextType {
    reduceMotion: boolean;
    toggleReduceMotion: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("vantage-reduce-motion");
        if (saved) {
            setReduceMotion(JSON.parse(saved));
        } else {
            // Check system preference
            const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            setReduceMotion(prefersReduced);
        }
    }, []);

    const toggleReduceMotion = () => {
        setReduceMotion((prev) => {
            const next = !prev;
            localStorage.setItem("vantage-reduce-motion", JSON.stringify(next));
            return next;
        });
    };

    return (
        <SettingsContext.Provider value={{ reduceMotion, toggleReduceMotion }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}
