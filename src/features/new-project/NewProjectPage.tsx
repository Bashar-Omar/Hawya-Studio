import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Palette,
  Type,
  Image,
  Sparkles,
  FileText,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { useStudioRuntime } from "@/app/providers/studio-runtime";
import { appRoutes, newProjectPath, projectPath } from "@/app/routes/route-config";
import { useRouter } from "@/app/routes/RouterProvider";
import { AppShell } from "@/components/app/AppShell";
import { useAnnounce } from "@/components/app/LiveRegion";
import { Button } from "@/components/ui/button";
import type { ContentLocale } from "@/domain/common/primitives";
import type { ProjectId } from "@/domain/project/hawya-project";
import { SETUP_STEPS, type ProjectSetupDraft, type SetupStep } from "@/domain/project/setup-draft";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/types";

const stepLabelKeys: Record<SetupStep, MessageKey> = {
  basic: "wizard.step.basic",
  logo: "wizard.step.logo",
  colors: "wizard.step.colors",
  typography: "wizard.step.typography",
  foundation: "wizard.step.foundation",
  guide: "wizard.step.guide",
};

const stepIcons: Record<SetupStep, typeof Circle> = {
  basic: Circle,
  logo: Image,
  colors: Palette,
  typography: Type,
  foundation: Sparkles,
  guide: FileText,
};

const guideProfileKeys: Record<
  "minimal" | "standard" | "comprehensive",
  { label: MessageKey; body: MessageKey }
> = {
  minimal: { label: "wizard.guide.minimal", body: "wizard.guide.minimalBody" },
  standard: { label: "wizard.guide.standard", body: "wizard.guide.standardBody" },
  comprehensive: {
    label: "wizard.guide.comprehensive",
    body: "wizard.guide.comprehensiveBody",
  },
};

