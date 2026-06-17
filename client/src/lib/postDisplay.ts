import type { PostDTO } from "@/lib/postTypes";
import { badgeVariants } from "@/components/ui/badge-variants";
import type { VariantProps } from "class-variance-authority";

type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function categoryLabel(c: PostDTO["category"]): string {
  if (c === "bug") return "Bug";
  if (c === "feature_request") return "Feature";
  return "UI";
}

export function categoryTone(c: PostDTO["category"]): Tone {
  if (c === "bug") return "danger";
  if (c === "feature_request") return "info";
  return "terra";
}

export function moderationLabel(s: PostDTO["moderationStatus"]): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function moderationTone(s: PostDTO["moderationStatus"]): Tone {
  if (s === "approved") return "success";
  if (s === "pending") return "brand";
  if (s === "spam") return "danger";
  return "neutral";
}

const BOARD_LABELS: Record<PostDTO["boardStatus"], string> = {
  inbox: "Inbox",
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
};

export function boardLabel(s: PostDTO["boardStatus"]): string {
  return BOARD_LABELS[s];
}

export function boardTone(s: PostDTO["boardStatus"]): Tone {
  if (s === "shipped") return "success";
  if (s === "in_progress") return "terra";
  if (s === "planned") return "brand";
  if (s === "under_review") return "info";
  return "neutral";
}
