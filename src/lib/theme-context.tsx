import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Appearance, ColorSchemeName } from "react-native";
import { storage } from "@/src/utils/storage";
import { LIGHT_COLORS, DARK_COLORS, ThemeMode } from "./theme";

const THEME_KEY = "tps_theme_mode";

type ThemeContextValue = {
  mode: ThemeMode;
  effective: "light" | "dark";
  colors: typeof LIGHT_COLORS;
  setMode: (m: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Load saved mode
  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(THEME_KEY, "");
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    })();
  }, []);

  // Listen to system color scheme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const effective: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const colors = effective === "dark" ? DARK_COLORS : LIGHT_COLORS;

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await storage.setItem(THEME_KEY, m);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, effective, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors() {
  const ctx = useContext(ThemeContext);
  return ctx ? ctx.colors : LIGHT_COLORS;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return { mode: ctx.mode, effective: ctx.effective, setMode: ctx.setMode };
}
