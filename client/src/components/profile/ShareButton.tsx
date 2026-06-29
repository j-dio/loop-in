import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onClick}>
      {copied ? <Check className="size-3.5 text-brand" /> : <Share2 className="size-3.5" />}
      {copied ? "Copied!" : "Share"}
    </Button>
  );
}
