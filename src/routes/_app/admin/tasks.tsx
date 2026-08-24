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
import {
  Plus,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Search,
  Clock3,
  Briefcase,
  Gauge,
} from "lucide-react";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { formatWorkHours } from "@/lib/work-hours";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { STATUS_LABELS } from "@/lib/tasks-utils";

export const Route = createFileRoute("/_app/admin/tasks")({ component: AdminTasks });

type TaskRow = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  progress?: number | null;
  deadline?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_to?: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name?: string | null;
  department?: string | null;
  position?: string | null;
  avatar_url?: string | null;
};

type AttendanceRow = {
  user_id: string;
  date: string;
  status?: string | null;
  work_hours?: number | null;
};

type TaskAssigneeRow = {
  task_id: string;
  user_id: string;
};

type EmployeeTaskRow = {
  userId: string;
  name: string;
  department: string;
  position: string;
  avatarUrl?: string | null;
  tasks: TaskRow[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  todoTasks: number;
  overdueTasks: number;
  taskProgress: number;
  workingDays: number;
  totalWorkHours: number;
  attendanceRows: AttendanceRow[];
  rank: number;
};

function AdminTasks() {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState({ total: 0, completed: 0, overdue: 0, active: 0 });
  const [activity, setActivity] = useState<any[]>([]);
  const [view, setView] = useState<"board" | "list" | "employees">("board");
  const [employeeRows, setEmployeeRows] = useState<EmployeeTaskRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  const load = async () => {
    const { data } = await supabase.from("tasks").select("*");
    const allTasks = ((data || []) as TaskRow[]).map((task) => ({
      ...task,
      progress: Number(task.progress || 0),
    }));
    const now = Date.now();
    setStats({
      total: allTasks.length,
      completed: allTasks.filter((t) => t.status === "completed").length,
      overdue: allTasks.filter(
        (t) => t.deadline && new Date(t.deadline).getTime() < now && t.status !== "completed",
      ).length,
      active: allTasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
    });

    const taskAssigneeResult = allTasks.length
      ? await supabase
          .from("task_assignees")
          .select("task_id,user_id")
          .in(
            "task_id",
            allTasks.map((task) => task.id),
          )
      : { data: [] };
    const allTaskAssignees =
      "error" in taskAssigneeResult &&
      taskAssigneeResult.error &&
      isMissingSupabaseTableError(taskAssigneeResult.error, "task_assignees")
        ? []
        : ((taskAssigneeResult.data || []) as TaskAssigneeRow[]);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const [{ data: profiles }, { data: roleRows }, { data: attendance }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, department, position, avatar_url, approval_status")
        .eq("approval_status", "approved")
        .order("full_name"),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin", "hr_manager"]),
      supabase
        .from("attendance")
        .select("user_id,date,status,work_hours")
        .gte("date", toDateKey(ninetyDaysAgo)),
    ]);

    const adminUserIds = new Set((roleRows || []).map((role: any) => role.user_id));
    const employees = ((profiles || []) as ProfileRow[]).filter(
      (profile) => profile.user_id && !adminUserIds.has(profile.user_id),
    );
    const rows = buildEmployeeTaskRows(
      employees,
      allTasks,
      allTaskAssignees,
      (attendance || []) as AttendanceRow[],
    );
    setEmployeeRows(rows);
    setSelectedEmployeeId((current) => current || rows[0]?.userId || "");

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
    const taskAssignees = allTaskAssignees.filter((row) => taskIds.includes(row.task_id));
    const userIds = Array.from(
      new Set([
        ...(tUpdated || []).map((t) => t.assigned_to),
        ...taskAssignees.map((a) => a.user_id),
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
        text: `Standup for ${formatNepaliDate(s.date, "DD MMM YYYY")} BS (${formatWorkHours(s.work_hours)})`,
      })),
    ]
      .sort((a, b) => +new Date(b.when) - +new Date(a.when))
      .slice(0, 12);
    setActivity(items);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const filteredEmployeeRows = employeeRows.filter((employee) => {
    const query = employeeSearch.trim().toLowerCase();
    if (!query) return true;
    return [employee.name, employee.department, employee.position]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const selectedEmployee =
    filteredEmployeeRows.find((employee) => employee.userId === selectedEmployeeId) ||
    filteredEmployeeRows[0] ||
    employeeRows[0];

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
                <SelectItem value="employees">Employees</SelectItem>
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
      ) : view === "list" ? (
        <GlassCard>
          <h3 className="font-semibold mb-4">Recent activity</h3>
          <ul className="divide-y divide-border">
            {activity.map((a, i) => (
              <li key={i} className="py-3 flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-foreground text-[10px] font-bold shrink-0"
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
                  {formatNepaliDate(a.when, "DD MMM")} BS
                </div>
              </li>
            ))}
            {activity.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">No activity yet</li>
            )}
          </ul>
        </GlassCard>
      ) : (
        <EmployeeTaskOverview
          employees={filteredEmployeeRows}
          selectedEmployee={selectedEmployee}
          search={employeeSearch}
          onSearch={setEmployeeSearch}
          onSelect={setSelectedEmployeeId}
        />
      )}

      <TaskDialog open={open} onOpenChange={setOpen} onSaved={() => setRefreshKey((k) => k + 1)} />
    </>
  );
}

