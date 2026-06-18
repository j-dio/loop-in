export type AppPlatform = "web" | "mobile" | "desktop" | "other";
export type LinkKind = "github" | "appstore" | "playstore" | "x" | "other";

export type ScreenshotDTO = { id: string; url: string; sortOrder: number };
export type LinkDTO = { id: string; kind: LinkKind; url: string };

export type WorkspaceProfileDTO = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    tagline: string | null;
    description: string | null;
    platform: AppPlatform | null;
    category: string | null;
    websiteUrl: string | null;
    visibility: "public" | "invite_only";
    createdAt: string;
  };
  screenshots: ScreenshotDTO[];
  links: LinkDTO[];
};
