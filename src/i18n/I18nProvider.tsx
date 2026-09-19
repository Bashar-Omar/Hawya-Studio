import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react";

import type { Locale, MessageKey, MessageVariables } from "@/i18n/types";
import { translate } from "@/i18n/translate";

interface I18nContextValue {
  locale: Locale;
  t: (key: MessageKey, variables?: MessageVariables) => string;
  formatNumber: (value: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const t = useCallback(
    (key: MessageKey, variables?: MessageVariables) => translate(locale, key, variables),
    [locale],
  );

  const formatNumber = useCallback(
    (value: number) => new Intl.NumberFormat(locale === "ar" ? "ar" : "en").format(value),
    [locale],
  );

  const value = useMemo(() => ({ locale, t, formatNumber }), [formatNumber, locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
