import { ArrowLeft, FileText, LayoutTemplate, Palette, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { GuideStudioView } from "@/application/queries/guide-studio-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { appRoutes, brandSystemPath, editorPath, newProjectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  PAGE_CATALOG,
  pageAvailable,
  type GuideProfile,
  type SemanticPageType,
} from "@/domain/guide/page-catalog";
import { localizedValue } from "@/domain/guide/page-content";
import type { PageId } from "@/domain/guide/guide-document";
import type { ProjectId } from "@/domain/project/hawya-project";
import type { TemplateFamilyId, TemplateLocaleMode } from "@/domain/templates/template-definition";
import { useI18n } from "@/i18n/I18nProvider";
import { GuideTemplatePreview } from "@/features/guide-studio/GuideTemplatePreview";
import "@/features/guide-studio/guide-studio.css";

const PROFILES: GuideProfile[] = ["minimal", "standard", "comprehensive", "custom"];
const FAMILIES: TemplateFamilyId[] = ["essential", "editorial", "grid"];

function statusLabel(status: string): string {
  if (status === "needs-input") return "Needs input";
  if (status === "review") return "Review";
  return "Generated";
}

export default function GuideStudioPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { locale, t } = useI18n();
  const [view, setView] = useState<GuideStudioView | null>(null);
  const [profile, setProfile] = useState<GuideProfile>("standard");
  const [family, setFamily] = useState<TemplateFamilyId>("essential");
  const [localeMode, setLocaleMode] = useState<TemplateLocaleMode>("en");
  const [customPages, setCustomPages] = useState<SemanticPageType[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<PageId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const draft = await runtime.setupDrafts.get(projectId);
      if (draft) {
        navigate(newProjectPath(projectId));
        return;
      }
      const next = await runtime.guideStudio.execute(projectId);
      if (!next) {
        navigate(appRoutes.studio);
        return;
      }
      setView(next);
      setProfile(next.snapshot.project.settings.guideProfile);
      setFamily(next.snapshot.project.settings.templateFamilyId as TemplateFamilyId);
      setLocaleMode(next.localeMode);
      setSelectedPageId((current) =>
        current && next.snapshot.project.guide.pages[current]
          ? current
          : (next.snapshot.project.guide.pageOrder[0] ?? null),
      );
      await runtime.loadProjectFonts.execute(projectId);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    }
  }, [navigate, projectId, runtime, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.generateGuide.execute(projectId, {
        profile,
        familyId: family,
        localeMode,
        ...(profile === "custom" ? { customPageTypes: customPages } : {}),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const selected = view && selectedPageId ? view.pageViews[selectedPageId] : undefined;
  const enabledLocales = view?.snapshot.project.settings.enabledContentLocales ?? [];
  const localeModes: TemplateLocaleMode[] =
    enabledLocales.includes("en") && enabledLocales.includes("ar")
      ? ["en", "ar", "bilingual"]
      : [view?.snapshot.project.settings.defaultContentLocale ?? "en"];

  const railPanel = useMemo(() => {
    if (!view) return null;
    return (
      <div className="guide-rail">
        <p className="panel-kicker">{t("guide.project")}</p>
        <h2>{view.snapshot.project.metadata.name}</h2>
        <div className="guide-rail__sections">
          {view.snapshot.project.guide.sections.map((section) => (
            <section key={section.id}>
              <h3>{localizedValue(section.title, locale)}</h3>
              {section.pageIds.map((pageId) => {
                const pageView = view.pageViews[pageId];
                if (!pageView) return null;
                return (
                  <button
                    type="button"
                    className={`guide-page-link ${pageId === selectedPageId ? "is-active" : ""}`}
                    key={pageId}
                    onClick={() => setSelectedPageId(pageId)}
                  >
                    <span>{localizedValue(pageView.page.name, locale)}</span>
                    <small>{statusLabel(pageView.status)}</small>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </div>
    );
  }, [locale, selectedPageId, t, view]);

  if (!view) {
    return (
      <AppShell title={t("guide.title")} subtitle={t("guide.subtitle")}>
        <div className="page-content">
          <p>{error ?? t("common.loading")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={view.snapshot.project.metadata.name}
      subtitle={t("guide.subtitle")}
      railPanel={railPanel}
    >
      <div className="page-content page-content--wide guide-studio-page">
        <header className="page-heading guide-studio-heading">
          <div>
            <p className="eyebrow">{t("guide.title")}</p>
            <h1>
              {view.snapshot.project.guide.pageOrder.length
                ? t("guide.generatedTitle")
                : t("guide.emptyTitle")}
            </h1>
            <p>{t("guide.body")}</p>
          </div>
          <div className="guide-studio-heading__actions">
            <Button onClick={() => navigate(brandSystemPath(projectId))} variant="secondary">
              <Palette aria-hidden="true" size={16} />
              {t("guide.openBrand")}
            </Button>
            <Button onClick={() => navigate(appRoutes.studio)} variant="ghost">
              <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
              {t("guide.back")}
            </Button>
          </div>
        </header>

        <section className="guide-generator" aria-labelledby="guide-generator-title">
          <div className="guide-generator__intro">
            <Sparkles aria-hidden="true" size={20} />
            <div>
              <h2 id="guide-generator-title">{t("guide.generator")}</h2>
              <p>{t("guide.generatorBody")}</p>
            </div>
          </div>
          <div className="guide-generator__controls">
            <label className="field-stack">
              <span className="field-label">{t("guide.profile")}</span>
              <select
                className="text-input"
                value={profile}
                onChange={(event) => setProfile(event.currentTarget.value as GuideProfile)}
              >
                {PROFILES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span className="field-label">{t("guide.family")}</span>
              <select
                className="text-input"
                value={family}
                onChange={(event) => setFamily(event.currentTarget.value as TemplateFamilyId)}
              >
                {FAMILIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-stack">
              <span className="field-label">{t("guide.localeMode")}</span>
              <select
                className="text-input"
                value={localeMode}
                onChange={(event) => setLocaleMode(event.currentTarget.value as TemplateLocaleMode)}
              >
                {localeModes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="guide-generator__action">
              <Button
                onClick={() => void generate()}
                disabled={busy || (profile === "custom" && customPages.length === 0)}
              >
                <FileText aria-hidden="true" size={16} />
                {view.snapshot.project.guide.pageOrder.length
                  ? t("guide.regenerate")
                  : t("guide.generate")}
              </Button>
            </div>
          </div>
          {profile === "custom" ? (
            <fieldset className="guide-custom-pages">
              <legend>{t("guide.customPages")}</legend>
              <div className="guide-custom-pages__grid">
                {PAGE_CATALOG.map((entry) => {
                  const available = pageAvailable(view.snapshot, entry.type);
                  return (
                    <label key={entry.type} className="guide-page-choice">
                      <input
                        type="checkbox"
                        checked={customPages.includes(entry.type)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          setCustomPages((current) =>
                            checked
                              ? [...current, entry.type]
                              : current.filter((item) => item !== entry.type),
                          );
                        }}
                      />
                      <span>
                        <strong>{localizedValue(entry.title, locale)}</strong>
                        <small>{available ? t("guide.dataReady") : t("guide.willNeedInput")}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        {selected ? (
          <section className="guide-preview-section" aria-labelledby="guide-preview-title">
            <div className="guide-preview-toolbar">
              <div>
                <p className="eyebrow">{statusLabel(selected.status)}</p>
                <h2 id="guide-preview-title">{localizedValue(selected.page.name, locale)}</h2>
              </div>
              <div className="guide-preview-toolbar__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(editorPath(projectId, selected.page.id))}
                >
                  {t("guide.editPage")}
                </Button>
                <label className="field-stack guide-template-select">
                  <span className="field-label">{t("guide.template")}</span>
                  <select
                    className="text-input"
                    value={selected.page.templateBinding.templateId}
                    onChange={(event) => {
                      const templateId = event.currentTarget.value;
                      setBusy(true);
                      void runtime.switchGuidePageTemplate
                        .execute(projectId, selected.page.id, templateId, view.localeMode)
                        .then(load)
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error ? cause.message : t("common.unknownError"),
                          ),
                        )
                        .finally(() => setBusy(false));
                    }}
                    disabled={busy}
                  >
                    {selected.compatibleTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm(t("guide.resetConfirm"))) return;
                    setBusy(true);
                    void runtime.resetGuidePageTemplate
                      .execute(projectId, selected.page.id, view.localeMode)
                      .then(load)
                      .catch((cause: unknown) =>
                        setError(cause instanceof Error ? cause.message : t("common.unknownError")),
                      )
                      .finally(() => setBusy(false));
                  }}
                  disabled={busy}
                >
                  <RefreshCw aria-hidden="true" size={14} />
                  {t("guide.resetLayout")}
                </Button>
              </div>
            </div>
            <GuideTemplatePreview
              pageView={selected}
              localeMode={view.localeMode}
              assets={view.snapshot.assets}
            />
          </section>
        ) : (
          <section className="guide-empty-state">
            <LayoutTemplate aria-hidden="true" size={30} />
            <h2>{t("guide.noPages")}</h2>
            <p>{t("guide.noPagesBody")}</p>
          </section>
        )}
      </div>
    </AppShell>
  );
}
