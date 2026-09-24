import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { ReactNode } from "react";

import { UiPreferencesProvider, useUiPreferences } from "@/app/providers/ui-preferences";
import { LiveRegionProvider } from "@/components/app/LiveRegion";
import { I18nProvider } from "@/i18n/I18nProvider";

function LocaleProviders({ children }: { children: ReactNode }) {
  const { direction, locale } = useUiPreferences();

  return (
    <DirectionProvider direction={direction}>
      <I18nProvider locale={locale}>
        <LiveRegionProvider>{children}</LiveRegionProvider>
      </I18nProvider>
    </DirectionProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <UiPreferencesProvider>
      <LocaleProviders>{children}</LocaleProviders>
    </UiPreferencesProvider>
  );
}
