import { createContext, useContext } from "react";

type ThemeContextValue = boolean | undefined; // true = dark, undefined = fuera del provider

const ThemeContext = createContext<ThemeContextValue>(undefined);

export function ThemeProvider({
  isDark,
  children
}: {
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={isDark}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): boolean | undefined {
  return useContext(ThemeContext);
}
