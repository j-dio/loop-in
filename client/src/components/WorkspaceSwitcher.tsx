import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceTile } from "@/components/WorkspaceTile";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
  const navigate = useNavigate();
  // Render for any builder who owns apps — even before one is "active". On Home/Explore
  // there is no active workspace, so this is the only way back into your own boards.
  if (workspaces.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex max-w-[220px] items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2.5 text-sm hover:bg-secondary/60">
        {activeWorkspace ? (
          <>
            <WorkspaceTile
              name={activeWorkspace.name}
              seed={activeWorkspace.slug}
              logoUrl={activeWorkspace.logoUrl}
              sizeClassName="size-6"
              monogramClassName="text-[11px]"
              className="rounded-md"
            />
            <span className="truncate font-medium">{activeWorkspace.name}</span>
          </>
        ) : (
          <>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <LayoutGrid className="size-3.5" />
            </span>
            <span className="truncate font-medium">Your apps</span>
          </>
        )}
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Your apps</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => {
              setActiveWorkspace(w);
              navigate(`/${encodeURIComponent(w.slug)}`);
            }}
          >
            <WorkspaceTile
              name={w.name}
              seed={w.slug}
              logoUrl={w.logoUrl}
              sizeClassName="size-6"
              monogramClassName="text-[11px]"
              className={cn(
                "rounded-md",
                w.id === activeWorkspace?.id && "ring-2 ring-brand/60 ring-offset-1 ring-offset-background"
              )}
            />
            <span className="min-w-0 truncate">{w.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/")}>
          <Plus className="size-4 text-brand" />
          New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
