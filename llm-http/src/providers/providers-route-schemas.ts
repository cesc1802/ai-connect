import { z } from "zod";
import { PROVIDER_KINDS } from "../admin/org/provider-kind.js";

const providerKindSchema = z.enum(PROVIDER_KINDS);
const scopeSchema = z.enum(["org", "select"]);
const defaultModelSchema = z.string().trim().min(1).max(200);
const baseUrlSchema = z.string().trim().url("baseUrl must be a valid URL").max(2048);

export const createProviderBody = z
  .object({
    displayName: z.string().trim().min(1, "displayName is required").max(80),
    providerKind: providerKindSchema,
    apiKey: z.string().min(8, "apiKey must be at least 8 characters").optional(),
    baseUrl: baseUrlSchema.optional(),
    defaultModel: defaultModelSchema.optional(),
    scope: scopeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    // ollama is key-less and self-hosted: baseUrl is its only address.
    if (v.providerKind === "ollama") {
      if (!v.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "baseUrl is required for ollama providers",
        });
      }
    } else if (!v.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "apiKey is required",
      });
    }
  });

export const updateProviderBody = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    isEnabled: z.boolean().optional(),
    baseUrl: baseUrlSchema.optional(),
    defaultModel: defaultModelSchema.optional(),
    scope: scopeSchema.optional(),
  })
  .refine(
    (v) => Object.values(v).some((field) => field !== undefined),
    { message: "No updatable fields supplied" },
  );

export const rotateKeyBody = z.object({
  apiKey: z.string().min(8, "apiKey must be at least 8 characters"),
});

// Check either a stored provider (providerId, with optional overrides) or an
// ad-hoc target before it is saved (providerKind + credentials).
export const checkProviderBody = z
  .object({
    providerId: z.string().uuid().optional(),
    providerKind: providerKindSchema.optional(),
    baseUrl: baseUrlSchema.optional(),
    apiKey: z.string().min(1).optional(),
  })
  .refine((v) => v.providerId !== undefined || v.providerKind !== undefined, {
    message: "Either providerId or providerKind is required",
  });

export type CreateProviderBody = z.infer<typeof createProviderBody>;
export type UpdateProviderBody = z.infer<typeof updateProviderBody>;
export type CheckProviderBody = z.infer<typeof checkProviderBody>;
