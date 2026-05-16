import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskDialog } from "@/components/TaskDialog";
import { Plus, ListTodo, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/tasks")({ component: AdminTasks });

function AdminTasks() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, completed: 0, overdue: 0, active: 0 });
  const [activity, setActivity] = useState<any[]>([]);
  const [view, setView] = useState<"board" | "list">("board");

  const load = async () => {
    const { data } = await supabase.from("tasks").select("*");
    const now = Date.now();
    setStats({
      total: data?.length || 0,
      completed: data?.filter((t) => t.status === "completed").length || 0,
      overdue:
        data?.filter(
          (t) => t.deadline && new Date(t.deadline).getTime() < now && t.status !== "completed",
        ).length || 0,
      active: data?.filter((t) => t.status === "in_progress" || t.status === "review").length || 0,
    });
    // recent activity = recent updates + standups
    const [{ data: tUpdated }, { data: standups }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, status, updated_at, assigned_to")
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("standups")
        .select("id, user_id, date, today, work_hours, updated_at")
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);
    const taskIds = (tUpdated || []).map((t) => t.id);
    const { data: taskAssignees } = taskIds.length
      ? await supabase.from("task_assignees").select("task_id,user_id").in("task_id", taskIds)
      : { data: [] };
    const userIds = Array.from(
      new Set([
        ...(tUpdated || []).map((t) => t.assigned_to),
        ...(taskAssignees || []).map((a) => a.user_id),
        ...(standups || []).map((s) => s.user_id),
      ]),
    );
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.full_name]));
    }
    const namesByTask: Record<string, string[]> = {};
    (taskAssignees || []).forEach((a) => {
      namesByTask[a.task_id] ||= [];
      namesByTask[a.task_id].push(names[a.user_id] || "User");
    });
    const items = [
      ...(tUpdated || []).map((t: any) => ({
        kind: "task",
        id: t.id,
        when: t.updated_at,
        who: namesByTask[t.id]?.length
          ? namesByTask[t.id].join(", ")
          : names[t.assigned_to] || "User",
        text: `${t.title} → ${t.status}`,
      })),
      ...(standups || []).map((s: any) => ({
        kind: "standup",
        id: s.id,
        when: s.updated_at,
        who: names[s.user_id] || "User",
        text: `Standup for ${s.date} (${Number(s.work_hours || 0).toFixed(1)}h)`,
      })),
    ]
      .sort((a, b) => +new Date(b.when) - +new Date(a.when))
      .slice(0, 12);
    setActivity(items);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  return (
    <>
      <PageHeader
        title="Task Management"
        subtitle="Assign tasks and monitor team productivity"
        actions={
          <>
            <Select value={view} onValueChange={(v: any) => setView(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">Board</SelectItem>
                <SelectItem value="list">Activity</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)} className="neon-button rounded-xl">
              <Plus size={16} className="mr-1.5" /> Assign task
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total tasks" value={stats.total} icon={ListTodo} accent="blue" />
        <StatCard label="Active" value={stats.active} icon={Activity} accent="amber" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} accent="green" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="red" />
      </div>

      {view === "board" ? (
        <KanbanBoard key={refreshKey} scope="all" />
      ) : (
        <GlassCard>
          <h3 className="font-semibold mb-4">Recent activity</h3>
          <ul className="divide-y divide-border">
            {activity.map((a, i) => (
              <li key={i} className="py-3 flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {a.who
                    .split(" ")
                    .map((s: string) => s[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{a.who}</span> ·{" "}
                    <span className="text-muted-foreground capitalize">{a.kind}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{a.text}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(a.when), "MMM d HH:mm")}
                </div>
              </li>
            ))}
            {activity.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">No activity yet</li>
            )}
          </ul>
        </GlassCard>
      )}

      <TaskDialog open={open} onOpenChange={setOpen} onSaved={() => setRefreshKey((k) => k + 1)} />
    </>
  );
}
