import { useNavigate } from "react-router-dom";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { LoopMark } from "@/components/brand/Logo";
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
  if (!activeWorkspace) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex max-w-[220px] items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-secondary/60">
        <span className="truncate font-medium">{activeWorkspace.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => {
              setActiveWorkspace(w);
              navigate(`/${encodeURIComponent(w.slug)}`);
            }}
          >
            <LoopMark
              className="size-4 shrink-0"
              stroke={w.id === activeWorkspace.id ? "var(--brand)" : "var(--muted-foreground)"}
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
