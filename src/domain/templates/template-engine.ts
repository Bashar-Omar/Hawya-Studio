import type { ContentBinding } from "@/domain/guide/guide-document";
import type { SemanticPageType } from "@/domain/guide/page-catalog";
import { BUILTIN_TEMPLATES } from "@/domain/templates/builtin-template-catalog";
import type {
  PageTemplate,
  TemplateFamilyId,
  TemplateLocaleMode,
} from "@/domain/templates/template-definition";

const BINDING_BY_ROLE: Readonly<Record<string, ContentBinding>> = {
  "page.title": "page.content.title",
  "page.introduction": "page.content.introduction",
  "brand.name": "brand.identity.brandName",
  "brand.descriptor": "brand.identity.descriptor",
  "brand.story": "brand.identity.story",
  "brand.values": "brand.identity.values[]",
  "brand.logo.primary": "brand.logo.primary",
  "brand.logo.variants": "brand.logo.variants[]",
  "brand.logo.clear-space": "brand.logo.clearSpace",
  "brand.logo.minimum-size": "brand.logo.minimumSize",
  "brand.logo.incorrect-usage": "brand.logo.incorrectUsage[]",
  "brand.colors.palette": "brand.colors.tokens[]",
  "brand.typography.fonts": "brand.typography.fonts[]",
  "brand.typography.styles": "brand.typography.styles[]",
  "project.assets": "project.assets[]",
  "delivery.checklist": "delivery.checklist",
  "delivery.summary": "delivery.summary",
};

export interface BoundTemplate {
  template: PageTemplate;
  slotBindings: Record<string, ContentBinding>;
}

export function compatibleTemplates(
  semanticType: SemanticPageType,
  localeMode: TemplateLocaleMode,
): PageTemplate[] {
  return BUILTIN_TEMPLATES.filter(
    (template) =>
      template.supportedPageTypes.includes(semanticType) &&
      template.supportedLocaleModes.includes(localeMode),
  );
}

export function templateById(templateId: string): PageTemplate | undefined {
  return BUILTIN_TEMPLATES.find((template) => template.id === templateId);
}

export function bindTemplate(template: PageTemplate): BoundTemplate {
  const slotBindings: Record<string, ContentBinding> = {};
  for (const slot of template.slots) {
    const binding = BINDING_BY_ROLE[slot.role];
    if (!binding) throw new Error(`No binding recipe exists for template slot role ${slot.role}`);
    slotBindings[slot.id] = binding;
  }
  return { template, slotBindings };
}

export function resolveDefaultTemplate(
  semanticType: SemanticPageType,
  familyId: TemplateFamilyId,
  localeMode: TemplateLocaleMode,
): BoundTemplate {
  const candidates = compatibleTemplates(semanticType, localeMode);
  const template = candidates.find((candidate) => candidate.familyId === familyId) ?? candidates[0];
  if (!template) {
    throw new Error(`No compatible template for ${semanticType} in ${localeMode}`);
  }
  return bindTemplate(template);
}

export function resolveTemplateSwitch(
  semanticType: SemanticPageType,
  localeMode: TemplateLocaleMode,
  templateId: string,
): BoundTemplate {
  const template = templateById(templateId);
  if (!template) throw new Error("Template does not exist");
  if (!template.supportedPageTypes.includes(semanticType)) {
    throw new Error("Template is not compatible with this semantic page type");
  }
  if (!template.supportedLocaleModes.includes(localeMode)) {
    throw new Error("Template is not compatible with this document locale mode");
  }
  return bindTemplate(template);
}
