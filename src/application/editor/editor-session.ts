import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectRepository } from "@/application/ports/project-repository";
import type { AssetId } from "@/domain/assets/asset";
import type { GuidePage, Layer, PageId } from "@/domain/guide/guide-document";
import {
  projectSnapshotSchema,
  type ProjectId,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";
import { EditorHistory } from "@/editor/history/editor-history";
import {
  addExtraLayer,
  applySceneTransform,
  createAssetLayer,
  createShapeLayer,
  createTextLayer,
  deleteSceneLayers,
  duplicateExtraLayers,
  groupExtraLayers,
  setSceneLocked,
  setSceneText,
  setSceneVisibility,
  ungroupExtraLayer,
} from "@/editor/model/page-operations";
import type {
  EditorClipboardPayload,
  LayerTransform,
  SceneLayerId,
} from "@/editor/model/editor-types";

export class EditorSession {
  private readonly history: EditorHistory;
  private transientTransforms = new Map<SceneLayerId, LayerTransform>();

  private constructor(
    private readonly projects: ProjectRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    readonly projectId: ProjectId,
    readonly pageId: PageId,
    private snapshot: ProjectSnapshot,
    page: GuidePage,
  ) {
    this.history = new EditorHistory(page);
  }

  static async open(
    projects: ProjectRepository,
    clock: Clock,
    ids: IdGenerator,
    projectId: ProjectId,
    pageId: PageId,
  ): Promise<EditorSession> {
    const snapshot = await projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    const page = snapshot.project.guide.pages[pageId];
    if (!page) throw new Error(`Guide page ${pageId} does not exist`);
    return new EditorSession(
      projects,
      clock,
      ids,
      projectId,
      pageId,
      snapshot,
      structuredClone(page),
    );
  }

  page(): GuidePage {
    return this.history.current();
  }

  projectSnapshot(): ProjectSnapshot {
    return this.snapshot;
  }

  historyState() {
    return {
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
      undoLabel: this.history.undoLabel(),
      redoLabel: this.history.redoLabel(),
      ...this.history.stats(),
    };
  }

  beginTransform(transforms: Readonly<Record<SceneLayerId, LayerTransform>>): void {
    this.transientTransforms = new Map(
      Object.entries(transforms).map(([id, transform]) => [id, structuredClone(transform)]),
    );
  }

  previewTransform(
    sceneId: SceneLayerId,
    transform: LayerTransform,
  ): ReadonlyMap<SceneLayerId, LayerTransform> {
    this.transientTransforms.set(sceneId, transform);
    return this.transientTransforms;
  }

  transient(): ReadonlyMap<SceneLayerId, LayerTransform> {
    return this.transientTransforms;
  }

  cancelTransform(): void {
    this.transientTransforms.clear();
  }

  async commitTransform(label = "Transform layers"): Promise<GuidePage> {
    const transforms = [...this.transientTransforms.entries()];
    if (transforms.length === 0) return this.page();
    const next = await this.commit(
      label,
      transforms.map(([id]) => id),
      (page) => {
        for (const [id, transform] of transforms) applySceneTransform(page, id, transform);
      },
    );
    this.transientTransforms.clear();
    return next;
  }

  async setTransforms(
    label: string,
    transforms: Readonly<Record<SceneLayerId, LayerTransform>>,
  ): Promise<GuidePage> {
    return this.commit(label, Object.keys(transforms), (page) => {
      for (const [id, transform] of Object.entries(transforms))
        applySceneTransform(page, id, transform);
    });
  }

  async addText(
    x: number,
    y: number,
    text?: string,
    options: { language?: string; direction?: "auto" | "ltr" | "rtl" } = {},
  ): Promise<string> {
    const id = this.ids.newId();
    await this.commit("Add text", [id], (page) =>
      addExtraLayer(page, createTextLayer(id, x, y, text, options)),
    );
    return id;
  }

  async addShape(x: number, y: number): Promise<string> {
    const id = this.ids.newId();
    await this.commit("Add rectangle", [id], (page) =>
      addExtraLayer(page, createShapeLayer(id, x, y)),
    );
    return id;
  }

  async addAsset(
    assetId: AssetId,
    kind: "image" | "vector",
    x: number,
    y: number,
  ): Promise<string> {
    const id = this.ids.newId();
    await this.commit("Place asset", [id], (page) =>
      addExtraLayer(page, createAssetLayer(id, assetId, kind, x, y)),
    );
    return id;
  }

  async updateText(sceneId: SceneLayerId, text: string): Promise<GuidePage> {
    return this.commit("Edit text", [sceneId], (page) => setSceneText(page, sceneId, text));
  }

  async setVisible(sceneId: SceneLayerId, visible: boolean): Promise<GuidePage> {
    return this.commit(visible ? "Show layer" : "Hide layer", [sceneId], (page) =>
      setSceneVisibility(page, sceneId, visible),
    );
  }

  async setLocked(sceneId: SceneLayerId, locked: boolean): Promise<GuidePage> {
    return this.commit(locked ? "Lock layer" : "Unlock layer", [sceneId], (page) =>
      setSceneLocked(page, sceneId, locked),
    );
  }

  async delete(sceneIds: readonly SceneLayerId[]): Promise<GuidePage> {
    return this.commit("Delete layers", [...sceneIds], (page) => deleteSceneLayers(page, sceneIds));
  }

  async duplicate(sceneIds: readonly SceneLayerId[]): Promise<string[]> {
    const eligible = sceneIds.filter((id) =>
      this.page().extras.some((layer) => layer.id === id && layer.type !== "group"),
    );
    if (eligible.length === 0) return [];
    const ids = eligible.map(() => this.ids.newId());
    let created: string[] = [];
    await this.commit("Duplicate layers", eligible, (page) => {
      created = duplicateExtraLayers(page, eligible, ids);
    });
    return created;
  }

  async group(sceneIds: readonly SceneLayerId[]): Promise<string | undefined> {
    const eligible = sceneIds.filter((id) =>
      this.page().extras.some(
        (layer) => layer.id === id && !layer.parentGroupId && layer.type !== "group",
      ),
    );
    if (eligible.length < 2) return undefined;
    const id = this.ids.newId();
    let grouped = false;
    await this.commit("Group layers", [...sceneIds, id], (page) => {
      grouped = groupExtraLayers(page, eligible, id);
    });
    return grouped ? id : undefined;
  }

  async ungroup(groupId: SceneLayerId): Promise<string[]> {
    let children: string[] = [];
    await this.commit("Ungroup layers", [groupId], (page) => {
      children = ungroupExtraLayer(page, groupId);
    });
    return children;
  }

  clipboardPayload(sceneIds: readonly SceneLayerId[]): EditorClipboardPayload | undefined {
    const ids = new Set(sceneIds);
    const layers = this.page().extras.filter(
      (layer) => ids.has(layer.id) && layer.type !== "group",
    );
    if (layers.length === 0) return undefined;
    return { schema: "hawya.editor-clipboard.v1", layers: structuredClone(layers) };
  }

  async paste(payload: EditorClipboardPayload): Promise<string[]> {
    if (payload.schema !== "hawya.editor-clipboard.v1") return [];
    const newLayers: Layer[] = payload.layers.map((layer, index) => {
      const clone = structuredClone(layer);
      delete clone.parentGroupId;
      return {
        ...clone,
        id: this.ids.newId(),
        name: `${layer.name} copy`,
        transform: {
          ...layer.transform,
          x: layer.transform.x + 16 + index * 4,
          y: layer.transform.y + 16 + index * 4,
        },
      };
    });
    await this.commit(
      "Paste layers",
      newLayers.map((layer) => layer.id),
      (page) => {
        page.extras.push(...newLayers);
      },
    );
    return newLayers.map((layer) => layer.id);
  }

  async setSnapEnabled(enabled: boolean): Promise<void> {
    const latest = await this.projects.get(this.projectId);
    if (!latest) throw new Error(`Project ${this.projectId} no longer exists`);
    if (latest.project.settings.snapEnabled === enabled) {
      this.snapshot = latest;
      return;
    }
    const next = projectSnapshotSchema.parse({
      ...latest,
      project: {
        ...latest.project,
        metadata: { ...latest.project.metadata, updatedAt: this.clock.now() },
        settings: { ...latest.project.settings, snapEnabled: enabled },
      },
    });
    await this.projects.save(next);
    this.snapshot = next;
  }

  async undo(): Promise<GuidePage | undefined> {
    const page = this.history.undo();
    if (!page) return undefined;
    await this.persist(page);
    return page;
  }

  async redo(): Promise<GuidePage | undefined> {
    const page = this.history.redo();
    if (!page) return undefined;
    await this.persist(page);
    return page;
  }

  private async commit(
    label: string,
    affectedIds: string[],
    recipe: (page: GuidePage) => void,
  ): Promise<GuidePage> {
    const before = this.history.current();
    const next = this.history.commit(
      {
        id: this.ids.newId(),
        label,
        timestamp: Date.parse(this.clock.now()),
        affectedIds,
      },
      recipe,
    );
    if (next === before) return next;
    await this.persist(next);
    return next;
  }

  private async persist(page: GuidePage): Promise<void> {
    const latest = await this.projects.get(this.projectId);
    if (!latest) throw new Error(`Project ${this.projectId} no longer exists`);
    const next = projectSnapshotSchema.parse({
      ...latest,
      project: {
        ...latest.project,
        metadata: { ...latest.project.metadata, updatedAt: this.clock.now() },
        guide: {
          ...latest.project.guide,
          pages: { ...latest.project.guide.pages, [this.pageId]: page },
        },
      },
    });
    await this.projects.save(next);
    this.snapshot = next;
  }
}
