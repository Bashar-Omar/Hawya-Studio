import type { Locale } from "@/i18n/types";

export type ThemePreference = "system" | "light" | "dark";

export interface UiPreferences {
  locale: Locale;
  theme: ThemePreference;
}

const localeKey = "hawya.ui.locale";
const themeKey = "hawya.ui.theme";

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "ar";
}

function isTheme(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readUiPreferences(storage: Pick<Storage, "getItem"> | undefined): UiPreferences {
  if (!storage) {
    return { locale: "en", theme: "system" };
  }

  try {
    const locale = storage.getItem(localeKey);
    const theme = storage.getItem(themeKey);

    return {
      locale: isLocale(locale) ? locale : "en",
      theme: isTheme(theme) ? theme : "system",
    };
  } catch {
    return { locale: "en", theme: "system" };
  }
}

export function writeLocale(storage: Pick<Storage, "setItem"> | undefined, locale: Locale): void {
  try {
    storage?.setItem(localeKey, locale);
  } catch {
    // UI preferences are non-critical bootstrap hints. Failure must not block the app.
  }
}

export function writeTheme(
  storage: Pick<Storage, "setItem"> | undefined,
  theme: ThemePreference,
): void {
  try {
    storage?.setItem(themeKey, theme);
  } catch {
    // UI preferences are non-critical bootstrap hints. Failure must not block the app.
  }
}
