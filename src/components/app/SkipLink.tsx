import { useI18n } from "@/i18n/I18nProvider";

export function SkipLink() {
  const { t } = useI18n();
  return (
    <a className="skip-link" href="#main-content">
      {t("nav.skipToContent")}
    </a>
  );
}
