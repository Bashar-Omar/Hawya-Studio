import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { type TextStyleToken, textStyleTokenSchema } from "@/domain/brand/brand-system";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

export type TextStyleInput = Omit<TextStyleToken, "id">;

export class ManageTextStylesUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async add(projectId: ProjectId, input: TextStyleInput): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireFont(snapshot, input.fontRefId);
    const style = textStyleTokenSchema.parse({ id: this.ids.newId(), ...input });
    return this.save(snapshot, [...snapshot.project.brand.typography.styles, style]);
  }

  async update(
    projectId: ProjectId,
    styleId: string,
    input: TextStyleInput,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireFont(snapshot, input.fontRefId);
    if (!snapshot.project.brand.typography.styles.some((style) => style.id === styleId)) {
      throw new Error("Text style does not exist");
    }
    const style = textStyleTokenSchema.parse({ id: styleId, ...input });
    return this.save(
      snapshot,
      snapshot.project.brand.typography.styles.map((item) => (item.id === styleId ? style : item)),
    );
  }

  async remove(projectId: ProjectId, styleId: string): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    return this.save(
      snapshot,
      snapshot.project.brand.typography.styles.filter((style) => style.id !== styleId),
    );
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    return snapshot;
  }

  private requireFont(snapshot: ProjectSnapshot, fontRefId: string): void {
    if (!snapshot.project.brand.typography.fonts.some((font) => font.id === fontRefId)) {
      throw new Error("Text style font is missing");
    }
  }

  private async save(
    snapshot: ProjectSnapshot,
    styles: TextStyleToken[],
  ): Promise<ProjectSnapshot> {
    const now = this.clock.now();
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: now },
        brand: {
          ...snapshot.project.brand,
          typography: { ...snapshot.project.brand.typography, styles },
        },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
