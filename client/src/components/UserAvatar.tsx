import { useState } from "react";
import { User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { workspaceMonogram, workspaceTileStyle } from "@/lib/workspaceColor";

type UserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  /** Stable color seed for the monogram fallback (use the user id). Falls back to name. */
  seed?: string;
  /** Anonymous authors render a generic silhouette instead of a monogram. */
  anonymous?: boolean;
  /** Tailwind size utility, e.g. "size-9". */
  sizeClassName?: string;
  className?: string;
};

/**
 * Profile picture with a graceful fallback chain:
 *   anonymous → silhouette · custom/OAuth avatar → <img> · otherwise → colored name monogram.
 * Circular to read as a person (workspace logos use rounded squares).
 */
export function UserAvatar({
  name,
  avatarUrl,
  seed,
  anonymous = false,
  sizeClassName = "size-9",
  className,
}: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
    sizeClassName,
    className
  );

  if (anonymous) {
    return (
      <span className={cn(base, "bg-secondary text-muted-foreground")} aria-label="Anonymous" title="Anonymous">
        <UserIcon className="size-[55%]" strokeWidth={2} aria-hidden />
      </span>
    );
  }

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "User"}
        className={cn(base, "object-cover")}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(base, "font-display text-sm font-bold leading-none text-white")}
      style={workspaceTileStyle(seed ?? name ?? "?")}
      aria-label={name ?? "User"}
      title={name ?? undefined}
    >
      {workspaceMonogram(name ?? "?")}
    </span>
  );
}
