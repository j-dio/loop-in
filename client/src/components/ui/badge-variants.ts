import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      // Stark: amber is the only accent — everything else is ink/paper/gray.
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        brand: "border-brand/30 bg-brand-bright/15 text-brand",
        danger: "border-destructive/30 bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);
