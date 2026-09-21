import { describe, expect, it } from "vitest";

import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { ProjectListItem, ProjectRepository } from "@/application/ports/project-repository";
import { EditorSession } from "@/application/editor/editor-session";
import { GenerateGuideUseCase } from "@/application/use-cases/generate-guide";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import {
  alignTransforms,
  distributeTransforms,
  documentUnitScale,
} from "@/editor/geometry/geometry";
import { snapTransform } from "@/editor/geometry/snap-engine";
import { EditorHistory } from "@/editor/history/editor-history";
import {
  editorClipboardPayloadSchema,
  parseEditorClipboardJson,
} from "@/editor/model/editor-clipboard";
import {
  createShapeLayer,
  groupExtraLayers,
  ungroupExtraLayer,
} from "@/editor/model/page-operations";
import type { RenderedSceneLayer } from "@/editor/model/editor-types";
import { resolveRenderedScene } from "@/editor/scene/scene-resolver";
import {
  moveableDragToDocument,
  moveableResizeToDocument,
  moveableRotateToDocument,
} from "@/infrastructure/editor/moveable-transform-adapter";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_PROJECT_ID,
} from "../../tests/fixtures/stage02/synthetic-project";

class TestClock implements Clock {
  now() {
    return "2026-09-20T12:00:00.000Z" as const;
  }
}

class SequenceIds implements IdGenerator {
  private next = 1000;

  newId() {
    const suffix = String(this.next++).padStart(12, "0");
    return `00000000-0000-4000-8000-${suffix}` as ReturnType<IdGenerator["newId"]>;
  }
}

class RecordingProjectRepository implements ProjectRepository {
  saveCount = 0;

  constructor(private snapshot: ProjectSnapshot) {}

  async save(snapshot: ProjectSnapshot): Promise<void> {
    this.saveCount += 1;
    this.snapshot = structuredClone(snapshot);
  }

  async get(projectId: ProjectId): Promise<ProjectSnapshot | undefined> {
    return projectId === this.snapshot.project.id ? structuredClone(this.snapshot) : undefined;
  }

  async listMetadata(): Promise<ProjectListItem[]> {
    return [
      { id: this.snapshot.project.id, metadata: structuredClone(this.snapshot.project.metadata) },
    ];
  }

  async delete(projectId: ProjectId): Promise<void> {
    if (projectId === this.snapshot.project.id) {
      throw new Error("Delete is not used by the Stage 06 editor tests");
    }
  }
}

function sceneShape(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 100,
): RenderedSceneLayer {
  return {
    id,
    name: id,
    source: "extra",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 1,
    type: "shape",
    shape: "rect",
    fill: "#000000",
    transform: { x, y, width, height, rotation: 0, scaleX: 1, scaleY: 1 },
  };
}

async function fixtureSnapshot(): Promise<ProjectSnapshot> {
  return (await createSyntheticProjectFixture(new WebCryptoSha256Hasher())).snapshot;
}

