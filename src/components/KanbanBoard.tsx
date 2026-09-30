import { useEffect, useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderKanban } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function KanbanBoard({ scope = "mine" }: { scope?: "mine" | "all" }) {
  const { user, isAdmin } = useAuth();
  const [tasks, setTasks] = useState<TaskCardData[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [autoMovedId, setAutoMovedId] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedSprintId, setSelectedSprintId] = useState<string>("all");

  const load = useCallback(async () => {
    if (!user) return;
    
    let query = supabase
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
            weekly_sprints ( 
              id, 
              project_id, 
              week_number, 
              target_date,
              projects ( name )
            )
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (scope === "mine") {
      query = query.eq("module_assignments.user_id", user.id);
    }

    const { data: workItems, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    const visibleItems = scope === "mine"
      ? (workItems || []).filter((w: any) => w.module_assignments?.user_id === user.id)
      : workItems || [];

    setTasks(
      visibleItems.map((w: any) => {
        const ma = w.module_assignments;
        const profile = ma?.profiles;
        const sprintModule = ma?.sprint_modules;
        const moduleName = sprintModule?.modules?.name || "Unknown Module";
        const sprint = sprintModule?.weekly_sprints;
        const project = sprint?.projects;
        
        return {
          id: w.id,
          title: w.title,
          description: w.description,
          status: w.status as TaskStatus,
          priority: w.priority,
          progress: w.progress,
          deadline: sprint?.target_date,
          assigned_to: ma?.user_id,
          assignee_name: profile?.full_name,
          module_name: moduleName,
          role: ma?.role,
          module_assignment_id: ma?.id,
          weight: w.weight,
          project_id: sprint?.project_id,
          project_name: project?.name || "Unknown Project",
          sprint_id: sprint?.id,
          week_number: sprint?.week_number,
        };
      })
    );
  }, [scope, user]);

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
      } as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    } else {
      recalculateModuleProgress(t.module_assignment_id);
    }
  };

  const recalculateModuleProgress = async (module_assignment_id: string) => {
    const { data: items } = await supabase.from('work_items').select('weight, progress').eq('module_assignment_id', module_assignment_id);
    let totalWeight = 0;
    let completedWeight = 0;
    (items as any[])?.forEach((i: any) => {
      totalWeight += (i.weight || 10);
      completedWeight += (i.weight || 10) * ((i.progress || 0) / 100);
    });
    const moduleProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await supabase.from('module_assignments').update({ progress: moduleProgress } as any).eq('id', module_assignment_id);
    
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

  const { projects, sprints, filteredTasks } = useMemo(() => {
    const projs = new Map<string, string>();
    const sprs = new Map<string, { week: number; proj: string }>();
    
    tasks.forEach(t => {
      if (t.project_id) projs.set(t.project_id, t.project_name);
      if (t.sprint_id) sprs.set(t.sprint_id, { week: t.week_number, proj: t.project_id });
    });

    let fTasks = tasks;
    if (selectedProjectId !== "all") {
      fTasks = fTasks.filter(t => t.project_id === selectedProjectId);
    }
    if (selectedSprintId !== "all") {
      fTasks = fTasks.filter(t => t.sprint_id === selectedSprintId);
    }

    return {
      projects: Array.from(projs.entries()).map(([id, name]) => ({ id, name })),
      sprints: Array.from(sprs.entries())
        .filter(([, data]) => selectedProjectId === "all" || data.proj === selectedProjectId)
        .map(([id, data]) => ({ id, week: data.week })),
      filteredTasks: fTasks,
    };
  }, [tasks, selectedProjectId, selectedSprintId]);

  const summary = useMemo(() => {
    let assigned = filteredTasks.length;
    let completed = 0;
    let inProgress = 0;
    let review = 0;
    let todo = 0;
    let totalWeight = 0;
    let compWeight = 0;

    filteredTasks.forEach(t => {
      if (t.status === 'completed') completed++;
      else if (t.status === 'in_progress') inProgress++;
      else if (t.status === 'review') review++;
      else todo++;

      totalWeight += (t.weight || 10);
      compWeight += (t.weight || 10) * ((t.progress || 0) / 100);
    });

    const progress = totalWeight > 0 ? Math.round((compWeight / totalWeight) * 100) : 0;
    return { assigned, completed, inProgress, review, todo, progress };
  }, [filteredTasks]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="glass p-5 rounded-2xl flex-1 flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-lg font-black mb-1 uppercase tracking-tight text-primary">Assignment Filters</h2>
            <p className="text-xs text-muted-foreground">Select project and week to view your assignments.</p>
          </div>
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Project</label>
              <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedSprintId("all"); }}>
                <SelectTrigger className="bg-background/50 h-9 text-sm font-semibold backdrop-blur"><SelectValue placeholder="All Projects"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 max-w-[200px]">
              <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Week</label>
              <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                <SelectTrigger className="bg-background/50 h-9 text-sm font-semibold backdrop-blur"><SelectValue placeholder="All Weeks"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Weeks</SelectItem>
                  {sprints.map(s => <SelectItem key={s.id} value={s.id}>Week {s.week}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex-1 md:flex-[2]">
          <h2 className="text-[10px] font-bold mb-4 uppercase tracking-wider text-muted-foreground">Weekly Overview</h2>
          <div className="flex flex-wrap items-center gap-6 md:gap-8 mb-5">
            <div className="flex flex-col">
              <span className="text-4xl font-black text-primary leading-none tracking-tighter">{summary.progress}%</span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Progress</span>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="flex flex-wrap gap-4 md:gap-6">
              <div className="flex flex-col">
                <span className="text-xl font-black">{summary.assigned}</span>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Assigned</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-emerald-500">{summary.completed}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-500/70">Completed</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-amber-500">{summary.review}</span>
                <span className="text-[10px] uppercase font-bold text-amber-500/70">Review</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-blue-500">{summary.inProgress}</span>
                <span className="text-[10px] uppercase font-bold text-blue-500/70">In Progress</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-700 ease-out" style={{ width: `${summary.progress}%` }} />
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-24 rounded-2xl border-dashed">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-5 text-primary">
            <FolderKanban size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">You're all caught up.</h2>
          <p className="text-muted-foreground max-w-sm text-center text-sm">No work has been assigned to you by the Project Manager for the selected filters.</p>
        </div>
      ) : (
        <div className="kanban-board-grid grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 min-h-[60vh]">
          {TASK_STATUSES.map((status) => {
            const colTasks = filteredTasks.filter((t) => t.status === status);
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
                className={`kanban-board-column glass flex flex-col rounded-3xl p-4 transition-colors border border-border/40 ${dragOver === status ? "ring-2 ring-primary/60 bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2 w-2 rounded-full ring-4 ring-background shadow-sm"
                      style={{ background: STATUS_COLORS[status] }}
                    />
                    <h3 className="text-xs font-bold uppercase tracking-widest">{STATUS_LABELS[status]}</h3>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full tabular-nums">
                    {colTasks.length}
                  </span>
                </div>
                <div className="kanban-board-list flex-1 space-y-3 overflow-y-auto pr-1">
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
                    <div className="text-xs font-medium text-muted-foreground/60 text-center py-10 border-2 border-dashed border-border/50 rounded-2xl">
                      No assigned work
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    </div>
  );
}
