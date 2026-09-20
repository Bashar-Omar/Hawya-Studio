import type { GuidePage } from "@/domain/guide/guide-document";
import type { SemanticPageType } from "@/domain/guide/page-catalog";
import type { ProjectSnapshot } from "@/domain/project/hawya-project";
import { templateById } from "@/domain/templates/template-engine";
import { resolveContentBinding } from "@/domain/guide/guide-binding-resolver";

export type GuidePageStatus = "generated" | "needs-input" | "review";

function needsReview(snapshot: ProjectSnapshot, semanticType: SemanticPageType): boolean {
  if (semanticType === "color-print-values") {
    return snapshot.project.brand.colors.tokens.some(
      (token) =>
        Boolean(token.print?.suggestedCmyk) &&
        (!token.print?.verifiedCmyk || token.print.verifiedCmykNeedsReview === true),
    );
  }
  if (semanticType === "arabic-latin-pairing") {
    return snapshot.project.brand.typography.fonts.some((font) => {
      const arabic = font.coverage?.arabic as { ratio?: unknown } | undefined;
      return typeof arabic?.ratio === "number" && arabic.ratio < 0.9;
    });
  }
  return false;
}

export function guidePageStatus(snapshot: ProjectSnapshot, page: GuidePage): GuidePageStatus {
  const template = templateById(page.templateBinding.templateId);
  if (!template) return "needs-input";
  for (const slot of template.slots) {
    const binding = page.templateBinding.slotBindings[slot.id];
    if (!binding || (slot.required && !resolveContentBinding(snapshot, page, binding))) {
      return "needs-input";
    }
  }
  return needsReview(snapshot, page.semanticType as SemanticPageType) ? "review" : "generated";
}
