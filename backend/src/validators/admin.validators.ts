import { z } from "zod";

export const enqueueUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "URL is required.")
    .max(2048, "URL is too long.")
    .refine(
      (value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Enter a valid http or https URL." },
    ),
  suggestedName: z
    .string()
    .trim()
    .max(256, "Suggested name is too long.")
    .optional(),
});

export type EnqueueUrlInput = z.infer<typeof enqueueUrlSchema>;

export const setLlmModelSchema = z.object({
  modelId: z.string().trim().min(1, "Model is required.").max(256),
});

export type SetLlmModelInput = z.infer<typeof setLlmModelSchema>;

export const ingestLinkIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type IngestLinkIdParams = z.infer<typeof ingestLinkIdSchema>;

export const updateIngestLinkSchema = enqueueUrlSchema;

export type UpdateIngestLinkInput = z.infer<typeof updateIngestLinkSchema>;

export const startDiscoverySchema = z.object({
  ingestLinkIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Select at least one feed to run.")
    .optional(),
  ingestLinkItemIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Select at least one extracted URL to run.")
    .optional(),
}).refine((value) => {
  return (
    (value.ingestLinkIds?.length ?? 0) > 0 ||
    (value.ingestLinkItemIds?.length ?? 0) > 0
  );
}, {
  message: "Select at least one feed or extracted URL to run.",
});

export type StartDiscoveryInput = z.infer<typeof startDiscoverySchema>;
