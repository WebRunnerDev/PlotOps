import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "plotops-theme";

export type Theme = "dark" | "light";

function getPreferredTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
        return stored;
    }

    return "dark";
}

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
        applyTheme(theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((current) => (current === "dark" ? "light" : "dark"));
    }, []);

    return { theme, toggleTheme };
}
