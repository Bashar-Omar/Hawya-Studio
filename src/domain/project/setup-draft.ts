import * as z from "zod";

import { isoDateTimeSchema } from "@/domain/common/primitives";
import { projectIdSchema } from "@/domain/project/hawya-project";

export const setupStepSchema = z.enum([
  "basic",
  "logo",
  "colors",
  "typography",
  "foundation",
  "guide",
]);
export type SetupStep = z.infer<typeof setupStepSchema>;

export const setupStepStatusSchema = z.enum(["pending", "completed", "skipped"]);
export type SetupStepStatus = z.infer<typeof setupStepStatusSchema>;

export const SETUP_STEPS: readonly SetupStep[] = [
  "basic",
  "logo",
  "colors",
  "typography",
  "foundation",
  "guide",
];

export const projectSetupDraftSchema = z.object({
  projectId: projectIdSchema,
  currentStep: setupStepSchema,
  steps: z.object({
    basic: setupStepStatusSchema,
    logo: setupStepStatusSchema,
    colors: setupStepStatusSchema,
    typography: setupStepStatusSchema,
    foundation: setupStepStatusSchema,
    guide: setupStepStatusSchema,
  }),
  updatedAt: isoDateTimeSchema,
});
export type ProjectSetupDraft = z.infer<typeof projectSetupDraftSchema>;

export function createProjectSetupDraft(
  projectId: ProjectSetupDraft["projectId"],
  updatedAt: ProjectSetupDraft["updatedAt"],
): ProjectSetupDraft {
  return projectSetupDraftSchema.parse({
    projectId,
    currentStep: "logo",
    steps: {
      basic: "completed",
      logo: "pending",
      colors: "pending",
      typography: "pending",
      foundation: "pending",
      guide: "pending",
    },
    updatedAt,
  });
}

export function nextSetupStep(step: SetupStep): SetupStep | undefined {
  const index = SETUP_STEPS.indexOf(step);
  return SETUP_STEPS[index + 1];
}
