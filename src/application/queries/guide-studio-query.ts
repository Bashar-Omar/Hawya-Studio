import type { ProjectRepository } from "@/application/ports/project-repository";
import {
  resolveContentBinding,
  type ResolvedBindingValue,
} from "@/domain/guide/guide-binding-resolver";
import { guidePageStatus, type GuidePageStatus } from "@/domain/guide/guide-status";
import type { GuidePage, PageId } from "@/domain/guide/guide-document";
import type { SemanticPageType } from "@/domain/guide/page-catalog";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { compatibleTemplates, templateById } from "@/domain/templates/template-engine";
import type { PageTemplate, TemplateLocaleMode } from "@/domain/templates/template-definition";

export interface GuideSlotView {
  id: string;
  role: string;
  required: boolean;
  binding?: string;
  value?: ResolvedBindingValue;
}

export interface GuidePageView {
  page: GuidePage;
  template?: PageTemplate;
  status: GuidePageStatus;
  slots: GuideSlotView[];
  compatibleTemplates: PageTemplate[];
}

export interface GuideStudioView {
  snapshot: ProjectSnapshot;
  localeMode: TemplateLocaleMode;
  pageViews: Record<PageId, GuidePageView>;
}

export function inferGuideLocaleMode(snapshot: ProjectSnapshot): TemplateLocaleMode {
  const stored = snapshot.project.settings.guideLocaleMode;
  if (stored) return stored;
  const locales = snapshot.project.settings.enabledContentLocales;
  if (locales.includes("en") && locales.includes("ar")) return "bilingual";
  return snapshot.project.settings.defaultContentLocale;
}

export class GuideStudioQuery {
  constructor(private readonly projects: ProjectRepository) {}

  async execute(projectId: ProjectId): Promise<GuideStudioView | undefined> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) return undefined;
    const localeMode = inferGuideLocaleMode(snapshot);
    const pageViews: Record<PageId, GuidePageView> = {};
    for (const pageId of snapshot.project.guide.pageOrder) {
      const page = snapshot.project.guide.pages[pageId];
      if (!page) continue;
      const template = templateById(page.templateBinding.templateId);
      const slots: GuideSlotView[] =
        template?.slots.map((slot) => {
          const binding = page.templateBinding.slotBindings[slot.id];
          const value = binding ? resolveContentBinding(snapshot, page, binding) : undefined;
          return {
            id: slot.id,
            role: slot.role,
            required: slot.required,
            ...(binding ? { binding } : {}),
            ...(value ? { value } : {}),
          };
        }) ?? [];
      pageViews[pageId] = {
        page,
        ...(template ? { template } : {}),
        status: guidePageStatus(snapshot, page),
        slots,
        compatibleTemplates: compatibleTemplates(page.semanticType as SemanticPageType, localeMode),
      };
    }
    return { snapshot, localeMode, pageViews };
  }
}
