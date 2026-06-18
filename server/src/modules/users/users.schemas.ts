import { z } from "zod";

export const AvatarPresignBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});

export const UpdateProfileSchema = z
  .object({
    // `null` clears a custom avatar (falls back to OAuth picture / monogram).
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    name: z.string().trim().min(1).max(255).optional(),
  })
  .refine((d) => d.avatarUrl !== undefined || d.name !== undefined, {
    message: "Provide at least one field to update",
  });
