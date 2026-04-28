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

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.body.style.backgroundColor = theme === "dark" ? "#0a0a12" : "#f8fafc";
  }, [theme]);

  const toggle = useCallback(() => {
    const current = getThemeSnapshot();
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const isDark = theme === "dark";

  return {
    theme,
    toggle,
    isDark,
    // — accent —
    accent: "#818cf8",
    accentSoft: isDark ? "#818cf81f" : "#818cf814",
    // — text —
    text: isDark ? "#e2e8f0" : "#1e293b",
    textSoft: isDark ? "#e2e8f073" : "#1e293b73",
    textMuted: isDark ? "#e2e8f0b3" : "#1e293ba6",
    // — surfaces —
    bg: isDark ? "#0a0a12" : "#f8fafc",
    surface: isDark ? "#161623eb" : "#ffffffd9",
    surfaceHover: isDark ? "#818cf80a" : "#818cf80d",
    inset: isDark ? "#ffffff0a" : "#0000000a",
    // — chrome —
    border: isDark ? "#ffffff0f" : "#00000014",
    chrome: isDark ? "#ffffff1f" : "#00000026",
  };
}