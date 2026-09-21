import type { BinaryStore } from "@/application/ports/binary-store";
import type { ColorEngine } from "@/application/ports/color-engine";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { buildAuditReport, type AuditReport } from "@/domain/audit/audit-engine";
import type { ContentHash } from "@/domain/assets/asset";
import type { ColorToken } from "@/domain/brand/brand-system";
import type { ProjectId, ProjectSnapshot } from "@/domain/project/hawya-project";
import { selectMeaningfulContrastPairs } from "@/domain/smart/contrast-matrix";

export interface ContrastAuditEntry {
  foregroundId: string;
  backgroundId: string;
  foregroundName: string;
  backgroundName: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  algorithm: "WCAG 2.1";
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
}

export interface FontAuditSummary {
  id: string;
  familyName: string;
  arabicRatio?: number;
  hasGsub?: boolean;
  hasGpos?: boolean;
}

export interface ProjectAuditView {
  snapshot: ProjectSnapshot;
  report: AuditReport;
  contrasts: ContrastAuditEntry[];
  fonts: FontAuditSummary[];
}

function tokenName(token: ColorToken): string {
  return token.name.en ?? token.name.ar ?? token.srgbHex;
}

export class ProjectAuditQuery {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
    private readonly colors: ColorEngine,
  ) {}

  async execute(projectId: ProjectId): Promise<ProjectAuditView | undefined> {
    const snapshot = await this.projects.get(projectId);
    if (!snapshot) return undefined;
    const hashes = new Set(await this.binaries.listContentHashes());
    const report = buildAuditReport(snapshot, { has: (hash) => hashes.has(hash as ContentHash) });
    const tokens = snapshot.project.brand.colors.tokens;
    const contrasts = await Promise.all(
      selectMeaningfulContrastPairs(tokens).map(async (pair) => {
        const foreground = tokens.find((token) => token.id === pair.foregroundId);
        const background = tokens.find((token) => token.id === pair.backgroundId);
        if (!foreground || !background) return undefined;
        const ratio = await this.colors.contrast(foreground.srgbHex, background.srgbHex);
        return {
          foregroundId: foreground.id,
          backgroundId: background.id,
          foregroundName: tokenName(foreground),
          backgroundName: tokenName(background),
          foregroundHex: foreground.srgbHex,
          backgroundHex: background.srgbHex,
          ratio,
          algorithm: "WCAG 2.1" as const,
          aaNormal: ratio >= 4.5,
          aaLarge: ratio >= 3,
          aaaNormal: ratio >= 7,
        };
      }),
    );
    const fonts = snapshot.project.brand.typography.fonts.map((font) => {
      const arabic = font.coverage?.arabic as
        | { ratio?: unknown; hasGsub?: unknown; hasGpos?: unknown }
        | undefined;
      return {
        id: font.id,
        familyName: font.familyName,
        ...(typeof arabic?.ratio === "number" ? { arabicRatio: arabic.ratio } : {}),
        ...(typeof arabic?.hasGsub === "boolean" ? { hasGsub: arabic.hasGsub } : {}),
        ...(typeof arabic?.hasGpos === "boolean" ? { hasGpos: arabic.hasGpos } : {}),
      };
    });
    return {
      snapshot,
      report,
      contrasts: contrasts.filter((entry): entry is ContrastAuditEntry => Boolean(entry)),
      fonts,
    };
  }
}
