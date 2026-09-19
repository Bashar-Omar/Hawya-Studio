import { Monitor, Moon, Sun } from "lucide-react";

import { useUiPreferences } from "@/app/providers/ui-preferences";
import { useAnnounce } from "@/components/app/LiveRegion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/I18nProvider";
import type { ThemePreference } from "@/infrastructure/preferences/browser-preference-store";

export function ThemeSwitcher() {
  const { setTheme, theme } = useUiPreferences();
  const { t } = useI18n();
  const announce = useAnnounce();

  const themeLabelKeys: Record<
    ThemePreference,
    "settings.theme.system" | "settings.theme.light" | "settings.theme.dark"
  > = {
    system: "settings.theme.system",
    light: "settings.theme.light",
    dark: "settings.theme.dark",
  };

  const handleChange = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    announce(t("theme.changed", { theme: t(themeLabelKeys[nextTheme]) }));
  };

  return (
    <SegmentedControl
      ariaLabel={t("settings.theme.title")}
      value={theme}
      onChange={handleChange}
      options={[
        {
          value: "system",
          label: (
            <span className="segmented-label">
              <Monitor aria-hidden="true" size={15} />
              {t("settings.theme.system")}
            </span>
          ),
        },
        {
          value: "light",
          label: (
            <span className="segmented-label">
              <Sun aria-hidden="true" size={15} />
              {t("settings.theme.light")}
            </span>
          ),
        },
        {
          value: "dark",
          label: (
            <span className="segmented-label">
              <Moon aria-hidden="true" size={15} />
              {t("settings.theme.dark")}
            </span>
          ),
        },
      ]}
    />
  );
}
