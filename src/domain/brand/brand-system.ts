import * as z from "zod";

import {
  directionSchema,
  localizedRichTextSchema,
  localizedStringSchema,
  uuidSchema,
} from "@/domain/common/primitives";
import { assetIdSchema } from "@/domain/assets/asset";

const idNamedLocalizedSchema = z.object({
  id: uuidSchema,
  name: localizedStringSchema,
  description: localizedStringSchema.optional(),
});

export const brandIdentitySchema = z.object({
  brandName: localizedStringSchema,
  descriptor: localizedStringSchema.optional(),
  story: localizedRichTextSchema.optional(),
  mission: localizedStringSchema.optional(),
  vision: localizedStringSchema.optional(),
  values: z.array(idNamedLocalizedSchema),
  personality: z.array(
    z.object({
      id: uuidSchema,
      label: localizedStringSchema,
      description: localizedStringSchema.optional(),
    }),
  ),
  voice: z
    .object({
      summary: localizedStringSchema.optional(),
      traits: z.array(
        z.object({
          id: uuidSchema,
          do: localizedStringSchema,
          dont: localizedStringSchema.optional(),
        }),
      ),
    })
    .optional(),
  audiences: z.array(idNamedLocalizedSchema).optional(),
});
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;

const analysisSourceSchema = z.enum(["measured", "suggested", "user"]);
const ruleDataSchema = z.record(z.string(), z.unknown());

export const logoVariantSchema = z.object({
  id: uuidSchema,
  name: localizedStringSchema,
  role: z.enum([
    "primary",
    "secondary",
    "logomark",
    "wordmark",
    "monochrome",
    "reversed",
    "custom",
  ]),
  assetId: assetIdSchema,
  preferredBackground: uuidSchema.optional(),
  usage: localizedStringSchema.optional(),
  geometry: z
    .object({
      source: analysisSourceSchema,
      data: ruleDataSchema,
    })
    .optional(),
});
export type LogoVariant = z.infer<typeof logoVariantSchema>;

const professionalRuleSchema = z.object({
  source: analysisSourceSchema,
  data: ruleDataSchema,
});

export const logoSystemSchema = z.object({
  variants: z.array(logoVariantSchema),
  primaryLogoId: uuidSchema.optional(),
  rules: z.object({
    clearSpace: professionalRuleSchema.optional(),
    minimumSize: professionalRuleSchema.optional(),
    allowedBackgrounds: z.array(professionalRuleSchema).optional(),
    incorrectUsage: z.array(professionalRuleSchema),
  }),
});
export type LogoSystem = z.infer<typeof logoSystemSchema>;

export const colorTokenSchema = z.object({
  id: uuidSchema,
  name: localizedStringSchema,
  role: z.enum(["primary", "secondary", "accent", "neutral", "supporting", "semantic", "custom"]),
  srgbHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  alpha: z.number().min(0).max(1),
  oklch: z
    .object({
      l: z.number(),
      c: z.number(),
      h: z.number(),
    })
    .optional(),
  rgb: z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255),
  }),
  hsl: z
    .object({
      h: z.number(),
      s: z.number(),
      l: z.number(),
    })
    .optional(),
  print: z
    .object({
      suggestedCmyk: z
        .object({ c: z.number(), m: z.number(), y: z.number(), k: z.number() })
        .optional(),
      verifiedCmyk: z
        .object({ c: z.number(), m: z.number(), y: z.number(), k: z.number() })
        .optional(),
      verifiedCmykNeedsReview: z.boolean().optional(),
      pantoneName: z.string().optional(),
      note: localizedStringSchema.optional(),
    })
    .optional(),
  usage: localizedStringSchema.optional(),
});
export type ColorToken = z.infer<typeof colorTokenSchema>;

export const colorSystemSchema = z.object({
  tokens: z.array(colorTokenSchema),
});
export type ColorSystem = z.infer<typeof colorSystemSchema>;

export const fontAssetRefSchema = z.object({
  id: uuidSchema,
  assetId: assetIdSchema,
  familyName: z.string().min(1),
  subfamilyName: z.string().optional(),
  postscriptName: z.string().optional(),
  weight: z.number().int().min(1).max(1000).optional(),
  style: z.enum(["normal", "italic", "oblique"]).optional(),
  variableAxes: z
    .array(
      z.object({
        tag: z.string().length(4),
        min: z.number(),
        default: z.number(),
        max: z.number(),
      }),
    )
    .optional(),
  coverage: z.record(z.string(), z.unknown()).optional(),
  licenseNote: z.string().optional(),
});
export type FontAssetRef = z.infer<typeof fontAssetRefSchema>;

export const textStyleTokenSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  role: z.enum(["display", "h1", "h2", "h3", "body", "body-small", "caption", "button", "custom"]),
  fontRefId: uuidSchema,
  fontSize: z.number().positive(),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
  fontWeight: z.number().int().min(1).max(1000).optional(),
  direction: z.union([z.literal("auto"), directionSchema]),
  language: z.string().optional(),
  colorTokenId: uuidSchema.optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});
export type TextStyleToken = z.infer<typeof textStyleTokenSchema>;

export const typographySystemSchema = z.object({
  fonts: z.array(fontAssetRefSchema),
  styles: z.array(textStyleTokenSchema),
});
export type TypographySystem = z.infer<typeof typographySystemSchema>;

const extensibleSystemSchema = z.record(z.string(), z.unknown());

export const brandSystemSchema = z.object({
  identity: brandIdentitySchema,
  logos: logoSystemSchema,
  colors: colorSystemSchema,
  typography: typographySystemSchema,
  visualLanguage: extensibleSystemSchema,
  digital: extensibleSystemSchema.optional(),
  notes: localizedStringSchema.optional(),
});
export type BrandSystem = z.infer<typeof brandSystemSchema>;
