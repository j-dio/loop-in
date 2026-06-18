import { useState } from "react";
import { cn } from "@/lib/utils";
import { workspaceMonogram, workspaceTileStyle } from "@/lib/workspaceColor";

type WorkspaceTileProps = {
  name: string;
  /** Stable color seed for the monogram fallback (use the slug). Falls back to name. */
  seed?: string;
  logoUrl?: string | null;
  /** Tailwind size utility, e.g. "size-11". */
  sizeClassName?: string;
  /** Monogram text size; tune down for small tiles. */
  monogramClassName?: string;
  className?: string;
};

/**
 * Workspace identity mark: uploaded logo when present, otherwise a deterministic
 * colored monogram. Rounded square to read as an org (people use circles).
 */
export function WorkspaceTile({
  name,
  seed,
  logoUrl,
  sizeClassName = "size-11",
  monogramClassName = "text-lg",
  className,
}: WorkspaceTileProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const base = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl select-none",
    sizeClassName,
    className
  );

  if (logoUrl && !imgFailed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className={cn(base, "object-cover")}
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(base, "font-display font-bold leading-none text-white", monogramClassName)}
      style={workspaceTileStyle(seed ?? name)}
      aria-hidden
    >
      {workspaceMonogram(name)}
    </span>
  );
}
