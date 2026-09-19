import * as z from "zod";

export const templatePackRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
export type TemplatePackRef = z.infer<typeof templatePackRefSchema>;
