import { describe, expect, it } from "vitest";

import type { BinaryPayload, BinaryStore, StoredBinary } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { LogoAnalyzer } from "@/application/ports/logo-analyzer";
import type { ProjectListItem, ProjectRepository } from "@/application/ports/project-repository";
import { ApplyAuditQuickFixUseCase } from "@/application/use-cases/apply-audit-quick-fix";
import { ManageLogoSmartRulesUseCase } from "@/application/use-cases/manage-logo-smart-rules";
import type { ContentHash } from "@/domain/assets/asset";
import { buildAuditReport } from "@/domain/audit/audit-engine";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import type { LogoGeometryInsight } from "@/domain/smart/logo-analysis";
import { WebCryptoSha256Hasher } from "@/infrastructure/runtime/web-crypto-sha256-hasher";
import {
  createSyntheticProjectFixture,
  SYNTHETIC_COLOR_ID,
  SYNTHETIC_LOGO_VARIANT_ID,
  SYNTHETIC_PAGE_ID,
  SYNTHETIC_PROJECT_ID,
} from "../../../tests/fixtures/stage02/synthetic-project";

class TestClock implements Clock {
  now() {
    return "2026-09-21T11:00:00.000Z" as const;
  }
}

class MemoryProjects implements ProjectRepository {
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
    return [{ id: this.snapshot.project.id, metadata: this.snapshot.project.metadata }];
  }
  async delete(): Promise<void> {}
}

class MemoryBinaries implements BinaryStore {
  private readonly data = new Map<ContentHash, StoredBinary>();
  constructor(payloads: BinaryPayload[]) {
    for (const payload of payloads) {
      this.data.set(payload.contentHash, { ...payload, byteLength: payload.bytes.byteLength });
    }
  }
  async has(hash: ContentHash) {
    return this.data.has(hash);
  }
  async get(hash: ContentHash) {
    return this.data.get(hash);
  }
  async put(payload: BinaryPayload) {
    const inserted = !this.data.has(payload.contentHash);
    this.data.set(payload.contentHash, { ...payload, byteLength: payload.bytes.byteLength });
    return { inserted };
  }
  async listContentHashes() {
    return [...this.data.keys()];
  }
  async delete(hash: ContentHash) {
    this.data.delete(hash);
  }
}

const measuredInsight: LogoGeometryInsight = {
  kind: "svg",
  canvas: { width: 100, height: 100 },
  visibleBounds: { x: 20, y: 25, width: 60, height: 50 },
  aspectRatio: 1.2,
  padding: { top: 25, right: 20, bottom: 25, left: 20 },
  cropSuggestion: { x: 0.2, y: 0.25, width: 0.6, height: 0.5 },
  paletteCandidates: ["#112233"],
};

class StubLogoAnalyzer implements LogoAnalyzer {
  async analyze(): Promise<LogoGeometryInsight> {
    return measuredInsight;
  }
}

async function fixture() {
  return createSyntheticProjectFixture(new WebCryptoSha256Hasher());
}

