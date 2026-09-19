import { ArrowUpRight, Code, Languages, LockKeyhole, PackageOpen } from "lucide-react";

import { appMetadata } from "@/app/app-metadata";
import { appRoutes } from "@/app/routes/route-config";
import { AppLink } from "@/app/routes/RouterProvider";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { SkipLink } from "@/components/app/SkipLink";
import { useI18n } from "@/i18n/I18nProvider";

const promises = [
  {
    Icon: LockKeyhole,
    titleKey: "landing.promise.privacy.title",
    bodyKey: "landing.promise.privacy.body",
  },
  {
    Icon: Languages,
    titleKey: "landing.promise.bilingual.title",
    bodyKey: "landing.promise.bilingual.body",
  },
  {
    Icon: PackageOpen,
    titleKey: "landing.promise.ownership.title",
    bodyKey: "landing.promise.ownership.body",
  },
] as const;

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="landing-page">
      <SkipLink />
      <header className="landing-header">
        <AppLink
          className="landing-wordmark"
          href={appRoutes.landing}
          aria-label={appMetadata.name}
        >
          <span className="app-mark" aria-hidden="true">
            هـ
          </span>
          <span>{appMetadata.name}</span>
        </AppLink>
        <div className="landing-header__actions">
          <LanguageSwitcher compact />
          <a
            className="toolbar-action"
            href={appMetadata.repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Code aria-hidden="true" size={17} strokeWidth={1.8} />
            <span className="hide-on-small">{t("landing.viewSource")}</span>
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <p className="eyebrow">{t("landing.eyebrow")}</p>
            <h1>{t("landing.title")}</h1>
            <p className="landing-hero__description">{t("landing.description")}</p>
            <div className="landing-hero__actions">
              <AppLink className="link-button link-button--primary" href={appRoutes.studio}>
                {t("landing.openStudio")}
                <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.8} />
              </AppLink>
              <a
                className="link-button link-button--secondary"
                href={appMetadata.repositoryUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Code aria-hidden="true" size={17} strokeWidth={1.8} />
                {t("landing.viewSource")}
              </a>
            </div>
          </div>

          <figure className="landing-system-card" aria-labelledby="landing-system-caption">
            <figcaption className="sr-only" id="landing-system-caption">
              {t("landing.system.aria")}
            </figcaption>
            <div className="system-card__label">{t("landing.system.source")}</div>
            <div className="system-card__node system-card__node--primary">
              {t("landing.system.brand")}
            </div>
            <div className="system-card__connector" aria-hidden="true" />
            <div className="system-card__grid">
              <span>{t("landing.system.rules")}</span>
              <span>{t("landing.system.assets")}</span>
              <span>{t("landing.system.tokens")}</span>
              <span>{t("landing.system.content")}</span>
            </div>
            <div className="system-card__connector" aria-hidden="true" />
            <div className="system-card__outputs">
              <span>{t("landing.system.guidelines")}</span>
              <span>SVG</span>
              <span>{t("landing.system.web")}</span>
              <span>{t("landing.system.delivery")}</span>
            </div>
          </figure>
        </section>

        <section className="landing-promises" aria-label={t("landing.promises.aria")}>
          {promises.map(({ Icon, bodyKey, titleKey }) => (
            <article className="promise-card" key={titleKey}>
              <Icon aria-hidden="true" size={20} strokeWidth={1.7} />
              <h2>{t(titleKey)}</h2>
              <p>{t(bodyKey)}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-footer">
        <span>{t("landing.footer")}</span>
        <span>{appMetadata.version}</span>
      </footer>
    </div>
  );
}
