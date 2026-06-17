import { useId } from "react";
import { cn } from "@/lib/utils";

type MarkProps = {
  className?: string;
  /** Override stroke. When omitted, the mark uses the gold→blue brand gradient. */
  stroke?: string;
  title?: string;
};

/**
 * The Loop In mark: two interlocking loops — connection + a feedback loop that
 * never breaks. Drawn with round strokes so it animates cleanly (the hero draws
 * it on with stroke-dashoffset). By default the loops are stroked with the brand
 * gradient — gold flowing into a slate-blue accent (theme-aware via the
 * `--logo-grad-*` tokens). Pass `stroke` to force a solid color.
 */
export function LoopMark({ className, stroke, title }: MarkProps) {
  const rawId = useId();
  const gradId = `loopgrad-${rawId.replace(/:/g, "")}`;
  const strokeValue = stroke ?? `url(#${gradId})`;
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      {!stroke ? (
        <defs>
          <linearGradient
            id={gradId}
            x1="14"
            y1="20"
            x2="50"
            y2="46"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--logo-grad-from)" />
            <stop offset="55%" stopColor="var(--logo-grad-mid)" />
            <stop offset="100%" stopColor="var(--logo-grad-to)" />
          </linearGradient>
        </defs>
      ) : null}
      <g stroke={strokeValue} strokeWidth={6} strokeLinecap="round">
        <circle cx="25.5" cy="32" r="12" />
        <circle cx="38.5" cy="32" r="12" />
      </g>
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** Hide the "Loop In" wordmark and show just the mark. */
  markOnly?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { mark: "size-6", text: "text-base" },
  md: { mark: "size-7", text: "text-lg" },
  lg: { mark: "size-9", text: "text-xl" },
} as const;

export function Logo({ className, markOnly = false, size = "md" }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LoopMark className={s.mark} title="Loop In" />
      {!markOnly ? (
        <span className={cn("font-sans font-semibold tracking-tight text-foreground", s.text)}>
          Loop<span className="text-brand">In</span>
        </span>
      ) : null}
    </span>
  );
}
