import { useEffect, useState, useCallback, type CSSProperties } from "react";
import { AnimatePresence } from "framer-motion";
import { isSameWeek } from "date-fns";
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
  type WorkflowTransition,
} from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { toast } from "sonner";

export function KanbanBoard({ scope = "mine" }: { scope?: "mine" | "all" }) {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [teamLeadTaskIds, setTeamLeadTaskIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [autoMovedId, setAutoMovedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    const taskIds = (data || []).map((t) => t.id);
    const assigneeResult = taskIds.length
      ? await supabase.from("task_assignees").select("*").in("task_id", taskIds)
      : { data: [] };
    const assignees =
      "error" in assigneeResult &&
      assigneeResult.error &&
      isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : assigneeResult.data;
    const teamLeadResult = taskIds.length
      ? await supabase.from("task_team_leads").select("task_id,user_id").in("task_id", taskIds)
      : { data: [] };
    const teamLeads =
      "error" in teamLeadResult &&
      teamLeadResult.error &&
      isMissingSupabaseTableError(teamLeadResult.error, "task_team_leads")
        ? []
        : teamLeadResult.data;
    const nextTeamLeadTaskIds = new Set(
      (teamLeads || [])
        .filter((lead) => lead.user_id === user.id)
        .map((lead) => lead.task_id),
    );
    setTeamLeadTaskIds(nextTeamLeadTaskIds);
    const ids = Array.from(
      new Set([
        ...(data || []).map((t) => t.assigned_to),
        ...(assignees || []).map((a) => a.user_id),
      ]),
    );
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.full_name]));
    }
    const assigneesByTask: Record<string, any[]> = {};
    (assignees || []).forEach((a) => {
      assigneesByTask[a.task_id] ||= [];
      assigneesByTask[a.task_id].push(a);
    });
    // counts
    const cCounts: Record<string, number> = {};
    const aCounts: Record<string, number> = {};
    if (taskIds.length) {
      const [{ data: cs }, { data: as }] = await Promise.all([
        supabase.from("task_comments").select("task_id").in("task_id", taskIds),
        supabase.from("task_attachments").select("task_id").in("task_id", taskIds),
      ]);
      (cs || []).forEach((c: any) => {
        cCounts[c.task_id] = (cCounts[c.task_id] || 0) + 1;
      });
      (as || []).forEach((a: any) => {
        aCounts[a.task_id] = (aCounts[a.task_id] || 0) + 1;
      });
    }
    const visibleTasks =
      scope === "mine"
        ? (data || []).filter(
            (t: any) =>
              t.assigned_to === user.id ||
              nextTeamLeadTaskIds.has(t.id) ||
              (assignees || []).some((a) => a.task_id === t.id && a.user_id === user.id),
          )
        : data || [];

    setTasks(
      visibleTasks.map((t: any) => {
        const taskAssignees = assigneesByTask[t.id] || [];
        const weeklyAssignees = taskAssignees.filter((a: any) =>
          a.assigned_at && isSameWeek(new Date(a.assigned_at), new Date(), { weekStartsOn: 1 })
        );
        const getWeight = (c?: string) => {
          switch (c) {
            case "small": return 1;
            case "medium": return 2;
            case "large": return 3;
            case "epic": return 5;
            default: return 2;
          }
        };

        const total_weekly_tasks = weeklyAssignees.length;
        const approved_weekly_tasks = weeklyAssignees.filter((a: any) => a.status === "approved").length;
        const pending_verification_tasks = weeklyAssignees.filter((a: any) => ["completed", "under_review"].includes(a.status)).length;
        const rejected_weekly_tasks = weeklyAssignees.filter((a: any) => a.status === "rejected").length;

        const total_weight = weeklyAssignees.reduce((sum, a) => sum + getWeight(a.complexity), 0);
        const completed_weight = weeklyAssignees
          .filter((a: any) => a.status === "approved")
          .reduce((sum, a) => sum + ((a.progress || 0) / 100) * getWeight(a.complexity), 0);
        
        const weekly_progress = total_weight > 0 ? Math.round((completed_weight / total_weight) * 100) : 0;

        return {
          ...t,
          assignee_name: names[t.assigned_to],
          assignee_names: taskAssignees.length
            ? taskAssignees.map((a: any) => names[a.user_id] || "User")
            : [names[t.assigned_to] || "User"],
          comments_count: cCounts[t.id] || 0,
          attachments_count: aCounts[t.id] || 0,
          total_weekly_tasks,
          approved_weekly_tasks,
          pending_verification_tasks,
          rejected_weekly_tasks,
          weekly_progress,
          total_weight,
          completed_weight,
        };
      })
    );
  }, [scope, user]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("kanban-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_assignees" },
        () => {
          load();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const moveTo = async (id: string, status: TaskStatus) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (!canManageTask(id)) {
      toast.error("Open the task to update progress and add a comment.");
      return;
    }
    const nextProgress = progressForStatus(status, t.progress);
    const completedAt = status === "completed" ? new Date().toISOString() : null;
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status, progress: nextProgress } : x)),
    );
    const { error } = await supabase
      .from("tasks")
      .update({
        status,
        progress: nextProgress,
        completed_at: completedAt,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const canManageTask = (taskId: string) => isAdmin || teamLeadTaskIds.has(taskId);

  const handleSaved = async (result?: {
    taskId?: string | null;
    transition?: WorkflowTransition;
  }) => {
    await load();
    if (!result?.taskId || !result.transition) return;

    setAutoMovedId(result.taskId);
    window.setTimeout(() => {
      setAutoMovedId((current) => (current === result.taskId ? null : current));
    }, 1800);
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
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditId(null);
                      setDefaultStatus(status);
                      setOpen(true);
                    }}
                    className="p-1 rounded-md hover:bg-primary/15 hover:text-primary transition-colors"
                    title="Add task"
                  >
                    <Plus size={14} />
                  </button>
                )}
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
                      draggable={canManageTask(t.id)}
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
        taskId={editId}
        defaultStatus={defaultStatus}
        onSaved={handleSaved}
      />
    </>
  );
}
