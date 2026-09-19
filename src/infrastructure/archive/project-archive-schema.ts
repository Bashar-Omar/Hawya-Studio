import * as z from "zod";

import { isoDateTimeSchema, uuidSchema } from "@/domain/common/primitives";

export const hawyaArchiveManifestSchema = z.object({
  format: z.literal("hawya-project"),
  formatVersion: z.number().int().positive(),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  minReaderVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  projectId: uuidSchema,
  projectName: z.string().min(1),
  createdAt: isoDateTimeSchema,
  exportedAt: isoDateTimeSchema,
  hashAlgorithm: z.literal("SHA-256"),
  entry: z.literal("project.json"),
});
export type HawyaArchiveManifest = z.infer<typeof hawyaArchiveManifestSchema>;

export const archiveChecksumsSchema = z.object({
  algorithm: z.literal("SHA-256"),
  entries: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
});
export type ArchiveChecksums = z.infer<typeof archiveChecksumsSchema>;
