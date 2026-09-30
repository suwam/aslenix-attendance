import os

# Define file contents

TASK_CARD_TSX = """import { motion } from "framer-motion";
import { Flag, FolderKanban, Target } from "lucide-react";
import {
  PRIORITY_COLORS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-utils";
import { formatNepaliDate } from "@/lib/nepali-calendar";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  deadline: string | null;
  assigned_to: string;
  module_name: string;
  module_assignment_id: string;
  role: string;
  assignee_name?: string;
  weight: number;
}

export function TaskCard({
  task,
  onClick,
  onDragStart,
  autoMoved = false,
  draggable = true,
}: {
  task: TaskCardData;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  autoMoved?: boolean;
  draggable?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onClick={onClick}
        className={`glass kanban-task-card rounded-xl p-3.5 select-none border border-border hover:border-primary/40 hover:-translate-y-0.5 transition-all ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${autoMoved ? "kanban-task-card-auto-moved" : ""}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-tight line-clamp-2">{task.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <FolderKanban size={12} className="shrink-0" />
              <span className="truncate">{task.module_name} ({task.role})</span>
            </div>
          </div>
          <span
            className="shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: `color-mix(in oklab, ${PRIORITY_COLORS[task.priority]} 22%, transparent)`,
              color: PRIORITY_COLORS[task.priority],
            }}
          >
            <Flag size={9} className="inline -mt-0.5 mr-0.5" />
            {task.priority}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE_CLASSES[task.status]}`}
          >
            {STATUS_LABELS[task.status]}
          </span>
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {task.progress}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground truncate">
            {task.deadline ? (
              <>
                <Target size={12} className="shrink-0" />
                <span className="truncate">Target: {task.deadline}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold">{task.assignee_name || 'User'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
"""

KANBAN_BOARD_TSX = """import { useEffect, useState, useCallback, type CSSProperties } from "react";
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
    items?.forEach(i => {
      totalWeight += (i.weight || 10);
      completedWeight += (i.weight || 10) * ((i.progress || 0) / 100);
    });
    const moduleProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await supabase.from('module_assignments').update({ progress: moduleProgress }).eq('id', module_assignment_id);
    
    // 2. Recalculate sprint_module progress
    const { data: ma } = await supabase.from('module_assignments').select('sprint_module_id').eq('id', module_assignment_id).maybeSingle();
    if (ma?.sprint_module_id) {
      const { data: siblings } = await supabase.from('module_assignments').select('weight, progress').eq('sprint_module_id', ma.sprint_module_id);
      let smTotal = 0;
      let smComp = 0;
      siblings?.forEach(s => {
        smTotal += (s.weight || 100);
        smComp += (s.weight || 100) * ((s.progress || 0) / 100);
      });
      const smProgress = smTotal > 0 ? Math.round((smComp / smTotal) * 100) : 0;
      await supabase.from('sprint_modules').update({ progress: smProgress }).eq('id', ma.sprint_module_id);
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
"""

TASK_DIALOG_TSX = """import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  progressForStatus,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks-utils";
import { Save } from "lucide-react";

export function TaskDialog({
  open,
  onOpenChange,
  workId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workId?: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [progress, setProgress] = useState(0);
  
  const [canEdit, setCanEdit] = useState(false);
  const [moduleAssignmentId, setModuleAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (open && workId) {
      loadWorkItem();
    }
  }, [open, workId]);

  const loadWorkItem = async () => {
    if (!workId) return;
    const { data, error } = await supabase
      .from("work_items")
      .select(`
        *,
        module_assignments!inner (
          user_id
        )
      `)
      .eq("id", workId)
      .single();

    if (error || !data) return toast.error("Failed to load work item");
    
    setTitle(data.title);
    setDescription(data.description || "");
    setStatus(data.status as TaskStatus);
    setPriority(data.priority as TaskPriority);
    setProgress(data.progress);
    setModuleAssignmentId(data.module_assignment_id);
    
    // Ensure data.module_assignments exists before trying to access user_id
    const assignee = Array.isArray(data.module_assignments) ? data.module_assignments[0] : data.module_assignments;
    setCanEdit(isAdmin || (user && assignee && assignee.user_id === user.id));
  };

  const handleStatusChange = (val: TaskStatus) => {
    setStatus(val);
    setProgress(progressForStatus(val, progress));
  };

  const recalculateModuleProgress = async (maId: string) => {
    const { data: items } = await supabase.from('work_items').select('weight, progress').eq('module_assignment_id', maId);
    let totalWeight = 0;
    let completedWeight = 0;
    items?.forEach((i: any) => {
      totalWeight += (i.weight || 10);
      completedWeight += (i.weight || 10) * ((i.progress || 0) / 100);
    });
    const moduleProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await supabase.from('module_assignments').update({ progress: moduleProgress }).eq('id', maId);
    
    const { data: ma } = await supabase.from('module_assignments').select('sprint_module_id').eq('id', maId).maybeSingle();
    if (ma?.sprint_module_id) {
      const { data: siblings } = await supabase.from('module_assignments').select('weight, progress').eq('sprint_module_id', ma.sprint_module_id);
      let smTotal = 0;
      let smComp = 0;
      siblings?.forEach((s: any) => {
        smTotal += (s.weight || 100);
        smComp += (s.weight || 100) * ((s.progress || 0) / 100);
      });
      const smProgress = smTotal > 0 ? Math.round((smComp / smTotal) * 100) : 0;
      await supabase.from('sprint_modules').update({ progress: smProgress }).eq('id', ma.sprint_module_id);
    }
  };

  const handleSave = async () => {
    if (!workId) return;
    setLoading(true);
    const { error } = await supabase
      .from("work_items")
      .update({
        title,
        description,
        status,
        priority,
        progress,
        updated_at: new Date().toISOString()
      })
      .eq("id", workId);
      
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Work item updated!");
      if (moduleAssignmentId) {
        await recalculateModuleProgress(moduleAssignmentId);
      }
      onOpenChange(false);
      if (onSaved) await onSaved();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Work Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              disabled={!canEdit} 
              className="min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Progress ({progress}%)</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={!canEdit || status === "completed"}
                  className="flex-1 accent-primary"
                />
              </div>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
"""

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

write_file("src/components/TaskCard.tsx", TASK_CARD_TSX)
write_file("src/components/KanbanBoard.tsx", KANBAN_BOARD_TSX)
write_file("src/components/TaskDialog.tsx", TASK_DIALOG_TSX)
