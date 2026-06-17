import { cn } from "@/lib/utils";

type Props = {
  options: readonly (readonly [value: string, label: string])[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
};

/** Amber-active segmented control. Board sort + Admin tabs share this. */
export function Segmented({ options, value, onChange, disabled, size = "md" }: Props) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          type="button"
          disabled={disabled}
          onClick={() => onChange(val)}
          className={cn(
            "rounded-lg font-medium transition-colors disabled:opacity-60",
            size === "sm" ? "px-3 py-1.5 text-sm" : "px-3.5 py-1.5 text-sm",
            value === val
              ? "bg-brand-bright/15 text-brand"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