function WizardProgress({ draft }: { draft: ProjectSetupDraft | undefined }) {
  const { t } = useI18n();
  const current = draft?.currentStep ?? "basic";

  return (
    <ol className="wizard-progress" aria-label={t("wizard.progress")}>
      {SETUP_STEPS.map((step, index) => {
        const status = draft?.steps[step] ?? (step === "basic" ? "pending" : "pending");
        const active = current === step;
        const Icon = status === "completed" ? Check : stepIcons[step];
        return (
          <li
            key={step}
            className={`wizard-progress__item ${active ? "is-active" : ""} ${status !== "pending" ? `is-${status}` : ""}`}
          >
            <span className="wizard-progress__icon" aria-hidden="true">
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <span className="wizard-progress__copy">
              <span className="wizard-progress__number">{index + 1}</span>
              <span>{t(stepLabelKeys[step])}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface BasicFormState {
  name: string;
  clientName: string;
  designerName: string;
  bilingual: boolean;
  defaultContentLocale: ContentLocale;
}

function InitialProjectForm() {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { locale, t } = useI18n();
  const announce = useAnnounce();
  const [form, setForm] = useState<BasicFormState>({
    name: "",
    clientName: "",
    designerName: "",
    bilingual: false,
    defaultContentLocale: locale,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const project = await runtime.createProject.execute({
        name: form.name,
        ...(form.clientName.trim() ? { clientName: form.clientName } : {}),
        ...(form.designerName.trim() ? { designerName: form.designerName } : {}),
        defaultContentLocale: form.defaultContentLocale,
        enabledContentLocales: form.bilingual ? ["en", "ar"] : [form.defaultContentLocale],
      });
      announce(t("wizard.saved"));
      navigate(newProjectPath(project.project.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WizardFrame draft={undefined} title={t("wizard.basic.title")} body={t("wizard.basic.body")}>
      <form
        className="wizard-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label className="field-stack">
          <span className="field-label">{t("wizard.basic.projectName")}</span>
          <input
            className="text-input"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.currentTarget.value }))
            }
            required
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <div className="field-grid">
          <label className="field-stack">
            <span className="field-label">{t("wizard.basic.clientName")}</span>
            <input
              className="text-input"
              value={form.clientName}
              onChange={(event) =>
                setForm((current) => ({ ...current, clientName: event.currentTarget.value }))
              }
              maxLength={120}
              autoComplete="organization"
            />
          </label>
          <label className="field-stack">
            <span className="field-label">{t("wizard.basic.designerName")}</span>
            <input
              className="text-input"
              value={form.designerName}
              onChange={(event) =>
                setForm((current) => ({ ...current, designerName: event.currentTarget.value }))
              }
              maxLength={120}
              autoComplete="name"
            />
          </label>
        </div>
        <fieldset className="choice-group">
          <legend>{t("wizard.basic.contentLanguage")}</legend>
          <label className="choice-card">
            <input
              type="radio"
              name="content-locale"
              value="en"
              checked={form.defaultContentLocale === "en"}
              onChange={() => setForm((current) => ({ ...current, defaultContentLocale: "en" }))}
            />
            <span>
              <strong>English</strong>
              <small>LTR</small>
            </span>
          </label>
          <label className="choice-card">
            <input
              type="radio"
              name="content-locale"
              value="ar"
              checked={form.defaultContentLocale === "ar"}
              onChange={() => setForm((current) => ({ ...current, defaultContentLocale: "ar" }))}
            />
            <span>
              <strong>العربية</strong>
              <small>RTL</small>
            </span>
          </label>
        </fieldset>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.bilingual}
            onChange={(event) =>
              setForm((current) => ({ ...current, bilingual: event.currentTarget.checked }))
            }
          />
          <span>
            <strong>{t("wizard.basic.bilingual")}</strong>
            <small>{t("wizard.basic.bilingualBody")}</small>
          </span>
        </label>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="wizard-actions">
          <Button variant="secondary" type="button" onClick={() => navigate(appRoutes.studio)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!form.name.trim() || submitting}>
            {t("common.continue")}
            <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
          </Button>
        </div>
      </form>
    </WizardFrame>
  );
}

function WizardFrame({
  body,
  children,
  draft,
  title,
}: {
  body: string;
  children: ReactNode;
  draft: ProjectSetupDraft | undefined;
  title: string;
}) {
  const { t } = useI18n();
  return (
    <AppShell title={t("wizard.title")} subtitle={t("wizard.subtitle")}>
      <div className="wizard-layout">
        <aside className="wizard-sidebar">
          <WizardProgress draft={draft} />
        </aside>
        <section className="wizard-card">
          <header className="wizard-card__header">
            <h1>{title}</h1>
            <p>{body}</p>
          </header>
          {children}
        </section>
      </div>
    </AppShell>
  );
}

function ExistingProjectWizard({ projectId }: { projectId: ProjectId }) {
  const runtime = useStudioRuntime();
  const { navigate } = useRouter();
  const { t } = useI18n();
  const announce = useAnnounce();
  const [draft, setDraft] = useState<ProjectSetupDraft | null>(null);
  const [projectName, setProjectName] = useState("");
  const [primaryHex, setPrimaryHex] = useState("");
  const [descriptor, setDescriptor] = useState("");
  const [mission, setMission] = useState("");
  const [guideProfile, setGuideProfile] = useState<"minimal" | "standard" | "comprehensive">(
    "standard",
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const state = await runtime.setupWizard.load(projectId);
      if (!state) {
        const project = await runtime.projects.get(projectId);
        navigate(project ? projectPath(projectId) : appRoutes.studio);
        return;
      }
      setDraft(state.draft);
      setProjectName(state.snapshot.project.metadata.name);
      setPrimaryHex(
        state.snapshot.project.brand.colors.tokens.find((token) => token.role === "primary")
          ?.srgbHex ?? "",
      );
      const locale = state.snapshot.project.settings.defaultContentLocale;
      setDescriptor(state.snapshot.project.brand.identity.descriptor?.[locale] ?? "");
      setMission(state.snapshot.project.brand.identity.mission?.[locale] ?? "");
      const profile = state.snapshot.project.settings.guideProfile;
      setGuideProfile(profile === "custom" ? "standard" : profile);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }, [navigate, projectId, runtime, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (operation: () => Promise<ProjectSetupDraft>) => {
    setBusy(true);
    setError(null);
    try {
      const nextDraft = await operation();
      setDraft(nextDraft);
      announce(t("wizard.saved"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  };

  const goBack = async () => {
    if (!draft) return;
    const index = SETUP_STEPS.indexOf(draft.currentStep);
    const previous = SETUP_STEPS[index - 1];
    if (!previous || previous === "basic") {
      navigate(appRoutes.studio);
      return;
    }
    await run(() => runtime.setupWizard.setCurrentStep(projectId, previous));
  };

  if (loading || !draft) {
    return (
      <AppShell title={t("wizard.title")} subtitle={t("wizard.subtitle")}>
        <div className="page-content">
          <p>{loading ? t("common.loading") : error}</p>
        </div>
      </AppShell>
    );
  }

  const current = draft.currentStep;
  const stepTitle = t(stepLabelKeys[current]);

  const shell = (body: string, content: ReactNode) => (
    <WizardFrame draft={draft} title={stepTitle} body={body}>
      <div className="wizard-project-name">{projectName}</div>
      {content}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </WizardFrame>
  );

  if (current === "logo") {
    return shell(
      t("wizard.logo.body"),
      <>
        <div className="missing-data-card">
          <Image aria-hidden="true" size={22} />
          <div>
            <strong>{t("wizard.missing.title")}</strong>
            <p>{t("wizard.logo.missing")}</p>
          </div>
        </div>
        <p className="wizard-note">{t("wizard.logo.stageBoundary")}</p>
        <div className="wizard-actions">
          <Button variant="secondary" onClick={() => navigate(appRoutes.studio)}>
            {t("common.saveExit")}
          </Button>
          <Button
            onClick={() => void run(() => runtime.setupWizard.skip(projectId, "logo"))}
            disabled={busy}
          >
            {t("wizard.skipForNow")}
            <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
          </Button>
        </div>
      </>,
    );
  }

  if (current === "colors") {
    return shell(
      t("wizard.colors.body"),
      <>
        <label className="field-stack">
          <span className="field-label">{t("wizard.colors.primary")}</span>
          <div className="color-input-row">
            <input
              className="color-well"
              type="color"
              value={/^#[0-9A-Fa-f]{6}$/.test(primaryHex) ? primaryHex : "#5B4FF7"}
              onChange={(event) => setPrimaryHex(event.currentTarget.value.toUpperCase())}
              aria-label={t("wizard.colors.primary")}
            />
            <input
              className="text-input"
              value={primaryHex}
              placeholder="#5B4FF7"
              onChange={(event) => setPrimaryHex(event.currentTarget.value)}
              pattern="#[0-9A-Fa-f]{6}"
            />
          </div>
          <small className="field-help">{t("wizard.colors.helper")}</small>
        </label>
        <div className="wizard-actions wizard-actions--split">
          <Button variant="secondary" onClick={() => void goBack()} disabled={busy}>
            <ChevronLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("common.back")}
          </Button>
          <div className="wizard-actions__end">
            <Button
              variant="ghost"
              onClick={() => void run(() => runtime.setupWizard.skip(projectId, "colors"))}
              disabled={busy}
            >
              {t("wizard.skipForNow")}
            </Button>
            <Button
              onClick={() =>
                void run(() => runtime.setupWizard.completeColors(projectId, primaryHex))
              }
              disabled={busy || !primaryHex.trim()}
            >
              {t("common.continue")}
              <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      </>,
    );
  }

  if (current === "typography") {
    return shell(
      t("wizard.typography.body"),
      <>
        <div className="missing-data-card">
          <Type aria-hidden="true" size={22} />
          <div>
            <strong>{t("wizard.missing.title")}</strong>
            <p>{t("wizard.typography.missing")}</p>
          </div>
        </div>
        <p className="wizard-note">{t("wizard.typography.stageBoundary")}</p>
        <div className="wizard-actions wizard-actions--split">
          <Button variant="secondary" onClick={() => void goBack()} disabled={busy}>
            <ChevronLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("common.back")}
          </Button>
          <Button
            onClick={() => void run(() => runtime.setupWizard.skip(projectId, "typography"))}
            disabled={busy}
          >
            {t("wizard.skipForNow")}
            <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
          </Button>
        </div>
      </>,
    );
  }

  if (current === "foundation") {
    return shell(
      t("wizard.foundation.body"),
      <>
        <label className="field-stack">
          <span className="field-label">{t("wizard.foundation.descriptor")}</span>
          <input
            className="text-input"
            value={descriptor}
            onChange={(event) => setDescriptor(event.currentTarget.value)}
            maxLength={180}
          />
        </label>
        <label className="field-stack">
          <span className="field-label">{t("wizard.foundation.mission")}</span>
          <textarea
            className="text-area"
            value={mission}
            onChange={(event) => setMission(event.currentTarget.value)}
            rows={4}
            maxLength={700}
          />
        </label>
        <div className="wizard-actions wizard-actions--split">
          <Button variant="secondary" onClick={() => void goBack()} disabled={busy}>
            <ChevronLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("common.back")}
          </Button>
          <div className="wizard-actions__end">
            <Button
              variant="ghost"
              onClick={() => void run(() => runtime.setupWizard.skip(projectId, "foundation"))}
              disabled={busy}
            >
              {t("wizard.skipForNow")}
            </Button>
            <Button
              onClick={() =>
                void run(() =>
                  runtime.setupWizard.completeFoundation(projectId, { descriptor, mission }),
                )
              }
              disabled={busy || (!descriptor.trim() && !mission.trim())}
            >
              {t("common.continue")}
              <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      </>,
    );
  }

  if (current === "guide") {
    return shell(
      t("wizard.guide.body"),
      <>
        <fieldset className="guide-profile-grid">
          <legend className="sr-only">{t("wizard.guide.profile")}</legend>
          {(["minimal", "standard", "comprehensive"] as const).map((profile) => (
            <label key={profile} className="guide-profile-card">
              <input
                type="radio"
                name="guide-profile"
                value={profile}
                checked={guideProfile === profile}
                onChange={() => setGuideProfile(profile)}
              />
              <span>
                <strong>{t(guideProfileKeys[profile].label)}</strong>
                <small>{t(guideProfileKeys[profile].body)}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <section className="setup-summary" aria-labelledby="setup-summary-title">
          <h2 className="sr-only" id="setup-summary-title">
            {t("wizard.summary")}
          </h2>
          {SETUP_STEPS.filter((step) => step !== "basic" && step !== "guide").map((step) => (
            <div key={step} className="setup-summary__row">
              <span>{t(stepLabelKeys[step])}</span>
              <strong>
                {draft.steps[step] === "skipped"
                  ? t("wizard.status.missing")
                  : t("wizard.status.ready")}
              </strong>
            </div>
          ))}
        </section>
        <p className="wizard-note">{t("wizard.guide.emptyShell")}</p>
        <div className="wizard-actions wizard-actions--split">
          <Button variant="secondary" onClick={() => void goBack()} disabled={busy}>
            <ChevronLeft className="directional-icon" aria-hidden="true" size={16} />
            {t("common.back")}
          </Button>
          <Button
            onClick={() => {
              setBusy(true);
              setError(null);
              void runtime.setupWizard
                .finish(projectId, guideProfile)
                .then(() => {
                  announce(t("wizard.finished"));
                  navigate(projectPath(projectId));
                })
                .catch((cause: unknown) => {
                  setError(cause instanceof Error ? cause.message : t("common.unknownError"));
                })
                .finally(() => setBusy(false));
            }}
            disabled={busy}
          >
            {t("wizard.finish")}
            <ChevronRight className="directional-icon" aria-hidden="true" size={16} />
          </Button>
        </div>
      </>,
    );
  }

  return shell(t("wizard.basic.body"), <p>{t("wizard.saved")}</p>);
}

export function NewProjectPage({ projectId }: { projectId?: ProjectId }) {
  return projectId ? <ExistingProjectWizard projectId={projectId} /> : <InitialProjectForm />;
}
