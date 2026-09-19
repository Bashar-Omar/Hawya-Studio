import { FolderOpen, HardDrive, Plus, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";

export function StudioHomePage() {
  const { t } = useI18n();

  const panel = (
    <div className="shell-panel-content">
      <p className="panel-kicker">{t("studio.shell.foundation")}</p>
      <h2>{t("studio.projects.title")}</h2>
      <div className="panel-note">
        <HardDrive aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>{t("app.localFirst")}</span>
      </div>
    </div>
  );

  return (
    <AppShell title={t("studio.title")} subtitle={t("studio.subtitle")} railPanel={panel}>
      <div className="page-content page-content--wide">
        <section className="page-heading">
          <div>
            <p className="eyebrow">{t("studio.projects.title")}</p>
            <h1>{t("studio.projects.emptyTitle")}</h1>
            <p>{t("studio.projects.emptyBody")}</p>
          </div>
        </section>

        <section className="empty-project-state" aria-labelledby="empty-project-title">
          <div className="empty-project-state__icon" aria-hidden="true">
            <FolderOpen size={30} strokeWidth={1.5} />
          </div>
          <div className="empty-project-state__copy">
            <h2 id="empty-project-title">{t("studio.projects.emptyTitle")}</h2>
            <p>{t("studio.projects.nextStage")}</p>
          </div>
          <fieldset className="empty-project-state__actions">
            <legend className="sr-only">{t("studio.projects.title")}</legend>
            <Button disabled title={t("studio.projects.nextStage")}>
              <Plus aria-hidden="true" size={16} />
              {t("studio.projects.create")}
            </Button>
            <Button disabled variant="secondary" title={t("studio.projects.nextStage")}>
              <FolderOpen aria-hidden="true" size={16} />
              {t("studio.projects.open")}
            </Button>
          </fieldset>
        </section>

        <section className="information-card">
          <ShieldCheck aria-hidden="true" size={22} strokeWidth={1.7} />
          <div>
            <h2>{t("studio.privacy.title")}</h2>
            <p>{t("studio.privacy.body")}</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
