import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { PageId } from "@/domain/guide/guide-document";
import type { SemanticPageType } from "@/domain/guide/page-catalog";
import {
  projectSnapshotSchema,
  type ProjectId,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";
import { resolveTemplateSwitch } from "@/domain/templates/template-engine";
import type { TemplateLocaleMode } from "@/domain/templates/template-definition";

export class ResetGuidePageTemplateUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    projectId: ProjectId,
    pageId: PageId,
    localeMode: TemplateLocaleMode,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const page = snapshot.project.guide.pages[pageId];
    if (!page) throw new Error("Guide page does not exist");
    const bound = resolveTemplateSwitch(
      page.semanticType as SemanticPageType,
      localeMode,
      page.templateBinding.templateId,
    );
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        guide: {
          ...snapshot.project.guide,
          pages: {
            ...snapshot.project.guide.pages,
            [pageId]: {
              ...page,
              templateBinding: {
                templateId: bound.template.id,
                version: bound.template.version,
                slotBindings: bound.slotBindings,
              },
            },
          },
        },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
