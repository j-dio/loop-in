import type { WorkspaceProfileDTO } from "./profileTypes";

type FlagKind = "share" | "dismiss";

const STORAGE_PREFIX = "loopin-setup";

function flagKey(kind: FlagKind, slug: string): string {
  return `${STORAGE_PREFIX}-${kind}-${slug}`;
}

/** Read a UI flag. Safe in any environment — returns false if storage is unavailable. */
export function getFlag(kind: FlagKind, slug: string): boolean {
  try {
    return localStorage.getItem(flagKey(kind, slug)) === "1";
  } catch {
    return false;
  }
}

/** Persist a UI flag. Silent no-op if storage is unavailable. */
export function setFlag(kind: FlagKind, slug: string): void {
  try {
    localStorage.setItem(flagKey(kind, slug), "1");
  } catch {
    /* storage unavailable (private mode / disabled) — no-op */
  }
}

export type SetupStepId = "tagline" | "website" | "screenshots" | "logo" | "share";

export interface SetupStep {
  id: SetupStepId;
  label: string;
  done: boolean;
  optional: boolean;
  href?: string;
  action?: "share";
}

export interface SetupState {
  steps: SetupStep[];
  requiredDone: number;
  requiredTotal: number;
  allRequiredDone: boolean;
  showCard: boolean;
}

export function computeSetup(
  profile: WorkspaceProfileDTO,
  slug: string,
  canManage: boolean,
): SetupState {
  const { workspace: w, screenshots, links } = profile;
  const adminProfile = `/${slug}/admin?section=profile`;
  const adminSettings = `/${slug}/admin?section=settings`;

  const steps: SetupStep[] = [
    {
      id: "tagline",
      label: "Add a tagline",
      done: !!w.tagline && w.tagline.trim().length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "website",
      label: "Add your website & links",
      done: !!w.websiteUrl || links.length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "screenshots",
      label: "Upload screenshots",
      done: screenshots.length > 0,
      optional: false,
      href: adminProfile,
    },
    {
      id: "logo",
      label: "Add a logo",
      done: !!w.logoUrl,
      optional: true,
      href: adminSettings,
    },
    {
      id: "share",
      label: "Share your board",
      done: getFlag("share", slug),
      optional: false,
      action: "share",
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  const requiredTotal = required.length;
  const allRequiredDone = requiredDone === requiredTotal;
  const showCard = canManage && !getFlag("dismiss", slug) && !allRequiredDone;

  return { steps, requiredDone, requiredTotal, allRequiredDone, showCard };
}
