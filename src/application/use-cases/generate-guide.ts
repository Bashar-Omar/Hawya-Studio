import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { LocalizedString } from "@/domain/common/primitives";
import { createSemanticPageContent } from "@/domain/guide/page-content";
import {
  guideProfileSchema,
  pageAvailable,
  pageCatalogEntry,
  PROFILE_PAGE_TYPES,
  SECTION_TITLES,
  type GuideProfile,
  type GuideSectionType,
  type SemanticPageType,
} from "@/domain/guide/page-catalog";
import {
  projectSnapshotSchema,
  type ProjectId,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";
import { BUILTIN_TEMPLATE_PACK } from "@/domain/templates/builtin-template-catalog";
import { resolveDefaultTemplate } from "@/domain/templates/template-engine";
import {
  templateFamilyIdSchema,
  templateLocaleModeSchema,
  type TemplateFamilyId,
  type TemplateLocaleMode,
} from "@/domain/templates/template-definition";

export interface GenerateGuideInput {
  profile: GuideProfile;
  familyId: TemplateFamilyId;
  localeMode: TemplateLocaleMode;
  customPageTypes?: SemanticPageType[];
}

function localizedName(title: LocalizedString): LocalizedString {
  return { ...title };
}

export class GenerateGuideUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(projectId: ProjectId, input: GenerateGuideInput): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const profile = guideProfileSchema.parse(input.profile);
    const familyId = templateFamilyIdSchema.parse(input.familyId);
    const localeMode = templateLocaleModeSchema.parse(input.localeMode);
    if (localeMode === "bilingual") {
      const locales = snapshot.project.settings.enabledContentLocales;
      if (!locales.includes("en") || !locales.includes("ar")) {
        throw new Error(
          "Bilingual guide mode requires both English and Arabic project content locales",
        );
      }
    }
    const requested =
      profile === "custom"
        ? [...new Set(input.customPageTypes ?? [])]
        : [...PROFILE_PAGE_TYPES[profile]];
    if (requested.length === 0) throw new Error("Select at least one guide page");
    const selected = requested.filter(
      (type) => profile === "custom" || pageAvailable(snapshot, type),
    );
    if (selected.length === 0)
      throw new Error("No selected guide pages can be generated from the current project");

    const sections = new Map<
      GuideSectionType,
      { id: string; type: GuideSectionType; title: LocalizedString; pageIds: string[] }
    >();
    const pageOrder: string[] = [];
    const pages: Record<string, unknown> = {};

    for (const semanticType of selected) {
      const entry = pageCatalogEntry(semanticType);
      const bound = resolveDefaultTemplate(semanticType, familyId, localeMode);
      const pageId = this.ids.newId();
      pageOrder.push(pageId);
      pages[pageId] = {
        id: pageId,
        name: localizedName(entry.title),
        semanticType,
        content: createSemanticPageContent(semanticType),
        templateBinding: {
          templateId: bound.template.id,
          version: bound.template.version,
          slotBindings: bound.slotBindings,
        },
        canvas: {
          ...bound.template.canvas,
          background: { type: "solid", color: "#FFFFFF", alpha: 1 },
        },
        extras: [],
        localOverrides: [],
      };
      const existing = sections.get(entry.section);
      if (existing) {
        existing.pageIds.push(pageId);
      } else {
        sections.set(entry.section, {
          id: this.ids.newId(),
          type: entry.section,
          title: SECTION_TITLES[entry.section],
          pageIds: [pageId],
        });
      }
    }

    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        settings: {
          ...snapshot.project.settings,
          guideProfile: profile,
          templateFamilyId: familyId,
          guideLocaleMode: localeMode,
        },
        guide: {
          sections: [...sections.values()],
          pageOrder,
          pages,
        },
        templatePackRefs: [
          ...snapshot.project.templatePackRefs.filter(
            (pack) => pack.id !== BUILTIN_TEMPLATE_PACK.id,
          ),
          BUILTIN_TEMPLATE_PACK,
        ],
      },
    });
    await this.projects.save(next);
    return next;
  }
}
