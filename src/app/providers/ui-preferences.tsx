import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  readUiPreferences,
  type ThemePreference,
  writeLocale,
  writeTheme,
} from "@/infrastructure/preferences/browser-preference-store";
import type { Locale, UiDirection } from "@/i18n/types";
import { directionForLocale } from "@/i18n/translate";

export type ResolvedTheme = "light" | "dark";

interface UiPreferencesContextValue {
  locale: Locale;
  direction: UiDirection;
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

function getStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(theme: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return theme === "system" ? system : theme;
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const initial = readUiPreferences(getStorage());
  const [locale, setLocaleState] = useState<Locale>(initial.locale);
  const [theme, setThemeState] = useState<ThemePreference>(initial.theme);
  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(systemTheme);

  const direction = directionForLocale(locale);
  const resolvedTheme = resolveTheme(theme, systemPreference);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPreference(event.matches ? "dark" : "light");
    };

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = direction;
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", resolvedTheme === "dark" ? "#111318" : "#F5F6F8");
  }, [direction, locale, resolvedTheme]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeLocale(getStorage(), nextLocale);
  }, []);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    writeTheme(getStorage(), nextTheme);
  }, []);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({ locale, direction, theme, resolvedTheme, setLocale, setTheme }),
    [direction, locale, resolvedTheme, setLocale, setTheme, theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const context = useContext(UiPreferencesContext);
  if (!context) {
    throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  }
  return context;
}
