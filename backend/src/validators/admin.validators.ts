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
});

export type EnqueueUrlInput = z.infer<typeof enqueueUrlSchema>;
