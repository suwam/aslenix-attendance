import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  Loader2,
  MessageSquare,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfWeek, subDays } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { productivityScore } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/weekly-feedback")({
  component: WeeklyFeedbackPage,
});

type Rating = "Excellent" | "Good" | "Average" | "Poor";

type EmployeeWeek = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  completedTasks: number;
  overdueTasks: number;
  attendancePct: number;
  score: number;
  streak: number;
  rank: number;
  trend: number;
  history: any[];
};

const ratingOptions: Rating[] = ["Excellent", "Good", "Average", "Poor"];

function WeeklyFeedbackPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeWeek[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [rating, setRating] = useState<Rating>("Excellent");
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const weekStartDate = new Date(`${weekStart}T00:00:00`);
    const weekStartIso = weekStartDate.toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: profiles }, { data: tasks }, assigneeResult, { data: attendance }, feedbackResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, department, avatar_url")
          .eq("approval_status", "approved")
          .eq("is_suspended", false),
        supabase.from("tasks").select("*"),
        supabase.from("task_assignees").select("task_id,user_id"),
        supabase
          .from("attendance")
          .select("user_id,date,status,work_hours")
          .gte("date", weekStart)
          .lte("date", today),
        (supabase as any)
          .from("weekly_feedback")
          .select("*")
          .gte("week_start", subDays(weekStartDate, 35).toISOString().slice(0, 10))
          .order("week_start", { ascending: false }),
      ]);
    const assignees =
      assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : assigneeResult.data || [];
    const feedback = feedbackResult.error ? [] : feedbackResult.data || [];
    const elapsedDays = Math.max(1, Math.min(7, Math.floor((Date.now() - weekStartDate.getTime()) / 86400000) + 1));

    const ranked = (profiles || [])
      .map((profile) => {
        const assignedTasks = (tasks || []).filter(
          (task: any) =>
            task.assigned_to === profile.user_id ||
            assignees.some(
              (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
            ),
        );
        const completedTasks = assignedTasks.filter(
          (task: any) =>
            task.status === "completed" &&
            (!task.completed_at || new Date(task.completed_at).getTime() >= new Date(weekStartIso).getTime()),
        ).length;
        const overdueTasks = assignedTasks.filter(
          (task: any) =>
            task.deadline &&
            new Date(task.deadline).getTime() < Date.now() &&
            task.status !== "completed",
        ).length;
        const employeeAttendance = (attendance || []).filter((row) => row.user_id === profile.user_id);
        const attendedDays = new Set(
          employeeAttendance
            .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
            .map((row) => row.date),
        );
        const hours = employeeAttendance.reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
        const attendancePct = Math.min(100, Math.round((attendedDays.size / elapsedDays) * 100));
        const score = productivityScore({
          completed: completedTasks,
          total: Math.max(assignedTasks.length, completedTasks),
          onTimeRate: assignedTasks.length ? Math.max(0, 1 - overdueTasks / assignedTasks.length) : 1,
          hours,
          targetHours: 40,
        });
        const history = feedback.filter((item: any) => item.employee_id === profile.user_id);
        const previous = history.find((item: any) => item.week_start !== weekStart);
        return {
          userId: profile.user_id,
          name: profile.full_name,
          department: profile.department || "Unassigned",
          avatarUrl: profile.avatar_url,
          completedTasks,
          overdueTasks,
          attendancePct,
          score,
          streak: attendedDays.size,
          rank: 0,
          trend: previous ? score - Number(previous.score || 0) : score,
          history,
        };
      })
      .sort((a, b) => b.score - a.score || b.completedTasks - a.completedTasks)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    setRows(ranked);
    setFeedbackRows(feedback);
    setSelectedId((current) => current || ranked[0]?.userId || "");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selected = rows.find((row) => row.userId === selectedId) || rows[0];
  const departments = useMemo(
    () => ["All departments", ...Array.from(new Set(rows.map((row) => row.department)))],
    [rows],
  );
  const filtered = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      row.name.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query);
    const matchesDepartment =
      departmentFilter === "All departments" || row.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });
  const chartRows = filtered.slice(0, 6).map((row) => ({
    name: row.name.split(" ")[0],
    score: row.score,
    attendance: row.attendancePct,
    tasks: row.completedTasks,
  }));
  const trendRows = Array.from({ length: 5 }).map((_, index) => ({
    week: `W${index + 1}`,
    score: Math.max(0, Math.min(100, (selected?.score || 0) - (4 - index) * 6 + index * 2)),
    attendance: Math.max(0, Math.min(100, (selected?.attendancePct || 0) - (4 - index) * 5)),
  }));
  const reviewedThisWeek = feedbackRows.filter((row) => row.week_start === weekStart).length;

  const saveFeedback = async () => {
    if (!user || !selected) return;
    setSaving(true);
    const { error } = await (supabase as any).from("weekly_feedback").upsert(
      {
        employee_id: selected.userId,
        admin_id: user.id,
        week_start: weekStart,
        rating,
        strengths: strengths || null,
        improvements: improvements || null,
        notes: notes || null,
        score: selected.score,
      },
      { onConflict: "employee_id,week_start" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Weekly feedback saved");
    setStrengths("");
    setImprovements("");
    setNotes("");
    load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Weekly Feedback"
        subtitle="Admin performance reviews, weekly analytics, strengths, improvements, and progress tracking"
      />

      <div className="weekly-feedback space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <WeeklyStat label="Employees" value={rows.length} icon={UserCheck} />
          <WeeklyStat label="Reviewed this week" value={reviewedThisWeek} icon={MessageSquare} />
          <WeeklyStat label="Top score" value={rows[0]?.score || 0} icon={Crown} />
          <WeeklyStat label="Avg attendance" value={`${average(rows.map((row) => row.attendancePct))}%`} icon={CalendarDays} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_.95fr]">
          <GlassCard className="weekly-feedback-panel">
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search employee..."
                  className="pl-9"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="md:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filtered.map((employee) => (
                <EmployeeCard
                  key={employee.userId}
                  employee={employee}
                  active={selected?.userId === employee.userId}
                  onClick={() => setSelectedId(employee.userId)}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="weekly-feedback-panel">
            <div className="mb-5 flex items-center gap-4">
              {selected && <Avatar employee={selected} size="lg" />}
              <div className="min-w-0">
                <h3 className="text-2xl font-bold">{selected?.name}</h3>
                <p className="text-sm text-muted-foreground">{selected?.department}</p>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniMetric label="Score" value={selected?.score || 0} icon={Zap} />
              <MiniMetric label="Tasks" value={selected?.completedTasks || 0} icon={CheckCircle2} />
              <MiniMetric label="Overdue" value={selected?.overdueTasks || 0} icon={ShieldAlert} />
              <MiniMetric label="Attendance" value={`${selected?.attendancePct || 0}%`} icon={CalendarDays} />
            </div>

            <div className="space-y-4">
              <div>
                <Label>Weekly rating</Label>
                <Select value={rating} onValueChange={(value) => setRating(value as Rating)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ratingOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Strengths</Label>
                <Textarea
                  value={strengths}
                  onChange={(event) => setStrengths(event.target.value)}
                  rows={3}
                  placeholder="What went especially well this week?"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Improvement section</Label>
                <Textarea
                  value={improvements}
                  onChange={(event) => setImprovements(event.target.value)}
                  rows={3}
                  placeholder="What should improve next week?"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Admin notes</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Private review notes..."
                  className="mt-1"
                />
              </div>
              <Button onClick={saveFeedback} disabled={saving} className="neon-button w-full rounded-xl">
                <Save size={14} className="mr-1.5" />
                {saving ? "Saving..." : "Submit weekly feedback"}
              </Button>
            </div>
          </GlassCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_.8fr]">
          <GlassCard className="weekly-feedback-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <BarChart3 size={16} className="text-primary" />
              Weekly analytics
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="name" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                <Bar dataKey="score" fill="#ff2d6f" radius={[8, 8, 0, 0]} />
                <Bar dataKey="attendance" fill="#21d4fd" radius={[8, 8, 0, 0]} />
                <Bar dataKey="tasks" fill="#f6c453" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard className="weekly-feedback-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <TrendingUp size={16} className="text-primary" />
              Employee weekly progress
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendRows}>
                <defs>
                  <linearGradient id="weeklyTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#ff2d6f" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="week" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                <Area type="monotone" dataKey="score" stroke="#ff2d6f" fill="url(#weeklyTrend)" strokeWidth={3} />
                <Area type="monotone" dataKey="attendance" stroke="#21d4fd" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[.9fr_1.1fr]">
          <GlassCard className="weekly-feedback-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Crown size={16} className="text-primary" />
              Leaderboard integration
            </h3>
            <div className="space-y-3">
              {rows.slice(0, 5).map((employee) => (
                <LeaderboardRow key={employee.userId} employee={employee} />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="weekly-feedback-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <MessageSquare size={16} className="text-primary" />
              Feedback history timeline
            </h3>
            <div className="space-y-3">
              {(selected?.history || []).length ? (
                selected!.history.slice(0, 6).map((item: any) => (
                  <div key={item.id} className="weekly-history-item">
                    <div className="weekly-history-dot" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.rating}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.week_start), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {item.strengths || item.improvements || item.notes || "No notes added."}
                      </p>
                    </div>
                    <div className="text-lg font-bold gradient-text">{item.score}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-muted-foreground">
                  No feedback history yet for this employee.
                </div>
              )}
            </div>
          </GlassCard>
        </section>

        <GlassCard className="weekly-feedback-panel">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-primary" />
            Employee of the month integration
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {rows.slice(0, 3).map((employee) => (
              <div key={employee.userId} className="weekly-eom-card">
                <Avatar employee={employee} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{employee.name}</div>
                  <div className="text-xs text-muted-foreground">{employee.department}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold gradient-text">{employee.score}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">EOM score</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function EmployeeCard({
  employee,
  active,
  onClick,
}: {
  employee: EmployeeWeek;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`weekly-employee-card text-left ${active ? "active" : ""}`}
    >
      <div className="flex items-start gap-3">
        <Avatar employee={employee} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{employee.name}</div>
          <div className="text-xs text-muted-foreground">{employee.department}</div>
        </div>
        <div className="rounded-xl bg-white/[0.06] px-2 py-1 text-xs font-bold tabular-nums">
          #{employee.rank}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <ProgressMetric label="Score" value={employee.score} />
        <ProgressMetric label="Tasks" value={Math.min(100, employee.completedTasks * 12)} detail={`${employee.completedTasks}`} />
        <ProgressMetric label="Attend" value={employee.attendancePct} detail={`${employee.attendancePct}%`} />
      </div>
    </button>
  );
}

function WeeklyStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Award }) {
  return (
    <GlassCard className="weekly-stat">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_24px_rgba(125,92,255,.35)]">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </GlassCard>
  );
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Award }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <Icon size={15} className="mb-2 text-primary" />
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ProgressMetric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{detail ?? `${value}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="weekly-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function LeaderboardRow({ employee }: { employee: EmployeeWeek }) {
  return (
    <div className="weekly-leader-row">
      <div className={`weekly-rank ${employee.rank === 1 ? "top" : ""}`}>
        {employee.rank === 1 ? <Crown size={15} /> : employee.rank}
      </div>
      <Avatar employee={employee} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{employee.name}</div>
        <div className="text-xs text-muted-foreground">{employee.completedTasks} tasks completed</div>
      </div>
      <div className="text-right">
        <div className="font-bold gradient-text">{employee.score}</div>
        <div className="text-[10px] uppercase text-muted-foreground">Score</div>
      </div>
    </div>
  );
}

function Avatar({ employee, size = "md" }: { employee: EmployeeWeek; size?: "md" | "lg" }) {
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const className = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";
  return employee.avatarUrl ? (
    <img src={employee.avatarUrl} alt="" className={`${className} shrink-0 rounded-2xl object-cover ring-2 ring-primary/40`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_24px_rgba(125,92,255,.35)]`}>
      {initials}
    </div>
  );
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

const tooltipStyle = {
  background: "oklch(0.18 0.025 265)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  color: "white",
};

const tooltipItemStyle = { color: "white" };
