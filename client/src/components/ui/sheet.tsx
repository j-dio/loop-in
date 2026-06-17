/* eslint-disable react-refresh/only-export-components */
import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;

export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-sidebar p-4 shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
          className
        )}
        {...props}
      >
        <Dialog.Title className="sr-only">Navigation</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
