import type { BinaryStore } from "@/application/ports/binary-store";
import type { Clock } from "@/application/ports/clock";
import type { LogoAnalyzer } from "@/application/ports/logo-analyzer";
import type { ProjectRepository } from "@/application/ports/project-repository";
import {
  type ClearSpaceRuleInput,
  INCORRECT_USAGE_CATALOG,
  type IncorrectUsageKind,
  type LogoGeometryInsight,
  logoGeometryInsightSchema,
  type MinimumSizeRuleInput,
} from "@/domain/smart/logo-analysis";
import {
  type ProjectId,
  type ProjectSnapshot,
  projectSnapshotSchema,
} from "@/domain/project/hawya-project";

function finitePositive(value: number | undefined, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be greater than zero`);
  return value;
}

export class ManageLogoSmartRulesUseCase {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly analyzer: LogoAnalyzer,
    private readonly clock: Clock,
  ) {}

  async analyze(projectId: ProjectId, variantId: string): Promise<LogoGeometryInsight> {
    const snapshot = await this.requireProject(projectId);
    const variant = snapshot.project.brand.logos.variants.find((item) => item.id === variantId);
    if (!variant) throw new Error("Logo variant does not exist");
    const asset = snapshot.assets.find((item) => item.id === variant.assetId);
    if (!asset) throw new Error("Logo asset does not exist in this project");
    if (asset.mime === "image/svg+xml" && asset.security.sanitized !== true) {
      throw new Error("Logo SVG must be sanitized before analysis");
    }
    const binary = await this.binaries.get(asset.binaryKey);
    if (!binary) throw new Error("Logo binary is missing from local storage");
    const insight = logoGeometryInsightSchema.parse(
      await this.analyzer.analyze(binary.bytes, asset.mime),
    );
    const variants = snapshot.project.brand.logos.variants.map((item) =>
      item.id === variantId
        ? { ...item, geometry: { source: "measured" as const, data: insight } }
        : item,
    );
    await this.save(snapshot, { ...snapshot.project.brand.logos, variants });
    return insight;
  }

  async confirmClearSpace(
    projectId: ProjectId,
    variantId: string,
    input: ClearSpaceRuleInput,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    const variant = this.requireVariant(snapshot, variantId);
    if (!Number.isFinite(input.value) || input.value <= 0) {
      throw new Error("Clear-space value must be greater than zero");
    }
    if (input.reference !== "manual") {
      if (input.unit !== "ratio") {
        throw new Error("Geometry-relative clear-space rules must use a ratio");
      }
      const measured = logoGeometryInsightSchema.safeParse(variant.geometry?.data);
      if (!measured.success) {
        throw new Error("Analyze the logo before confirming a geometry-relative clear-space rule");
      }
    }
    const clearSpace = {
      source: "user" as const,
      data: {
        variantId,
        reference: input.reference,
        value: input.value,
        unit: input.unit,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        confirmedAt: this.clock.now(),
      },
    };
    return this.save(snapshot, {
      ...snapshot.project.brand.logos,
      rules: { ...snapshot.project.brand.logos.rules, clearSpace },
    });
  }

  async confirmMinimumSize(
    projectId: ProjectId,
    variantId: string,
    input: MinimumSizeRuleInput,
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireVariant(snapshot, variantId);
    const screenPx = finitePositive(input.screenPx, "Screen minimum size");
    const printMm = finitePositive(input.printMm, "Print minimum size");
    if (screenPx === undefined && printMm === undefined) {
      throw new Error("Provide at least one minimum size before confirming the rule");
    }
    const minimumSize = {
      source: "user" as const,
      data: {
        variantId,
        ...(screenPx !== undefined ? { screenPx } : {}),
        ...(printMm !== undefined ? { printMm } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        confirmedAt: this.clock.now(),
      },
    };
    return this.save(snapshot, {
      ...snapshot.project.brand.logos,
      rules: { ...snapshot.project.brand.logos.rules, minimumSize },
    });
  }

  async confirmIncorrectUsage(
    projectId: ProjectId,
    variantId: string,
    kinds: readonly IncorrectUsageKind[],
  ): Promise<ProjectSnapshot> {
    const snapshot = await this.requireProject(projectId);
    this.requireVariant(snapshot, variantId);
    const allowed = new Set<IncorrectUsageKind>(INCORRECT_USAGE_CATALOG);
    const unique = [...new Set(kinds)];
    if (unique.some((kind) => !allowed.has(kind)))
      throw new Error("Unsupported incorrect-use rule");
    const incorrectUsage = unique.map((kind) => ({
      source: "user" as const,
      data: { variantId, kind, confirmedAt: this.clock.now() },
    }));
    return this.save(snapshot, {
      ...snapshot.project.brand.logos,
      rules: { ...snapshot.project.brand.logos.rules, incorrectUsage },
    });
  }

  private async requireProject(projectId: ProjectId): Promise<ProjectSnapshot> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) throw new Error(`Project ${projectId} does not exist`);
    return snapshot;
  }

  private requireVariant(
    snapshot: ProjectSnapshot,
    variantId: string,
  ): ProjectSnapshot["project"]["brand"]["logos"]["variants"][number] {
    const variant = snapshot.project.brand.logos.variants.find((item) => item.id === variantId);
    if (!variant) throw new Error("Logo variant does not exist");
    return variant;
  }

  private async save(
    snapshot: ProjectSnapshot,
    logos: ProjectSnapshot["project"]["brand"]["logos"],
  ): Promise<ProjectSnapshot> {
    const next = projectSnapshotSchema.parse({
      ...snapshot,
      project: {
        ...snapshot.project,
        metadata: { ...snapshot.project.metadata, updatedAt: this.clock.now() },
        brand: { ...snapshot.project.brand, logos },
      },
    });
    await this.projects.save(next);
    return next;
  }
}
