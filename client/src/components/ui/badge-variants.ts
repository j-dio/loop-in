import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        brand: "border-brand/30 bg-brand-bright/15 text-brand",
        terra: "border-terra/30 bg-terra/12 text-terra",
        info: "border-slate-brand/25 bg-slate-brand/10 text-slate-brand",
        success: "border-chart-4/35 bg-chart-4/15 text-chart-4",
        danger: "border-destructive/30 bg-destructive/12 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);
