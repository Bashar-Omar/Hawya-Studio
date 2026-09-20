import * as z from "zod";

import type { GuidePage } from "@/domain/guide/guide-document";
import type { LayerTransform, SceneLayerId } from "@/editor/model/editor-types";

const transformOverrideSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  rotation: z.number(),
  scaleX: z.number(),
  scaleY: z.number(),
});

export const editorLocalOverrideSchema = z.object({
  targetId: z.string().min(1),
  transform: transformOverrideSchema.optional(),
  visible: z.boolean().optional(),
  locked: z.boolean().optional(),
  text: z.string().optional(),
});
export type EditorLocalOverride = z.infer<typeof editorLocalOverrideSchema>;

export function readEditorOverrides(page: GuidePage): EditorLocalOverride[] {
  return page.localOverrides.flatMap((candidate) => {
    const parsed = editorLocalOverrideSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

export function findEditorOverride(
  page: GuidePage,
  targetId: SceneLayerId,
): EditorLocalOverride | undefined {
  return readEditorOverrides(page).find((override) => override.targetId === targetId);
}

export function upsertEditorOverride(
  page: GuidePage,
  targetId: SceneLayerId,
  patch: Partial<Omit<EditorLocalOverride, "targetId">>,
): void {
  const index = page.localOverrides.findIndex((candidate) => {
    const parsed = editorLocalOverrideSchema.safeParse(candidate);
    return parsed.success && parsed.data.targetId === targetId;
  });
  const existing =
    index >= 0 ? editorLocalOverrideSchema.safeParse(page.localOverrides[index]) : undefined;
  const value: EditorLocalOverride = {
    targetId,
    ...(existing?.success ? existing.data : {}),
    ...patch,
  };
  if (index >= 0) page.localOverrides[index] = value;
  else page.localOverrides.push(value);
}

export function templateSceneLayerId(slotId: string): SceneLayerId {
  return `template:${slotId}`;
}

export function templateSlotIdFromSceneId(sceneId: SceneLayerId): string | undefined {
  return sceneId.startsWith("template:") ? sceneId.slice("template:".length) : undefined;
}
