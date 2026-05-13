import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.email("Invalid email address").max(255).toLowerCase().trim(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
