"use client";

import { useEffect, useCallback, useSyncExternalStore } from "react";

// Shared theme state via module-level store + useSyncExternalStore
const THEME_EVENT = "theme-change";

function getThemeSnapshot(): "dark" | "light" {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
}

function getServerSnapshot(): "dark" | "light" {
    return "dark";
}

function subscribeToTheme(callback: () => void): () => void {
    window.addEventListener(THEME_EVENT, callback);
    return () => window.removeEventListener(THEME_EVENT, callback);
}

// Theme-dependent color tokens — 8 visual tokens
export function useColors() {
    const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

    const isDark = theme === "dark";

    const accentMuted = isDark ? "#1e1f32" : "#d4d6f0"

    useEffect(() => {
        document.documentElement.style.colorScheme = theme;
        document.documentElement.style.setProperty("--scrollbar", accentMuted);
        document.documentElement.style.setProperty("--scrollbar-hover", isDark ? "#282940" : "#c0c2e8");
    }, [theme, isDark, accentMuted]);

    const toggle = useCallback(() => {
        const current = getThemeSnapshot();
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem("theme", next);
        window.dispatchEvent(new Event(THEME_EVENT));
    }, []);

    

    return {
        theme,
        toggle,
        isDark,

        // — background —
        bg: isDark ? "#0e0e18" : "#f8fafc",
        surface: isDark ? "#161623" : "#ffffff",
        border: isDark ? "#1e1e2c" : "#e2e8f0",
        chrome: isDark ? "#26263a" : "#cbd5e1",

        // — accent —
        accent: "#818cf8",
        accentSoft: isDark ? "#1a1a2e" : "#eef0ff",
        accentMuted,   // тени, скроллбар

        // — text —
        text: isDark ? "#e2e8f0" : "#1e293b",
        textSoft: isDark ? "#6b6e76" : "#64748b",
        textMuted: isDark ? "#a2a6ae" : "#475569",

        // — util —
        icon: "#ffffff",
        error: isDark ? "#fb7185" : "#e11d48",
        errorSoft: isDark ? "#2a1520" : "#fce7f3",
    };
}