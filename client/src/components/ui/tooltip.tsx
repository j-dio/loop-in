/* eslint-disable react-refresh/only-export-components */
import { Tooltip as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;
export const Tooltip = T.Root;
export const TooltipTrigger = T.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof T.Content>) {
  return (
    <T.Portal>
      <T.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md border border-border bg-popover px-2 py-1 font-mono text-xs tracking-wide text-popover-foreground shadow-md",
          className
        )}
        {...props}
      />
    </T.Portal>
  );
}
