import { Code, LockKeyhole, Scale } from "lucide-react";

import { appMetadata } from "@/app/app-metadata";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/i18n/I18nProvider";

export function AboutPage() {
  const { t } = useI18n();

  return (
    <AppShell title={t("about.title")} subtitle={t("about.subtitle")}>
      <div className="page-content about-page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">{appMetadata.name}</p>
            <h1>{t("about.title")}</h1>
            <p>{t("about.subtitle")}</p>
          </div>
          <dl className="version-grid">
            <div>
              <dt>{t("about.version")}</dt>
              <dd>{appMetadata.version}</dd>
            </div>
            <div>
              <dt>{t("about.stage")}</dt>
              <dd>{t("about.stageValue")}</dd>
            </div>
          </dl>
        </header>

        <div className="about-grid">
          <article className="about-card">
            <Scale aria-hidden="true" size={23} strokeWidth={1.7} />
            <h2>{t("about.openSource.title")}</h2>
            <p>{t("about.openSource.body")}</p>
          </article>
          <article className="about-card">
            <LockKeyhole aria-hidden="true" size={23} strokeWidth={1.7} />
            <h2>{t("about.localData.title")}</h2>
            <p>{t("about.localData.body")}</p>
          </article>
        </div>

        <a
          className="repository-link"
          href={appMetadata.repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          <Code aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>{t("about.repository")}</span>
          <span className="repository-link__url">github.com/Bashar-Omar/Hawya-Studio</span>
        </a>
      </div>
    </AppShell>
  );
}