function EmployeeTaskOverview({
  employees,
  selectedEmployee,
  search,
  onSearch,
  onSelect,
}: {
  employees: EmployeeTaskRow[];
  selectedEmployee?: EmployeeTaskRow;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const inProgressTasks =
    selectedEmployee?.tasks.filter(
      (task) => task.status === "in_progress" || task.status === "review",
    ) || [];
  const completedTasks =
    selectedEmployee?.tasks.filter((task) => task.status === "completed") || [];
  const otherTasks =
    selectedEmployee?.tasks.filter(
      (task) =>
        task.status !== "completed" && task.status !== "in_progress" && task.status !== "review",
    ) || [];

  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="grid min-h-[680px] xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="border-b border-border/70 bg-background/35 p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4">
            <h3 className="text-xl font-bold">Employee Tasks</h3>
            <p className="text-sm text-muted-foreground">
              Click a name to view progress, completed work, task counts, and working days.
            </p>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search employee, department"
              className="h-11 rounded-2xl pl-10"
            />
          </div>
          <div className="space-y-3 overflow-y-auto pr-1 xl:max-h-[560px]">
            {employees.map((employee) => (
              <button
                key={employee.userId}
                type="button"
                onClick={() => onSelect(employee.userId)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                  selectedEmployee?.userId === employee.userId
                    ? "border-primary/35 bg-primary/10 shadow-lg shadow-primary/10"
                    : "border-border/70 bg-background/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <EmployeeAvatar employee={employee} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{employee.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {employee.department} · {employee.totalTasks} tasks
                    </div>
                  </div>
                  <div className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background">
                    #{employee.rank}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
                  <MiniMetric label="Progress" value={`${employee.taskProgress}%`} />
                  <MiniMetric label="Done" value={employee.completedTasks} />
                  <MiniMetric label="Days" value={employee.workingDays} />
                </div>
                <ProgressLine value={employee.taskProgress} className="mt-3" />
              </button>
            ))}
            {employees.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No employee task records found.
              </div>
            )}
          </div>
        </aside>

        <section className="p-5 lg:p-6">
          {selectedEmployee ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <EmployeeAvatar employee={selectedEmployee} size="lg" />
                  <div>
                    <h2 className="text-2xl font-bold">{selectedEmployee.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmployee.position || "Employee"} · {selectedEmployee.department}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-right">
                  <div className="text-3xl font-black text-primary">
                    {selectedEmployee.taskProgress}%
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Average progress
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <TaskSummaryCard
                  label="Task count"
                  value={selectedEmployee.totalTasks}
                  icon={ListTodo}
                />
                <TaskSummaryCard
                  label="On progress"
                  value={selectedEmployee.inProgressTasks}
                  icon={Gauge}
                />
                <TaskSummaryCard
                  label="Work completed"
                  value={selectedEmployee.completedTasks}
                  icon={CheckCircle2}
                />
                <TaskSummaryCard
                  label="Working days"
                  value={selectedEmployee.workingDays}
                  icon={Clock3}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <TaskSummaryCard
                  label="Review tasks"
                  value={selectedEmployee.reviewTasks}
                  icon={Activity}
                />
                <TaskSummaryCard
                  label="Todo tasks"
                  value={selectedEmployee.todoTasks}
                  icon={Briefcase}
                />
                <TaskSummaryCard
                  label="Overdue"
                  value={selectedEmployee.overdueTasks}
                  icon={AlertTriangle}
                />
                <TaskSummaryCard
                  label="Work hours"
                  value={formatWorkHours(selectedEmployee.totalWorkHours)}
                  icon={Clock3}
                />
              </div>

              <TaskSection
                title="Tasks on progress"
                tasks={inProgressTasks}
                employee={selectedEmployee}
              />
              <TaskSection
                title="Work completed"
                tasks={completedTasks}
                employee={selectedEmployee}
              />
              <TaskSection
                title="Other assigned tasks"
                tasks={otherTasks}
                employee={selectedEmployee}
              />
            </div>
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed text-sm text-muted-foreground">
              Select an employee to view task details.
            </div>
          )}
        </section>
      </div>
    </GlassCard>
  );
}

