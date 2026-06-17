// client/src/components/admin/KanbanBoard.tsx
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Link } from "react-router-dom";
import { categoryLabel } from "@/lib/postDisplay";
import type { PostDTO } from "@/lib/postTypes";

const BOARD_COLUMNS = [
  { id: "inbox", label: "Inbox" },
  { id: "under_review", label: "Under Review" },
  { id: "planned", label: "Planned" },
  { id: "in_progress", label: "In Progress" },
  { id: "shipped", label: "Shipped" },
] as const;

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]["id"];
export type ColumnsState = Record<BoardColumnId, PostDTO[]>;

export function KanbanBoard({
  columns,
  slug,
  loading,
  statusUpdatingId,
  onDragEnd,
}: {
  columns: ColumnsState;
  slug: string;
  loading: boolean;
  statusUpdatingId: string | null;
  onDragEnd: (r: DropResult) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading Kanban…</p>;
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((col) => (
          <div key={col.id} className="flex min-w-[15rem] flex-1 flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">{col.label}</h3>
              <span className="font-mono text-[11px] text-muted-foreground">{columns[col.id].length}</span>
            </div>
            <Droppable droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`min-h-40 flex-1 rounded-xl border border-dashed p-2 transition-colors ${
                    snapshot.isDraggingOver ? "border-brand/50 bg-brand-bright/10" : "border-border"
                  }`}
                >
                  {columns[col.id].length === 0 && !snapshot.isDraggingOver ? (
                    <p className="px-1 py-6 text-center font-mono text-[11px] tracking-wide text-muted-foreground/60 uppercase">Drop here</p>
                  ) : null}
                  {columns[col.id].map((post, index) => (
                    <Draggable key={post.id} draggableId={post.id} index={index}>
                      {(dp, ds) => (
                        <div
                          ref={dp.innerRef}
                          {...dp.draggableProps}
                          {...dp.dragHandleProps}
                          className={`mb-2 rounded-lg border border-border bg-card p-2.5 text-sm transition-colors hover:border-brand/40 ${
                            ds.isDragging ? "ring-2 ring-brand/40" : ""
                          } ${statusUpdatingId === post.id ? "opacity-60" : ""}`}
                        >
                          <Link
                            to={`/${encodeURIComponent(slug)}/post/${encodeURIComponent(post.id)}`}
                            className="font-medium hover:text-brand hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {post.title}
                          </Link>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                            {categoryLabel(post.category)} · {post.upvoteCount} upvotes
                          </p>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
