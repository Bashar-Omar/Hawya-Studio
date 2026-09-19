import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { SetupDraftRepository } from "@/application/ports/setup-draft-repository";
import {
  projectSnapshotSchema,
  rebaseProjectSnapshotId,
  type ProjectId,
} from "@/domain/project/hawya-project";
import { projectSetupDraftSchema } from "@/domain/project/setup-draft";
import { slugifyProjectName } from "@/application/use-cases/create-project";

export class DuplicateProjectUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly setupDrafts: SetupDraftRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(projectId: ProjectId, name: string): Promise<ProjectId> {
    const source = await this.projects.get(projectId);
    if (!source) {
      throw new Error(`Project ${projectId} does not exist`);
    }

    const nextId = this.ids.newId();
    const now = this.clock.now();
    const nextName = name.trim() || `${source.project.metadata.name} Copy`;
    const rebased = rebaseProjectSnapshotId(source, nextId);
    const duplicate = projectSnapshotSchema.parse({
      ...rebased,
      project: {
        ...rebased.project,
        metadata: {
          ...rebased.project.metadata,
          name: nextName,
          slug: slugifyProjectName(nextName, nextId),
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
          lastBackupAt: undefined,
          lastExportAt: undefined,
        },
        revisions: [],
      },
    });

    await this.projects.save(duplicate);
    const sourceDraft = await this.setupDrafts.get(projectId);
    if (sourceDraft) {
      await this.setupDrafts.save(
        projectSetupDraftSchema.parse({
          ...sourceDraft,
          projectId: nextId,
          updatedAt: now,
        }),
      );
    }
    return nextId;
  }
}