describe("Stage 06 editor core invariants", () => {
  it("keeps pointer-frame transforms transient and persists one logical drag command", async () => {
    const repository = new RecordingProjectRepository(await fixtureSnapshot());
    const session = await EditorSession.open(
      repository,
      new TestClock(),
      new SequenceIds(),
      SYNTHETIC_PROJECT_ID,
      SYNTHETIC_PAGE_ID,
    );
    const shapeId = await session.addShape(100, 120);
    expect(repository.saveCount).toBe(1);
    const shape = session.page().extras.find((layer) => layer.id === shapeId);
    expect(shape).toBeDefined();
    if (!shape) return;

    session.beginTransform({ [shapeId]: shape.transform });
    for (let frame = 1; frame <= 120; frame += 1) {
      session.previewTransform(shapeId, { ...shape.transform, x: 100 + frame, y: 120 + frame / 2 });
    }
    expect(repository.saveCount).toBe(1);

    await session.commitTransform("Move layer");
    expect(repository.saveCount).toBe(2);
    expect(session.page().extras.find((layer) => layer.id === shapeId)?.transform.x).toBe(220);
    expect(session.historyState().undoLabel).toBe("Move layer");

    await session.undo();
    expect(repository.saveCount).toBe(3);
    expect(session.page().extras.find((layer) => layer.id === shapeId)?.transform.x).toBe(100);

    await session.redo();
    expect(repository.saveCount).toBe(4);
    expect(session.page().extras.find((layer) => layer.id === shapeId)?.transform.x).toBe(220);
  });

  it("does not persist or grow history when a command produces no Immer patches", async () => {
    const repository = new RecordingProjectRepository(await fixtureSnapshot());
    const session = await EditorSession.open(
      repository,
      new TestClock(),
      new SequenceIds(),
      SYNTHETIC_PROJECT_ID,
      SYNTHETIC_PAGE_ID,
    );
    const shapeId = await session.addShape(100, 120);
    const shape = session.page().extras.find((layer) => layer.id === shapeId);
    expect(shape).toBeDefined();
    if (!shape) return;

    expect(repository.saveCount).toBe(1);
    expect(session.historyState().undoEntries).toBe(1);
    await session.setTransforms("No-op geometry", { [shapeId]: structuredClone(shape.transform) });
    expect(repository.saveCount).toBe(1);
    expect(session.historyState().undoEntries).toBe(1);
    expect(session.historyState().undoLabel).toBe("Add rectangle");
  });

  it("bounds session history while retaining reversible Immer patches and labels", async () => {
    const snapshot = await fixtureSnapshot();
    const page = structuredClone(snapshot.project.guide.pages[SYNTHETIC_PAGE_ID]);
    expect(page).toBeDefined();
    if (!page) return;
    const history = new EditorHistory(page);
    for (let index = 0; index < 220; index += 1) {
      history.commit(
        { id: String(index), label: `Edit ${index}`, timestamp: index, affectedIds: ["page"] },
        (draft) => {
          draft.name.en = `Cover ${index}`;
        },
      );
    }
    expect(history.stats().undoEntries).toBeLessThanOrEqual(200);
    expect(history.undoLabel()).toBe("Edit 219");
    history.undo();
    expect(history.current().name.en).toBe("Cover 218");
    expect(history.redoLabel()).toBe("Edit 219");
    history.redo();
    expect(history.current().name.en).toBe("Cover 219");
  });

  it("aligns, distributes and snaps in document coordinates", () => {
    const a = sceneShape("a", 10, 20, 50, 40);
    const b = sceneShape("b", 120, 80, 50, 40);
    const c = sceneShape("c", 300, 140, 50, 40);
    expect(alignTransforms([a, b], "left").b?.x).toBe(10);
    const distributed = distributeTransforms([a, b, c], "horizontal");
    expect(distributed.a?.x).toBe(10);
    expect(distributed.c?.x).toBe(300);
    expect(distributed.b?.x).toBe(155);

    const snapped = snapTransform({
      transform: { ...a.transform, x: 547 },
      pageWidth: 1200,
      pageHeight: 675,
      candidateLayers: [b],
      movingIds: new Set(["a"]),
      thresholdDocumentUnits: 5,
    });
    expect(snapped.transform.x).toBe(550);
    expect(snapped.guides.some((guide) => guide.axis === "x" && guide.source === "page")).toBe(
      true,
    );

    const disabled = snapTransform({
      transform: { ...a.transform, x: 547 },
      pageWidth: 1200,
      pageHeight: 675,
      candidateLayers: [b],
      movingIds: new Set(["a"]),
      thresholdDocumentUnits: 5,
      disabled: true,
    });
    expect(disabled.transform.x).toBe(547);
    expect(disabled.guides).toEqual([]);
  });

  it("normalizes Moveable screen deltas into canonical document-unit transforms", () => {
    const initial = { x: 10, y: 20, width: 100, height: 60, rotation: 0, scaleX: 1, scaleY: 1 };
    expect(moveableDragToDocument(initial, [20, 10], { zoom: 2, unit: "px" })).toMatchObject({
      x: 20,
      y: 25,
    });
    const millimeterScale = documentUnitScale("mm");
    const resized = moveableResizeToDocument(
      initial,
      { widthPx: 200 * millimeterScale, heightPx: 80 * millimeterScale, dragDist: [0, 0] },
      { zoom: 1, unit: "mm" },
    );
    expect(resized.width).toBe(200);
    expect(resized.height).toBe(80);
    expect(moveableRotateToDocument(initial, -15).rotation).toBe(345);
  });

  it("groups and ungroups simple extra layers without moving their world positions", async () => {
    const snapshot = await fixtureSnapshot();
    const page = structuredClone(snapshot.project.guide.pages[SYNTHETIC_PAGE_ID]);
    expect(page).toBeDefined();
    if (!page) return;
    const first = createShapeLayer("00000000-0000-4000-8000-000000000201", 40, 60);
    const second = createShapeLayer("00000000-0000-4000-8000-000000000202", 280, 160);
    page.extras.push(first, second);
    const firstBefore = structuredClone(first.transform);
    const secondBefore = structuredClone(second.transform);
    const groupId = "00000000-0000-4000-8000-000000000203";
    expect(groupExtraLayers(page, [first.id, second.id], groupId)).toBe(true);
    expect(page.extras.find((layer) => layer.id === first.id)?.parentGroupId).toBe(groupId);
    expect(ungroupExtraLayer(page, groupId)).toEqual([first.id, second.id]);
    expect(page.extras.find((layer) => layer.id === first.id)?.transform).toEqual(firstBefore);
    expect(page.extras.find((layer) => layer.id === second.id)?.transform).toEqual(secondBefore);
    expect(page.extras.find((layer) => layer.id === first.id)?.parentGroupId).toBeUndefined();
  });

  it("keeps physical x coordinates invariant when the rendered document direction changes", async () => {
    const snapshot = await fixtureSnapshot();
    const repository = new RecordingProjectRepository(snapshot);
    const generated = await new GenerateGuideUseCase(
      repository,
      new TestClock(),
      new SequenceIds(),
    ).execute(SYNTHETIC_PROJECT_ID, {
      profile: "minimal",
      familyId: "essential",
      localeMode: "ar",
    });
    const pageId = generated.project.guide.pageOrder[0];
    expect(pageId).toBeDefined();
    if (!pageId) return;
    const page = generated.project.guide.pages[pageId];
    expect(page).toBeDefined();
    if (!page) return;
    const ar = resolveRenderedScene(generated, page, "ar");
    const en = resolveRenderedScene(generated, page, "en");
    expect(ar.layers.map((layer) => layer.transform.x)).toEqual(
      en.layers.map((layer) => layer.transform.x),
    );
    expect(ar.layers.find((layer) => layer.type === "text")?.type).toBe("text");
    const arText = ar.layers.find((layer) => layer.type === "text");
    if (arText?.type === "text") expect(arText.direction).toBe("rtl");
  });

  it("rejects malformed external clipboard JSON and accepts canonical layer payloads", async () => {
    expect(parseEditorClipboardJson("not-json")).toBeUndefined();
    expect(
      parseEditorClipboardJson(
        JSON.stringify({ schema: "hawya.editor-clipboard.v1", layers: [{ type: "shape" }] }),
      ),
    ).toBeUndefined();

    const shape = createShapeLayer("00000000-0000-4000-8000-000000000301", 12, 24);
    const json = JSON.stringify({ schema: "hawya.editor-clipboard.v1", layers: [shape] });
    const parsed = parseEditorClipboardJson(json);
    expect(parsed).toBeDefined();
    expect(editorClipboardPayloadSchema.safeParse(parsed).success).toBe(true);
    expect(parsed?.layers[0]?.id).toBe(shape.id);
  });

  it("persists the project snap toggle outside page history", async () => {
    const repository = new RecordingProjectRepository(await fixtureSnapshot());
    const session = await EditorSession.open(
      repository,
      new TestClock(),
      new SequenceIds(),
      SYNTHETIC_PROJECT_ID,
      SYNTHETIC_PAGE_ID,
    );
    expect(session.projectSnapshot().project.settings.snapEnabled).toBe(true);
    await session.setSnapEnabled(false);
    expect(repository.saveCount).toBe(1);
    expect(session.projectSnapshot().project.settings.snapEnabled).toBe(false);
    expect(session.historyState().undoEntries).toBe(0);
  });
});