describe("Stage 07 smart-rule and audit application boundaries", () => {
  it("requires measured geometry before confirming non-manual clear-space rules", async () => {
    const source = await fixture();
    const projects = new MemoryProjects(source.snapshot);
    const useCase = new ManageLogoSmartRulesUseCase(
      projects,
      new MemoryBinaries(source.binaries),
      new StubLogoAnalyzer(),
      new TestClock(),
    );

    await expect(
      useCase.confirmClearSpace(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_VARIANT_ID, {
        reference: "mark-height",
        value: 0.5,
        unit: "ratio",
      }),
    ).rejects.toThrow("Analyze the logo");
    await expect(
      useCase.confirmClearSpace(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_VARIANT_ID, {
        reference: "mark-height",
        value: 12,
        unit: "px",
      }),
    ).rejects.toThrow("must use a ratio");
    expect(projects.saveCount).toBe(0);
  });

  it("persists measured logo geometry without auto-verifying clear-space or minimum-size rules", async () => {
    const source = await fixture();
    const projects = new MemoryProjects(source.snapshot);
    const useCase = new ManageLogoSmartRulesUseCase(
      projects,
      new MemoryBinaries(source.binaries),
      new StubLogoAnalyzer(),
      new TestClock(),
    );

    await useCase.analyze(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_VARIANT_ID);
    const analyzed = await projects.get(SYNTHETIC_PROJECT_ID);
    const variant = analyzed?.project.brand.logos.variants[0];
    expect(variant?.geometry?.source).toBe("measured");
    expect(variant?.geometry?.data).toEqual(measuredInsight);
    expect(analyzed?.project.brand.logos.rules.clearSpace).toBeUndefined();
    expect(analyzed?.project.brand.logos.rules.minimumSize).toBeUndefined();

    await useCase.confirmClearSpace(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_VARIANT_ID, {
      reference: "mark-height",
      value: 0.5,
      unit: "ratio",
    });
    await useCase.confirmMinimumSize(SYNTHETIC_PROJECT_ID, SYNTHETIC_LOGO_VARIANT_ID, {
      screenPx: 48,
      printMm: 18,
    });
    const confirmed = await projects.get(SYNTHETIC_PROJECT_ID);
    expect(confirmed?.project.brand.logos.rules.clearSpace?.source).toBe("user");
    expect(confirmed?.project.brand.logos.rules.minimumSize?.source).toBe("user");
  });

  it("builds deterministic audit findings and applies only typed quick fixes", async () => {
    const source = await fixture();
    const snapshot = structuredClone(source.snapshot);
    const page = snapshot.project.guide.pages[SYNTHETIC_PAGE_ID];
    expect(page).toBeDefined();
    if (!page) return;
    const layerId = "00000000-0000-4000-8000-000000000777";
    page.extras.push({
      id: layerId,
      name: "Detached text",
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: -20, y: 10, width: 1300, height: 40, rotation: 0, scaleX: 1, scaleY: 1 },
      source: "extra",
      type: "text",
      content: "Audit me",
      typography: {},
      fill: { type: "solid", color: "#111111", alpha: 1 },
      alignment: "start",
      verticalAlign: "top",
      direction: "auto",
      overflow: "visible",
    });
    const rotatedLayerId = "00000000-0000-4000-8000-000000000778";
    page.extras.push({
      id: rotatedLayerId,
      name: "Rotated outside",
      visible: true,
      locked: false,
      opacity: 1,
      transform: { x: 0, y: 0, width: 100, height: 100, rotation: 45, scaleX: 1, scaleY: 1 },
      source: "extra",
      type: "shape",
      data: { shape: "rect", fill: "#222222", radius: 0 },
    });
    page.localOverrides.push({ targetId: "template:missing-slot", transform: { x: "invalid" } });

    const report = buildAuditReport(snapshot, { has: () => true });
    const detached = report.issues.find((entry) => entry.code === "detached-color-token");
    const outside = report.issues.find(
      (entry) => entry.code === "layer-outside-page" && entry.location.endsWith(layerId),
    );
    const rotatedOutside = report.issues.find(
      (entry) => entry.code === "layer-outside-page" && entry.location.endsWith(rotatedLayerId),
    );
    const invalidOverride = report.issues.find((entry) => entry.code === "invalid-local-override");
    expect(detached?.quickFix?.type).toBe("use-color-token");
    expect(outside?.quickFix?.type).toBe("fit-layer-to-page");
    expect(rotatedOutside?.quickFix).toBeUndefined();
    expect(invalidOverride?.quickFix?.type).toBe("remove-local-override");

    const projects = new MemoryProjects(snapshot);
    const quickFix = new ApplyAuditQuickFixUseCase(projects, new TestClock());
    if (!detached?.quickFix || !outside?.quickFix || !invalidOverride?.quickFix) return;
    await quickFix.execute(SYNTHETIC_PROJECT_ID, detached.quickFix);
    await quickFix.execute(SYNTHETIC_PROJECT_ID, outside.quickFix);
    await quickFix.execute(SYNTHETIC_PROJECT_ID, invalidOverride.quickFix);
    const fixed = await projects.get(SYNTHETIC_PROJECT_ID);
    const fixedLayer = fixed?.project.guide.pages[SYNTHETIC_PAGE_ID]?.extras.find(
      (item) => item.id === layerId,
    );
    expect(fixedLayer?.type).toBe("text");
    if (fixedLayer?.type !== "text") return;
    expect(fixedLayer.fill).toEqual({ colorTokenId: SYNTHETIC_COLOR_ID });
    expect(fixedLayer.transform.x).toBeGreaterThanOrEqual(0);
    expect(fixedLayer.transform.x + fixedLayer.transform.width).toBeLessThanOrEqual(1200);
    expect(
      fixed?.project.guide.pages[SYNTHETIC_PAGE_ID]?.localOverrides.some(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "targetId" in candidate &&
          candidate.targetId === "template:missing-slot",
      ),
    ).toBe(false);
  });
});
