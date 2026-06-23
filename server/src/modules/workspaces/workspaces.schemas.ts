import { z } from "zod";
import { isReservedSlug } from "./reservedSlugs";

export const WorkspaceVisibilitySchema = z.enum(["public", "invite_only"]);

export const AppPlatformSchema = z.enum(["web", "mobile", "desktop", "other"]);
export const LinkKindSchema = z.enum(["github", "appstore", "playstore", "x", "other"]);
const HttpUrlSchema = z.string().trim().url().max(2048).startsWith("http");

export const WorkspaceSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, '-')");

const CreateSlugSchema = WorkspaceSlugSchema.refine(
  (s) => !isReservedSlug(s),
  "that URL is reserved — pick another"
);

export const HexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be a hex color like #0F172A");

export const CreateWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(255),
  slug: CreateSlugSchema,
  tagline: z.string().trim().min(1).max(140),
  platform: AppPlatformSchema,
  category: z.string().trim().min(1).max(50),
  primaryColor: HexColorSchema.optional(),
  visibility: WorkspaceVisibilitySchema.optional(),
  require_approval: z.boolean().optional(),
});

export const PatchWorkspaceParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

export const PatchWorkspaceBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    primaryColor: HexColorSchema.optional(),
    visibility: WorkspaceVisibilitySchema.optional(),
    require_approval: z.boolean().optional(),
    // profile fields (owner-only). `null` clears the field.
    tagline: z.string().trim().max(140).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    platform: AppPlatformSchema.nullable().optional(),
    category: z.string().trim().max(50).nullable().optional(),
    website_url: HttpUrlSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "at least one field must be provided");

export const LogoPresignBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});

export const UpdateLogoBodySchema = z.object({
  // `null` clears the logo (falls back to the monogram tile).
  logo_url: z.string().url().max(2048).nullable(),
});

export const WorkspaceMembersParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
});

// Invites mint collaborators (admins) by default. `member` is for non-staff
// participants on invite_only boards (owner role cannot be granted via invite).
export const InviteMemberBodySchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "member"]).optional().default("admin"),
});

export const RemoveMemberParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  userId: z.string().uuid(),
});

export const ScreenshotPresignBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
});

export const AddScreenshotBodySchema = z.object({
  url: z.string().trim().url().max(2048),
});

export const ReorderScreenshotsBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5),
});

export const AddLinkBodySchema = z.object({
  kind: LinkKindSchema,
  url: HttpUrlSchema,
});

export const ScreenshotIdParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  id: z.string().uuid(),
});

export const LinkIdParamsSchema = z.object({
  slug: WorkspaceSlugSchema,
  id: z.string().uuid(),
});

