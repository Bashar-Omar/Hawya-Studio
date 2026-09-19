import { arMessages } from "@/i18n/messages/ar";
import { enMessages } from "@/i18n/messages/en";
import type { Locale, MessageCatalog, MessageKey, MessageVariables } from "@/i18n/types";

const catalogs: Record<Locale, MessageCatalog> = {
  en: enMessages,
  ar: arMessages,
};

export function directionForLocale(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function translate(locale: Locale, key: MessageKey, variables?: MessageVariables): string {
  const template = catalogs[locale][key];

  if (!variables) {
    return template;
  }

  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, variableName: string) => {
    const value = variables[variableName];
    return value === undefined ? match : String(value);
  });
}
