import type { PostDTO } from "@/lib/postTypes";
import { badgeVariants } from "@/components/ui/badge-variants";
import type { VariantProps } from "class-variance-authority";

type Tone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function categoryLabel(c: PostDTO["category"]): string {
  if (c === "bug") return "Bug";
  if (c === "feature_request") return "Feature";
  if (c === "ui_tweak") return "UI";
  return "";
}

export function categoryTone(c: PostDTO["category"]): Tone {
  // Stark: categories are monochrome mono tags — bugs keep a functional red.
  if (c === "bug") return "danger";
  return "outline";
}

export function moderationLabel(s: PostDTO["moderationStatus"]): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export function moderationTone(s: PostDTO["moderationStatus"]): Tone {
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
  // Shipped is the win — it gets the amber signal. Everything else is monochrome.
  if (s === "shipped") return "brand";
  if (s === "inbox") return "neutral";
  return "outline";
}
