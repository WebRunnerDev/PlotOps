import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "plotops-theme";

export type Theme = "dark" | "light";

type ThemeListener = (theme: Theme) => void;

const listeners = new Set<ThemeListener>();

export function applyTheme(theme: Theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
    applyTheme(getPreferredTheme());
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

    useEffect(() => {
        const listener: ThemeListener = (next) => {
            setTheme(next);
        };
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    const toggleTheme = useCallback(() => {
        publishTheme(getPreferredTheme() === "dark" ? "light" : "dark");
    }, []);

    return { theme, toggleTheme };
}

function getPreferredTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
        return stored;
    }

    return "dark";
}

function publishTheme(theme: Theme) {
    applyTheme(theme);
    for (const listener of listeners) {
        listener(theme);
    }
}