function TaskSection({
  title,
  tasks,
  employee,
}: {
  title: string;
  tasks: TaskRow[];
  employee: EmployeeTaskRow;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <TaskDetailCard key={task.id} task={task} employee={employee} />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            No tasks in this section.
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDetailCard({ task, employee }: { task: TaskRow; employee: EmployeeTaskRow }) {
  const progress = Math.round(Number(task.progress || 0));
  const workingDays = getTaskWorkingDays(task, employee.attendanceRows);
  const status = task.status || "todo";
  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-bold">{task.title}</h4>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {task.description || "No description added."}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize text-muted-foreground">
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-semibold">
        <MiniMetric label="Progress" value={`${progress}%`} />
        <MiniMetric label="Days" value={workingDays} />
        <MiniMetric label="Priority" value={task.priority || "normal"} />
      </div>
      <ProgressLine value={progress} className="mt-3" />
      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          Assigned: {task.created_at ? formatNepaliDate(task.created_at, "DD MMM YYYY") : "-"}
        </div>
        <div>Deadline: {task.deadline ? formatNepaliDate(task.deadline, "DD MMM YYYY") : "-"}</div>
        <div>
          Completed: {task.completed_at ? formatNepaliDate(task.completed_at, "DD MMM YYYY") : "-"}
        </div>
        <div>
          Updated: {task.updated_at ? formatNepaliDate(task.updated_at, "DD MMM YYYY") : "-"}
        </div>
      </div>
    </div>
  );
}

function TaskSummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof ListTodo;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
      <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="truncate uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-foreground">{value}</div>
    </div>
  );
}

function EmployeeAvatar({
  employee,
  size = "md",
}: {
  employee: EmployeeTaskRow;
  size?: "md" | "lg";
}) {
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const sizeClass = size === "lg" ? "size-16 text-lg" : "size-12 text-sm";
  return employee.avatarUrl ? (
    <img
      src={employee.avatarUrl}
      alt={employee.name}
      className={`${sizeClass} shrink-0 rounded-full border border-border object-cover`}
    />
  ) : (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-bold text-primary`}
    >
      {initials}
    </div>
  );
}

function ProgressLine({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-muted shadow-inner ${className}`}>
      <div
        className="h-full rounded-full bg-foreground transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function buildEmployeeTaskRows(
  profiles: ProfileRow[],
  tasks: TaskRow[],
  assignees: TaskAssigneeRow[],
  attendance: AttendanceRow[],
) {
  const presentStatuses = new Set(["present", "late", "wfh"]);
  const now = Date.now();
  const attendanceByUser = new Map<string, AttendanceRow[]>();
  attendance.forEach((row) => {
    if (!presentStatuses.has(row.status || "")) return;
    attendanceByUser.set(row.user_id, [...(attendanceByUser.get(row.user_id) || []), row]);
  });

  const rows = profiles.map((profile) => {
    const assignedTasks = tasks
      .filter(
        (task) =>
          task.assigned_to === profile.user_id ||
          assignees.some(
            (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
          ),
      )
      .sort(
        (a, b) =>
          +new Date(b.updated_at || b.created_at || 0) -
          +new Date(a.updated_at || a.created_at || 0),
      );
    const userAttendance = attendanceByUser.get(profile.user_id) || [];
    const totalWorkHours = userAttendance.reduce(
      (sum, row) => sum + Number(row.work_hours || 0),
      0,
    );
    const workingDays = new Set(userAttendance.map((row) => row.date)).size;
    const completedTasks = assignedTasks.filter((task) => task.status === "completed").length;
    const inProgressTasks = assignedTasks.filter(
      (task) => task.status === "in_progress" || task.status === "review",
    ).length;

    return {
      userId: profile.user_id,
      name: profile.full_name || "Unnamed employee",
      department: profile.department || "Unassigned",
      position: profile.position || "Employee",
      avatarUrl: profile.avatar_url,
      tasks: assignedTasks,
      totalTasks: assignedTasks.length,
      completedTasks,
      inProgressTasks,
      reviewTasks: assignedTasks.filter((task) => task.status === "review").length,
      todoTasks: assignedTasks.filter((task) => task.status === "todo" || task.status === "pending")
        .length,
      overdueTasks: assignedTasks.filter(
        (task) =>
          task.deadline && new Date(task.deadline).getTime() < now && task.status !== "completed",
      ).length,
      taskProgress: average(assignedTasks.map((task) => (task.status === "completed" ? 100 : 0))),
      workingDays,
      totalWorkHours,
      attendanceRows: userAttendance,
      rank: 0,
    };
  });

  return rows
    .sort(
      (a, b) =>
        b.completedTasks - a.completedTasks ||
        b.taskProgress - a.taskProgress ||
        a.name.localeCompare(b.name),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function getTaskWorkingDays(task: TaskRow, attendanceRows: AttendanceRow[]) {
  const start = parseDateKey(task.created_at);
  const end = parseDateKey(task.completed_at || task.deadline || new Date().toISOString());
  if (!start || !end) return 0;
  return new Set(
    attendanceRows
      .filter((row) => {
        const date = parseDateKey(row.date);
        return date && +date >= +start && +date <= +end;
      })
      .map((row) => row.date),
  ).size;
}

function average(values: number[]) {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function parseDateKey(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(+date)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
