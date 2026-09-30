import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TaskCard, TaskCardData } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  progressForStatus,
  type TaskStatus,
} from "@/lib/tasks-utils";
import { toast } from "sonner";

export function KanbanBoard({ scope = "mine" }: { scope?: "mine" | "all" }) {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [autoMovedId, setAutoMovedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: workItems, error } = await supabase
      .from("work_items")
      .select(`
        *,
        module_assignments!inner (
          id,
          user_id,
          role,
          profiles ( full_name ),
          sprint_modules (
            id,
            modules ( name ),
            weekly_sprints ( target_date )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const visibleItems = scope === "mine"
      ? (workItems || []).filter((w: any) => w.module_assignments?.user_id === user.id || isAdmin)
      : workItems || [];

    setTasks(
      visibleItems.map((w: any) => {
        const ma = w.module_assignments;
        const profile = ma?.profiles;
        const sprintModule = ma?.sprint_modules;
        const moduleName = sprintModule?.modules?.name || "Unknown Module";
        const targetDate = sprintModule?.weekly_sprints?.target_date;
        
        return {
          id: w.id,
          title: w.title,
          description: w.description,
          status: w.status as TaskStatus,
          priority: w.priority,
          progress: w.progress,
          deadline: targetDate,
          assigned_to: ma?.user_id,
          assignee_name: profile?.full_name,
          module_name: moduleName,
          role: ma?.role,
          module_assignment_id: ma?.id,
          weight: w.weight
        };
      })
    );
  }, [scope, user, isAdmin]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("kanban-work-items")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_items" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const moveTo = async (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (!isAdmin && t.assigned_to !== user?.id) {
      toast.error("You can only manage your own work items.");
      return;
    }
    const nextProgress = progressForStatus(status, t.progress);
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status, progress: nextProgress } : x)),
    );
    const { error } = await supabase
      .from("work_items")
      .update({
        status,
        progress: nextProgress,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      recalculateModuleProgress(t.module_assignment_id);
    }
  };

  const recalculateModuleProgress = async (module_assignment_id: string) => {
    // 1. Recalculate module_assignment progress
    const { data: items } = await supabase.from('work_items').select('weight, progress').eq('module_assignment_id', module_assignment_id);
    let totalWeight = 0;
    let completedWeight = 0;
    (items as any[])?.forEach((i: any) => {
      totalWeight += (i.weight || 10);
      completedWeight += (i.weight || 10) * ((i.progress || 0) / 100);
    });
    const moduleProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await supabase.from('module_assignments').update({ progress: moduleProgress } as any).eq('id', module_assignment_id);
    
    // 2. Recalculate sprint_module progress
    const { data: ma } = await supabase.from('module_assignments').select('sprint_module_id').eq('id', module_assignment_id).maybeSingle();
    if (ma?.sprint_module_id) {
      const { data: siblings } = await supabase.from('module_assignments').select('weight, progress' as any).eq('sprint_module_id', ma.sprint_module_id);
      let smTotal = 0;
      let smComp = 0;
      (siblings as any[])?.forEach((s: any) => {
        smTotal += (s.weight || 100);
        smComp += (s.weight || 100) * ((s.progress || 0) / 100);
      });
      const smProgress = smTotal > 0 ? Math.round((smComp / smTotal) * 100) : 0;
      await supabase.from('sprint_modules').update({ progress: smProgress } as any).eq('id', ma.sprint_module_id);
    }
  };

  return (
    <>
      <div
        className="kanban-board-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        style={
          {
            "--kanban-board-height":
              scope === "all"
                ? "max(30rem, calc(100dvh - 22rem))"
                : "max(30rem, calc(100dvh - 14rem))",
          } as CSSProperties
        }
      >
        {TASK_STATUSES.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => {
                if (dragId) moveTo(dragId, status);
                setDragId(null);
                setDragOver(null);
              }}
              className={`kanban-board-column glass flex flex-col rounded-2xl p-3 transition-colors ${dragOver === status ? "ring-2 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: STATUS_COLORS[status] }}
                  />
                  <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {colTasks.length}
                  </span>
                </div>
              </div>
              <div className="kanban-board-list flex-1 space-y-2 overflow-y-auto pr-1">
                <AnimatePresence>
                  {colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      onClick={() => {
                        setEditId(t.id);
                        setOpen(true);
                      }}
                      draggable={isAdmin || t.assigned_to === user?.id}
                      onDragStart={() => setDragId(t.id)}
                      autoMoved={autoMovedId === t.id}
                    />
                  ))}
                </AnimatePresence>
                {colTasks.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-8 opacity-50">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog
        open={open}
        onOpenChange={setOpen}
        workId={editId}
        onSaved={async () => {
          await load();
          if (editId) {
            setAutoMovedId(editId);
            window.setTimeout(() => setAutoMovedId(null), 1800);
          }
        }}
      />
    </>
  );
}
