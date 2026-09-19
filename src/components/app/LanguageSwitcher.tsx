import { Languages } from "lucide-react";

import { useUiPreferences } from "@/app/providers/ui-preferences";
import { useAnnounce } from "@/components/app/LiveRegion";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/I18nProvider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useUiPreferences();
  const { t } = useI18n();
  const announce = useAnnounce();

  const handleChange = (nextLocale: "en" | "ar") => {
    setLocale(nextLocale);
    announce(
      t("language.changed", {
        language: nextLocale === "ar" ? "العربية" : "English",
      }),
    );
  };

  if (compact) {
    return (
      <button
        className="toolbar-action"
        type="button"
        onClick={() => handleChange(locale === "en" ? "ar" : "en")}
        aria-label={t("settings.language.title")}
        title={t("settings.language.title")}
      >
        <Languages aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>{locale === "en" ? "AR" : "EN"}</span>
      </button>
    );
  }

  return (
    <SegmentedControl
      ariaLabel={t("settings.language.title")}
      value={locale}
      onChange={handleChange}
      options={[
        { value: "en", label: t("settings.language.english") },
        { value: "ar", label: t("settings.language.arabic") },
      ]}
    />
  );
}
