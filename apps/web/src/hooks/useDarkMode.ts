import { useEffect, useState } from "react";

const STORAGE_KEY = "gldigital-theme";
const THEME_DARK = "dark";
const THEME_LIGHT = "light";

function getInitialTheme(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === THEME_DARK) return true;
  if (stored === THEME_LIGHT) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode(): [boolean, (enabled: boolean) => void] {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    const theme = isDark ? THEME_DARK : THEME_LIGHT;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [isDark]);

  return [isDark, setIsDark];
}
