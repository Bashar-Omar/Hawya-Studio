import type { BinaryStore } from "@/application/ports/binary-store";
import type { ProjectRepository } from "@/application/ports/project-repository";
import { buildAuditReport } from "@/domain/audit/audit-engine";
import type {
  ExportFormat,
  ExportPreflightResult,
  FontInclusionPolicy,
} from "@/domain/export/export-contract";
import { runExportPreflight } from "@/domain/export/export-preflight";
import {
  projectSnapshotSchema,
  type ProjectId,
  type ProjectSnapshot,
} from "@/domain/project/hawya-project";

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return value;
}

export interface ExportWorkspace {
  snapshot: ProjectSnapshot;
  availableBinaryHashes: ReadonlySet<string>;
  preflight(format: ExportFormat, fontPolicy?: FontInclusionPolicy): ExportPreflightResult;
}

export class ExportWorkspaceQuery {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly binaries: BinaryStore,
  ) {}

  async execute(projectId: ProjectId): Promise<ExportWorkspace | undefined> {
    const source = await this.projects.get(projectId);
    if (!source) return undefined;

    const snapshot = deepFreeze(projectSnapshotSchema.parse(source));
    const availableBinaryHashes = new Set(await this.binaries.listContentHashes());
    const audit = buildAuditReport(snapshot, { has: (hash) => availableBinaryHashes.has(hash) });

    return {
      snapshot,
      availableBinaryHashes,
      preflight: (format, fontPolicy) =>
        runExportPreflight({
          snapshot,
          audit,
          availableBinaryHashes,
          format,
          ...(fontPolicy ? { fontPolicy } : {}),
        }),
    };
  }
}
