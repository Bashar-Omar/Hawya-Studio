import * as z from "zod";

import { contentHashSchema } from "@/domain/assets/asset";
import { isoDateTimeSchema, uuidSchema } from "@/domain/common/primitives";
import { projectIdSchema, projectSnapshotSchema } from "@/domain/project/hawya-project";

export const snapshotKindSchema = z.enum(["autosave", "recovery", "named"]);
export type SnapshotKind = z.infer<typeof snapshotKindSchema>;

export const storedProjectSnapshotSchema = z.object({
  projectId: projectIdSchema,
  createdAt: isoDateTimeSchema,
  kind: snapshotKindSchema,
  named: z.boolean(),
  name: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  revisionId: uuidSchema.optional(),
  projectSnapshot: projectSnapshotSchema,
  binaryHashes: z.array(contentHashSchema),
});
export type StoredProjectSnapshot = z.infer<typeof storedProjectSnapshotSchema>;

export const DEFAULT_SNAPSHOT_RETENTION_POLICY = Object.freeze({
  autosave: 15,
  recovery: 5,
});
