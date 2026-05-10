import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TaskCard, TaskCardData } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { TASK_STATUSES, STATUS_LABELS, STATUS_COLORS, type TaskStatus } from "@/lib/tasks-utils";
import { toast } from "sonner";

export function KanbanBoard({ scope = "mine" }: { scope?: "mine" | "all" }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (scope === "mine") q = q.eq("assigned_to", user.id);
    const { data } = await q;
    const ids = Array.from(new Set((data || []).map((t) => t.assigned_to)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.full_name]));
    }
    // counts
    const taskIds = (data || []).map((t) => t.id);
    let cCounts: Record<string, number> = {};
    let aCounts: Record<string, number> = {};
    if (taskIds.length) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from("task_comments").select("task_id").in("task_id", taskIds),
        supabase.from("task_attachments").select("task_id").in("task_id", taskIds),
      ]);
      (cs || []).forEach((c: any) => { cCounts[c.task_id] = (cCounts[c.task_id] || 0) + 1; });
      (as || []).forEach((a: any) => { aCounts[a.task_id] = (aCounts[a.task_id] || 0) + 1; });
    }
    setTasks((data || []).map((t: any) => ({
      ...t,
      assignee_name: names[t.assigned_to],
      comments_count: cCounts[t.id] || 0,
      attachments_count: aCounts[t.id] || 0,
    })));
  }, [user, scope]);

  useEffect(() => { load(); }, [load]);

  const moveTo = async (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    setTasks((prev) => prev.map((x) => x.id === id ? { ...x, status, progress: status === "completed" ? 100 : x.progress } : x));
    const { error } = await supabase.from("tasks").update({
      status,
      progress: status === "completed" ? 100 : t.progress,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TASK_STATUSES.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { if (dragId) moveTo(dragId, status); setDragId(null); setDragOver(null); }}
              className={`glass rounded-2xl p-3 flex flex-col min-h-[60vh] transition-colors ${dragOver === status ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLORS[status] }} />
                  <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{colTasks.length}</span>
                </div>
                <button
                  onClick={() => { setEditId(null); setDefaultStatus(status); setOpen(true); }}
                  className="p-1 rounded-md hover:bg-primary/15 hover:text-primary transition-colors"
                  title="Add task"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                <AnimatePresence>
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onClick={() => { setEditId(t.id); setOpen(true); }}
                      onDragStart={() => setDragId(t.id)}
                    />
                  ))}
                </AnimatePresence>
                {colTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 opacity-50">Drop tasks here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        taskId={editId}
        defaultStatus={defaultStatus}
        onSaved={load}
      />
    </>
  );
}
