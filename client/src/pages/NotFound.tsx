import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LoopMark } from "@/components/brand/Logo";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <LoopMark className="size-10 opacity-70" />
      <div className="space-y-2">
        <p className="font-mono text-xs tracking-[0.22em] text-brand uppercase">Error 404</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Page not found
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="brand" className="rounded-full px-6" asChild>
          <Link to="/">Go home</Link>
        </Button>
        <Button variant="outline" className="rounded-full px-6" asChild>
          <Link to="/explore">Explore public boards</Link>
        </Button>
      </div>
    </div>
  );
}
