import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useWorkspace } from "@/context/WorkspaceContext";

export function Board() {
  const { slug } = useParams();
  const { workspaces, setActiveWorkspace, activeWorkspace } = useWorkspace();

  useEffect(() => {
    if (!slug) return;
    const match = workspaces.find((w) => w.slug === slug);
    if (match && match.id !== activeWorkspace?.id) {
      setActiveWorkspace(match);
    }
  }, [slug, workspaces, setActiveWorkspace, activeWorkspace?.id]);

  return (
    <div className="text-sm">
      <p className="font-medium">Board</p>
      <p className="mt-1 text-muted-foreground">
        Workspace slug: <span className="font-mono text-foreground">{slug}</span>
        {activeWorkspace && activeWorkspace.slug === slug ? (
          <span className="ml-2 text-foreground">· {activeWorkspace.name}</span>
        ) : null}
      </p>
    </div>
  );
}
