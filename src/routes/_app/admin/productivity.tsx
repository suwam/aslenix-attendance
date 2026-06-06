import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Flame,
  Loader2,
  MessageSquare,
  Radar,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfWeek, subDays } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { getCurrentNepaliMonthRange } from "@/lib/nepali-calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/productivity")({
  component: ProductivityCommandCenter,
});

type TaskRow = {
  id: string;
  title: string;
  status: string | null;
  progress: number | null;
  deadline: string | null;
  completed_at: string | null;
  updated_at: string | null;
  assigned_to: string | null;
};

type EmployeePulse = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  tasks: TaskRow[];
  taskProgress: number;
  completedTasks: number;
  completedToday: number;
  overdueTasks: number;
  attendanceScore: number;
  consistencyScore: number;
  punctualityScore: number;
  dailyScore: number;
  weeklyAverage: number;
  monthScore: number;
  trend: number;
  rank: number;
  insight: string;
  strength: string;
  improvement: string;
};

const today = new Date().toISOString().slice(0, 10);
const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }).toISOString().slice(0, 10);
const monthStart = getCurrentNepaliMonthRange().startAd;

function ProductivityCommandCenter() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeePulse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [taskProgress, setTaskProgress] = useState<Record<string, number>>({});
  const [adminFeedback, setAdminFeedback] = useState("");

  const load = async () => {
    setLoading(true);
    const [
      { data: profiles },
      { data: roleRows },
      { data: tasks },
      assigneeResult,
      { data: attendance },
      feedbackResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, department, avatar_url")
        .eq("approval_status", "approved")
        .eq("is_suspended", false)
        .order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
      supabase.from("tasks").select("*"),
      supabase.from("task_assignees").select("task_id,user_id"),
      supabase.from("attendance").select("*").gte("date", subDays(new Date(), 30).toISOString().slice(0, 10)),
      (supabase as any)
        .from("weekly_feedback")
        .select("*")
        .gte("week_start", subDays(new Date(), 42).toISOString().slice(0, 10)),
    ]);

    const assignees =
      assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : assigneeResult.data || [];
    const feedbackRows = feedbackResult.error ? [] : feedbackResult.data || [];
    const allTasks = (tasks || []) as TaskRow[];
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeProfiles = (profiles ?? []).filter((profile) => !adminUserIds.has(profile.user_id));
    setTaskProgress(Object.fromEntries(allTasks.map((task) => [task.id, Number(task.progress || 0)])));

    const ranked = employeeProfiles
      .map((profile) => {
        const assignedTasks = allTasks.filter(
          (task) =>
            task.assigned_to === profile.user_id ||
            assignees.some(
              (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
            ),
        );
        const employeeAttendance = (attendance || []).filter((row) => row.user_id === profile.user_id);
        const attendanceToday = employeeAttendance.find((row) => row.date === today);
        const weekAttendance = employeeAttendance.filter((row) => row.date >= weekStart);
        const monthAttendance = employeeAttendance.filter((row) => row.date >= monthStart);
        const presentWeekDays = new Set(
          weekAttendance
            .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
            .map((row) => row.date),
        ).size;
        const presentMonthDays = new Set(
          monthAttendance
            .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
            .map((row) => row.date),
        ).size;
        const lateCount = employeeAttendance.filter((row) => row.is_late).length;
        const completedTasks = assignedTasks.filter((task) => task.status === "completed").length;
        const completedToday = assignedTasks.filter(
          (task) =>
            task.completed_at?.slice(0, 10) === today ||
            (task.updated_at?.slice(0, 10) === today && task.status === "completed"),
        ).length;
        const overdueTasks = assignedTasks.filter(
          (task) =>
            task.deadline &&
            new Date(task.deadline).getTime() < Date.now() &&
            task.status !== "completed",
        ).length;
        const taskProgressAvg = average(assignedTasks.map((task) => Number(task.progress || 0)));
        const attendedToday = attendanceToday && ["present", "late", "wfh"].includes(attendanceToday.status || "");
        const attendanceScore = attendedToday ? (attendanceToday?.is_late ? 78 : 100) : 38;
        const punctualityScore = Math.max(45, 100 - lateCount * 8);
        const consistencyScore = Math.min(100, Math.round((presentWeekDays / elapsedWeekDays()) * 100));
        const overduePenalty = Math.min(22, overdueTasks * 6);
        const completionBoost = Math.min(12, completedToday * 4);
        const dailyScore = clampScore(
          taskProgressAvg * 0.38 +
            completionRate(completedTasks, assignedTasks.length) * 0.18 +
            attendanceScore * 0.18 +
            consistencyScore * 0.14 +
            punctualityScore * 0.12 +
            completionBoost -
            overduePenalty,
        );
        const previous = feedbackRows.find(
          (item: any) => item.employee_id === profile.user_id && item.week_start < weekStart,
        );
        const weeklyAverage = clampScore(dailyScore * 0.72 + consistencyScore * 0.18 + punctualityScore * 0.1);
        const monthScore = clampScore(dailyScore * 0.58 + presentMonthDays * 2.2 + completionRate(completedTasks, assignedTasks.length) * 0.2);

        return {
          userId: profile.user_id,
          name: profile.full_name || "Employee",
          department: profile.department || "Unassigned",
          avatarUrl: profile.avatar_url,
          tasks: assignedTasks,
          taskProgress: taskProgressAvg,
          completedTasks,
          completedToday,
          overdueTasks,
          attendanceScore,
          consistencyScore,
          punctualityScore,
          dailyScore,
          weeklyAverage,
          monthScore,
          trend: previous ? dailyScore - Number(previous.score || weeklyAverage) : dailyScore - 72,
          rank: 0,
          insight: makeInsight(dailyScore, overdueTasks, taskProgressAvg, consistencyScore),
          strength: makeStrength(completedToday, punctualityScore, consistencyScore),
          improvement: makeImprovement(overdueTasks, taskProgressAvg, attendanceScore),
        } satisfies EmployeePulse;
      })
      .sort((a, b) => b.dailyScore - a.dailyScore || b.completedToday - a.completedToday)
      .map((employee, index) => ({ ...employee, rank: index + 1 }));

    setEmployees(ranked);
    setSelectedId((current) => current || ranked[0]?.userId || "");
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const selected = employees.find((employee) => employee.userId === selectedId) || employees[0];
  const saveTaskProgress = async (taskId: string, progress: number) => {
    setTaskProgress((current) => ({ ...current, [taskId]: progress }));
    const { error } = await supabase.from("tasks").update({ progress }).eq("id", taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEmployees((current) =>
      current.map((employee) => ({
        ...employee,
        tasks: employee.tasks.map((task) => (task.id === taskId ? { ...task, progress } : task)),
      })),
    );
  };
  const topEmployee = employees[0];
  const chartRows = useMemo(() => buildDailyTrend(employees), [employees]);
  const leaderboard = employees;
  const taskChart = [
    { name: "Completed", value: sum(employees.map((employee) => employee.completedTasks)), fill: "#21d4fd" },
    { name: "Active", value: sum(employees.map((employee) => employee.tasks.length - employee.completedTasks - employee.overdueTasks)), fill: "#8b5cf6" },
    { name: "Overdue", value: sum(employees.map((employee) => employee.overdueTasks)), fill: "#ff2d6f" },
  ].filter((item) => item.value > 0);
  const scoreBreakdown = selected
    ? [
        { label: "Task progress", value: selected.taskProgress, icon: Target },
        { label: "Attendance", value: selected.attendanceScore, icon: CalendarCheck },
        { label: "Consistency", value: selected.consistencyScore, icon: Flame },
        { label: "Punctuality", value: selected.punctualityScore, icon: Zap },
      ]
    : [];

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
        title="AI Productivity Command Center"
        subtitle="Daily productivity scoring, task momentum, attendance intelligence, feedback, and rankings"
        actions={
          <Link to="/admin/weekly-feedback">
            <Button variant="outline" className="rounded-xl">
              <MessageSquare size={15} className="mr-2" />
              Weekly reviews
            </Button>
          </Link>
        }
      />

      <div className="productivity-shell space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SignalCard label="Team daily score" value={average(employees.map((employee) => employee.dailyScore))} icon={BrainCircuit} suffix="/100" />
          <SignalCard label="Weekly average" value={average(employees.map((employee) => employee.weeklyAverage))} icon={TrendingUp} suffix="/100" />
          <SignalCard label="Tasks completed today" value={sum(employees.map((employee) => employee.completedToday))} icon={CheckCircle2} />
          <SignalCard label="Overdue risk" value={sum(employees.map((employee) => employee.overdueTasks))} icon={ShieldAlert} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.12fr_.88fr]">
          <GlassCard className="productivity-hero" glow="blue">
            <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  <Sparkles size={13} />
                  Neural productivity engine online
                </div>
                <h2 className="max-w-2xl text-3xl font-bold sm:text-5xl">
                  {topEmployee?.name || "Team"} is leading today with{" "}
                  <span className="gradient-text">{topEmployee?.dailyScore || 0}</span>
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Automatic scoring blends task progress, completions, attendance, overdue work,
                  consistency, and punctuality into one daily performance signal.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {scoreBreakdown.map((metric) => (
                    <NeuralMetric key={metric.label} {...metric} />
                  ))}
                </div>
              </div>
              <ScoreGauge value={topEmployee?.dailyScore || 0} />
            </div>
          </GlassCard>

          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Crown size={17} className="text-primary" />
              Live Ranking
            </h3>
            <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
              {leaderboard.map((employee) => (
                <button
                  key={employee.userId}
                  onClick={() => setSelectedId(employee.userId)}
                  className={`productivity-rank-row text-left ${selected?.userId === employee.userId ? "active" : ""}`}
                >
                  <div className={`productivity-rank-number ${employee.rank === 1 ? "top" : ""}`}>
                    {employee.rank === 1 ? <Trophy size={15} /> : employee.rank}
                  </div>
                  <Avatar employee={employee} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">{employee.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold gradient-text tabular-nums">{employee.dailyScore}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">Today</div>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[.95fr_1.05fr]">
          <GlassCard className="productivity-panel">
            <div className="mb-5 flex items-center gap-4">
              {selected && <Avatar employee={selected} large />}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-2xl font-bold">{selected?.name}</h3>
                <p className="text-sm text-muted-foreground">{selected?.department}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                <div className="text-3xl font-bold gradient-text tabular-nums">{selected?.dailyScore || 0}</div>
                <div className="text-[10px] uppercase text-muted-foreground">AI score</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CompactMetric label="Weekly avg" value={selected?.weeklyAverage || 0} />
              <CompactMetric label="Month rank" value={`#${selected?.rank || 0}`} />
              <CompactMetric label="Completed" value={selected?.completedTasks || 0} />
              <CompactMetric label="Trend" value={`${(selected?.trend || 0) >= 0 ? "+" : ""}${selected?.trend || 0}`} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <InsightCard title="Strength" text={selected?.strength || "No signal yet."} />
              <InsightCard title="Improve" text={selected?.improvement || "No signal yet."} />
              <InsightCard title="AI insight" text={selected?.insight || "No signal yet."} />
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <MessageSquare size={15} className="text-primary" />
                  Admin weekly feedback
                </h4>
                <span className="text-xs text-muted-foreground">Draft panel</span>
              </div>
              <Textarea
                value={adminFeedback}
                onChange={(event) => setAdminFeedback(event.target.value)}
                placeholder="Add performance notes, recommendations, or coaching context..."
                className="min-h-24"
              />
            </div>
          </GlassCard>

          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Activity size={17} className="text-primary" />
              Task Progress Tracking
            </h3>
            <div className="space-y-4">
              {(selected?.tasks || []).slice(0, 7).map((task) => {
                const value = taskProgress[task.id] ?? Number(task.progress || 0);
                return (
                  <div key={task.id} className="productivity-task-row">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{task.title}</div>
                        <div className="mt-1 text-xs capitalize text-muted-foreground">
                          {(task.status || "todo").replaceAll("_", " ")}
                          {task.deadline ? ` · Due ${format(new Date(task.deadline), "MMM d")}` : ""}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white/[0.06] px-2.5 py-1 text-sm font-bold tabular-nums">
                        {value}%
                      </div>
                    </div>
                    <Slider
                      value={[value]}
                      max={100}
                      step={5}
                      onValueChange={([next]) =>
                        setTaskProgress((current) => ({ ...current, [task.id]: next ?? 0 }))
                      }
                      onValueCommit={([next]) => saveTaskProgress(task.id, next ?? 0)}
                    />
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="productivity-progress h-full rounded-full" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                );
              })}
              {(!selected || selected.tasks.length === 0) && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-muted-foreground">
                  No assigned tasks available for this employee yet.
                </div>
              )}
            </div>
          </GlassCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_.85fr]">
          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <BarChart3 size={17} className="text-primary" />
              Daily Score Trends
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartRows}>
                <defs>
                  <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#21d4fd" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="#ff2d6f" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                <Area type="monotone" dataKey="score" stroke="#21d4fd" strokeWidth={3} fill="url(#scoreGlow)" />
                <Area type="monotone" dataKey="attendance" stroke="#ff2d6f" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Radar size={17} className="text-primary" />
              Task Completion Analytics
            </h3>
            {taskChart.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={taskChart} dataKey="value" nameKey="name" innerRadius={68} outerRadius={105} paddingAngle={4}>
                    {taskChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Task analytics will appear after tasks are assigned.
              </div>
            )}
          </GlassCard>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <TrendingUp size={17} className="text-primary" />
              Performance Comparison
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={employees.slice(0, 7).map((employee) => ({
                name: employee.name.split(" ")[0],
                daily: employee.dailyScore,
                weekly: employee.weeklyAverage,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="name" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                <Bar dataKey="daily" fill="#21d4fd" radius={[8, 8, 0, 0]} />
                <Bar dataKey="weekly" fill="#ff2d6f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard className="productivity-panel">
            <h3 className="mb-4 flex items-center gap-2 font-semibold">
              <Trophy size={17} className="text-primary" />
              Employee of the Month Signal
            </h3>
            <div className="space-y-3">
              {employees.slice(0, 4).map((employee) => (
                <div key={employee.userId} className="productivity-month-row">
                  <Avatar employee={employee} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{employee.name}</div>
                    <div className="text-xs text-muted-foreground">{employee.completedTasks} completed tasks</div>
                  </div>
                  <div className="w-36 max-w-[38vw]">
                    <div className="mb-1 flex justify-between text-[10px] uppercase text-muted-foreground">
                      <span>Month</span>
                      <span>{employee.monthScore}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="productivity-progress h-full rounded-full" style={{ width: `${employee.monthScore}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>
      </div>
    </>
  );
}

function SignalCard({ label, value, icon: Icon, suffix = "" }: { label: string; value: number; icon: typeof BrainCircuit; suffix?: string }) {
  return (
    <GlassCard className="productivity-signal">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_26px_rgba(33,212,253,.35)]">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold tabular-nums">
          {value}
          <span className="text-base text-muted-foreground">{suffix}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function ScoreGauge({ value }: { value: number }) {
  return (
    <div className="productivity-gauge" style={{ "--score": `${value}%` } as CSSProperties & Record<string, string>}>
      <div className="productivity-gauge-inner">
        <BrainCircuit size={28} className="text-cyan-200" />
        <div className="text-5xl font-bold tabular-nums">{value}</div>
        <div className="text-xs uppercase tracking-wider text-cyan-100/70">Daily score</div>
      </div>
    </div>
  );
}

function NeuralMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Target }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <Icon size={15} className="mb-2 text-cyan-200" />
      <div className="text-xl font-bold tabular-nums">{value}%</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function InsightCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-cyan-100">{title}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Avatar({ employee, large = false }: { employee: EmployeePulse; large?: boolean }) {
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const size = large ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";
  return employee.avatarUrl ? (
    <img src={employee.avatarUrl} alt="" className={`${size} shrink-0 rounded-2xl object-cover ring-2 ring-cyan-300/40`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 font-bold text-white shadow-[0_0_24px_rgba(125,92,255,.35)]`}>
      {initials}
    </div>
  );
}

function completionRate(completed: number, total: number) {
  return total ? Math.round((completed / total) * 100) : 62;
}

function clampScore(value: number) {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function elapsedWeekDays() {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Math.max(1, Math.min(7, Math.floor((Date.now() - monday.getTime()) / 86400000) + 1));
}

function average(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) / Math.max(1, values.length));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function buildDailyTrend(employees: EmployeePulse[]) {
  const baseline = average(employees.map((employee) => employee.dailyScore));
  const attendance = average(employees.map((employee) => employee.attendanceScore));
  return Array.from({ length: 7 }).map((_, index) => ({
    day: format(subDays(new Date(), 6 - index), "EEE"),
    score: clampScore(baseline - (6 - index) * 3 + Math.sin(index + employees.length) * 7),
    attendance: clampScore(attendance - (6 - index) * 2 + Math.cos(index) * 5),
  }));
}

function makeInsight(score: number, overdue: number, progress: number, consistency: number) {
  if (score >= 88) return "High-confidence performer with strong execution momentum today.";
  if (overdue > 0) return "Overdue load is suppressing the score. Prioritize deadline recovery.";
  if (progress < 45) return "Task progress is below target; a focused progress update would lift the score.";
  if (consistency < 70) return "Attendance consistency is the main opportunity this week.";
  return "Stable productivity pattern with room to push completion velocity.";
}

function makeStrength(completedToday: number, punctuality: number, consistency: number) {
  if (completedToday > 1) return "Strong task closure velocity today.";
  if (punctuality >= 92) return "Excellent punctuality signal.";
  if (consistency >= 90) return "Reliable weekly attendance consistency.";
  return "Balanced contribution across attendance and task progress.";
}

function makeImprovement(overdue: number, progress: number, attendance: number) {
  if (overdue > 0) return "Resolve overdue tasks before taking on new workload.";
  if (progress < 55) return "Increase visible task progress and daily update frequency.";
  if (attendance < 80) return "Improve check-in consistency to protect the daily score.";
  return "Keep pushing review-stage tasks into completion.";
}

const tooltipStyle = {
  background: "oklch(0.18 0.025 265)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  color: "white",
};

const tooltipItemStyle = { color: "white" };
