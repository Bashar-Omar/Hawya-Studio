import * as z from "zod";

import { layerSchema } from "@/domain/guide/guide-document";

export const editorClipboardPayloadSchema = z
  .object({
    schema: z.literal("hawya.editor-clipboard.v1"),
    layers: z.array(layerSchema),
  })
  .strict();

export type EditorClipboardPayload = z.infer<typeof editorClipboardPayloadSchema>;

export function parseEditorClipboardJson(text: string): EditorClipboardPayload | undefined {
  try {
    const parsed = editorClipboardPayloadSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
