import type { Clock } from "@/application/ports/clock";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AuditQuickFix } from "@/domain/audit/audit-engine";
import type { GuidePage } from "@/domain/guide/guide-document";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";
import { upsertEditorOverride } from "@/editor/model/local-overrides";

function requirePage(snapshot: ProjectSnapshot, pageId: string): GuidePage {
  const page = snapshot.project.guide.pages[pageId];
  if (!page) throw new Error("Audit quick-fix page does not exist");
  return page;
}

function applyFix(snapshot: ProjectSnapshot, fix: AuditQuickFix): void {
  const page = requirePage(snapshot, fix.pageId);
  if (fix.type === "use-color-token") {
    if (!snapshot.project.brand.colors.tokens.some((token) => token.id === fix.tokenId)) {
      throw new Error("Audit quick-fix color token does not exist");
    }
    const layer = page.extras.find((item) => item.id === fix.layerId);
    if (layer?.type !== "text") throw new Error("Audit quick-fix text layer does not exist");
    layer.fill = { colorTokenId: fix.tokenId };
    return;
  }
  if (fix.type === "fit-layer-to-page") {
    const layer = page.extras.find((item) => item.id === fix.layerId);
    if (!layer) throw new Error("Audit quick-fix layer does not exist");
    const width = Math.max(1, Math.min(layer.transform.width || 1, page.canvas.width));
    const height = Math.max(1, Math.min(layer.transform.height || 1, page.canvas.height));
    layer.transform = {
      ...layer.transform,
      width,
      height,
      x: Math.min(Math.max(0, layer.transform.x), Math.max(0, page.canvas.width - width)),
      y: Math.min(Math.max(0, layer.transform.y), Math.max(0, page.canvas.height - height)),
    };
    return;
  }
  if (fix.type === "show-template-layer") {
    upsertEditorOverride(page, fix.targetId, { visible: true });
    return;
  }
  page.localOverrides = page.localOverrides.filter((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return true;
    return !("targetId" in candidate && candidate.targetId === fix.targetId);
  });
}

export class ApplyAuditQuickFixUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
  ) {}

  async execute(projectId: ProjectId, fix: AuditQuickFix): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const draft = structuredClone(snapshot);
    applyFix(draft, fix);
    draft.project.metadata.updatedAt = this.clock.now();
    const next = projectSnapshotSchema.parse(draft);
    await this.projects.save(next);
    return next;
  }
}
