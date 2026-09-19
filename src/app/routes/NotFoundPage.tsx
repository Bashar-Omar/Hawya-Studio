import { appRoutes } from "@/app/routes/route-config";
import { AppLink } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/i18n/I18nProvider";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <AppShell title={t("notFound.title")}>
      <div className="page-content not-found-page">
        <h1>{t("notFound.title")}</h1>
        <p>{t("notFound.body")}</p>
        <AppLink className="link-button link-button--primary" href={appRoutes.studio}>
          {t("notFound.action")}
        </AppLink>
      </div>
    </AppShell>
  );
}
