import { ArrowLeft, CheckCircle2, CircleAlert, FileText, Palette, Type, Image } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { appRoutes, newProjectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { useI18n } from "@/i18n/I18nProvider";

export function ProjectGuideShellPage({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const draft = await runtime.setupDrafts.get(projectId);
      if (draft) {
        navigate(newProjectPath(projectId));
        return;
      }
      const opened = await runtime.openProject.execute(projectId);
      if (!opened) {
        navigate(appRoutes.studio);
        return;
      }
      setSnapshot(opened);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    }
  }, [navigate, projectId, runtime, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!snapshot) {
    return (
      <AppShell title={t("guideShell.title")} subtitle={t("guideShell.subtitle")}>
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

  const brand = snapshot.project.brand;
  const checks = [
    { icon: Image, label: t("wizard.step.logo"), ready: brand.logos.variants.length > 0 },
    { icon: Palette, label: t("wizard.step.colors"), ready: brand.colors.tokens.length > 0 },
    { icon: Type, label: t("wizard.step.typography"), ready: brand.typography.styles.length > 0 },
    {
      icon: FileText,
      label: t("guideShell.pages"),
      ready: snapshot.project.guide.pageOrder.length > 0,
    },
  ];

  const panel = (
    <div className="shell-panel-content">
      <p className="panel-kicker">{t("guideShell.project")}</p>
      <h2>{snapshot.project.metadata.name}</h2>
      <p className="panel-helper">
        {t("guideShell.profile", { profile: snapshot.project.settings.guideProfile })}
      </p>
    </div>
  );

  return (
    <AppShell
      title={snapshot.project.metadata.name}
      subtitle={t("guideShell.subtitle")}
      railPanel={panel}
    >
      <div className="page-content page-content--wide guide-shell-page">
        <div className="page-heading guide-shell-heading">
          <div>
            <p className="eyebrow">{t("guideShell.title")}</p>
            <h1>{t("guideShell.readyTitle")}</h1>
            <p>{t("guideShell.readyBody")}</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(appRoutes.studio)}>
            <ArrowLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("guideShell.back")}
          </Button>
        </div>

        <section className="guide-empty-canvas" aria-labelledby="guide-empty-title">
          <FileText aria-hidden="true" size={34} strokeWidth={1.4} />
          <h2 id="guide-empty-title">{t("guideShell.emptyTitle")}</h2>
          <p>{t("guideShell.emptyBody")}</p>
        </section>

        <section className="setup-health" aria-labelledby="setup-health-title">
          <div>
            <h2 id="setup-health-title">{t("guideShell.brandStatus")}</h2>
            <p>{t("guideShell.brandStatusBody")}</p>
          </div>
          <div className="setup-health__grid">
            {checks.map(({ icon: Icon, label, ready }) => (
              <div className="setup-health__item" key={label}>
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
                <span className={`status-chip ${ready ? "" : "status-chip--warning"}`}>
                  {ready ? (
                    <CheckCircle2 aria-hidden="true" size={14} />
                  ) : (
                    <CircleAlert aria-hidden="true" size={14} />
                  )}
                  {ready ? t("wizard.status.ready") : t("wizard.status.missing")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
