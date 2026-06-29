import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  const label = copied ? "Copied!" : "Share board";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="size-4 text-brand" /> : <Share2 className="size-4" />}
    </Button>
  );
}
