import { ArrowLeft, Boxes, Image, Palette, ShieldCheck, Type } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { BrandSystemView } from "@/application/queries/brand-system-query";
import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { appRoutes, projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import type { ProjectId } from "@/domain/project/hawya-project";
import { AssetLibraryPanel } from "@/features/brand-system/AssetLibraryPanel";
import { AuditPanel } from "@/features/brand-system/AuditPanel";
import { ColorPanel } from "@/features/brand-system/ColorPanel";
import { LogoPanel } from "@/features/brand-system/LogoPanel";
import { TypographyPanel } from "@/features/brand-system/TypographyPanel";
import "@/features/brand-system/brand-system.css";
import { useI18n } from "@/i18n/I18nProvider";

type BrandTab = "assets" | "logos" | "colors" | "typography" | "audit";

export default function BrandSystemPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [view, setView] = useState<BrandSystemView | null>(null);
  const [tab, setTab] = useState<BrandTab>("assets");
  const [error, setError] = useState<string | null>(null);
  const [fontWarningCount, setFontWarningCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const next = await runtime.brandSystem.execute(projectId);
      if (!next) {
        navigate(appRoutes.studio);
        return;
      }
      setView(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    }
  }, [navigate, projectId, runtime, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fontCount = view?.snapshot.project.brand.typography.fonts.length ?? 0;
  useEffect(() => {
    if (fontCount === 0) {
      setFontWarningCount(0);
      return;
    }
    void runtime.loadProjectFonts
      .execute(projectId)
      .then((result) => setFontWarningCount(result.failed.length));
  }, [fontCount, projectId, runtime]);

  if (!view) {
    return (
      <AppShell title={t("brand.title")} subtitle={t("brand.subtitle")}>
        <div className="page-content">
          {error ? (
            <p className="inline-error" role="alert">
              {error}
            </p>
          ) : (
            <p>{t("common.loading")}</p>
          )}
        </div>
      </AppShell>
    );
  }

  const panel = (
    <div className="shell-panel-content">
      <p className="panel-kicker">{t("brand.workspace")}</p>
      <h2>{view.snapshot.project.metadata.name}</h2>
      <p className="panel-helper">{t("brand.sourceOfTruth")}</p>
    </div>
  );

  const tabs: Array<{ id: BrandTab; icon: typeof Boxes; label: string }> = [
    { id: "assets", icon: Boxes, label: t("brand.tab.assets") },
    { id: "logos", icon: Image, label: t("brand.tab.logos") },
    { id: "colors", icon: Palette, label: t("brand.tab.colors") },
    { id: "typography", icon: Type, label: t("brand.tab.typography") },
    { id: "audit", icon: ShieldCheck, label: t("brand.tab.audit") },
  ];

  return (
    <AppShell
      title={view.snapshot.project.metadata.name}
      subtitle={t("brand.subtitle")}
      railPanel={panel}
    >
      <div className="page-content page-content--wide brand-system-page">
        <header className="brand-system-header">
          <div>
            <p className="eyebrow">{t("brand.title")}</p>
            <h1>{view.snapshot.project.metadata.name}</h1>
            <p>{t("brand.body")}</p>
          </div>
          <div className="brand-system-header__actions">
            <Button variant="secondary" onClick={() => navigate(projectPath(projectId))}>
              <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
              {t("brand.guideShell")}
            </Button>
            <Button variant="ghost" onClick={() => navigate(appRoutes.studio)}>
              {t("guideShell.back")}
            </Button>
          </div>
        </header>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}
        {fontWarningCount > 0 ? (
          <div className="brand-warning" role="status">
            {t("brand.fontLoadWarning", { count: fontWarningCount })}
          </div>
        ) : null}

        <div className="brand-tabs" role="tablist" aria-label={t("brand.title")}>
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className="brand-tab"
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon aria-hidden="true" size={17} />
              {label}
            </button>
          ))}
        </div>

        {tab === "assets" ? (
          <AssetLibraryPanel projectId={projectId} view={view} onRefresh={refresh} />
        ) : null}
        {tab === "logos" ? (
          <LogoPanel projectId={projectId} view={view} onRefresh={refresh} />
        ) : null}
        {tab === "colors" ? (
          <ColorPanel projectId={projectId} view={view} onRefresh={refresh} />
        ) : null}
        {tab === "typography" ? (
          <TypographyPanel projectId={projectId} view={view} onRefresh={refresh} />
        ) : null}
        {tab === "audit" ? (
          <AuditPanel projectId={projectId} view={view} onRefresh={refresh} />
        ) : null}
      </div>
    </AppShell>
  );
}
