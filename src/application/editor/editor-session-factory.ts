import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { EditorSession } from "@/application/editor/editor-session";
import type { PageId } from "@/domain/guide/guide-document";
import type { ProjectId } from "@/domain/project/hawya-project";

export class EditorSessionFactory {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  open(projectId: ProjectId, pageId: PageId): Promise<EditorSession> {
    return EditorSession.open(this.projects, this.clock, this.ids, projectId, pageId);
  }
}
