import { z } from "zod";

export const WorkspaceVisibilitySchema = z.enum(["public", "invite_only"]);

export const WorkspaceSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, '-')");

export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be a hex color like #0F172A");

export const CreateWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: WorkspaceSlugSchema,
  primaryColor: HexColorSchema.optional(),
  visibility: WorkspaceVisibilitySchema.optional(),
});

export const PatchWorkspaceParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const PatchWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    primaryColor: HexColorSchema.optional(),
    visibility: WorkspaceVisibilitySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "at least one field must be provided");

export const WorkspaceMembersParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const InviteMemberBodySchema = z.object({
  email: z.string().trim().email().max(255),
});

export const RemoveMemberParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  userId: z.string().uuid(),
});

