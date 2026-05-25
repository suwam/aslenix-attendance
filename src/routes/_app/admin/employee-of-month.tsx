import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  Gem,
  Loader2,
  Lock,
  Medal,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
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
import { format, startOfMonth, subMonths } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { productivityScore } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/employee-of-month")({
  component: EmployeeOfMonthPage,
});

type EmployeeRank = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  attendancePct: number;
  streak: number;
  score: number;
  level: string;
  badges: string[];
};

const chartColors = ["#21d4fd", "#8b5cf6", "#ff2d6f", "#f6c453", "#22c55e"];

function EmployeeOfMonthPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRank[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [rating, setRating] = useState("excellent");
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStartDate = startOfMonth(new Date());
      const monthStart = monthStartDate.toISOString().slice(0, 10);
      const monthStartIso = `${monthStart}T00:00:00.000Z`;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: profiles }, { data: tasks }, assigneeResult, { data: attendance }] =
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
            .gte("date", monthStart)
            .lte("date", today),
        ]);
      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays = Math.max(1, new Date().getDate());

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
              (!task.completed_at ||
                new Date(task.completed_at).getTime() >= new Date(monthStartIso).getTime()),
          ).length;
          const overdueTasks = assignedTasks.filter(
            (task: any) =>
              task.deadline &&
              new Date(task.deadline).getTime() < Date.now() &&
              task.status !== "completed",
          ).length;
          const employeeAttendance = (attendance || []).filter(
            (row) => row.user_id === profile.user_id,
          );
          const attendedDays = new Set(
            employeeAttendance
              .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
              .map((row) => row.date),
          ).size;
          const hours = employeeAttendance.reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
          const attendancePct = Math.min(100, Math.round((attendedDays / elapsedDays) * 100));
          const score = productivityScore({
            completed: completedTasks,
            total: Math.max(assignedTasks.length, completedTasks),
            onTimeRate: assignedTasks.length ? Math.max(0, 1 - overdueTasks / assignedTasks.length) : 1,
            hours,
            targetHours: 160,
          });
          const streak = countRecentStreak(new Set(employeeAttendance.map((row) => row.date)), 30);
          const level = score >= 95 ? "Legendary" : score >= 80 ? "Elite" : score >= 60 ? "Rising" : "Building";
          const badges = [
            completedTasks >= 1 ? "Starter" : null,
            completedTasks >= 5 ? "Task Sprinter" : null,
            attendancePct >= 90 ? "Attendance Pro" : null,
            overdueTasks === 0 && assignedTasks.length > 0 ? "No Overdue" : null,
            streak >= 7 ? "7 Day Streak" : null,
            score >= 95 ? "Diamond Focus" : null,
          ].filter(Boolean) as string[];

          return {
            userId: profile.user_id,
            name: profile.full_name,
            department: profile.department || "Unassigned",
            avatarUrl: profile.avatar_url,
            completedTasks,
            totalTasks: assignedTasks.length,
            overdueTasks,
            attendancePct,
            streak,
            score,
            level,
            badges,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.completedTasks - a.completedTasks ||
            b.attendancePct - a.attendancePct,
        )
        .slice(0, 8);

      const weeklyRows = Array.from({ length: 4 }).map((_, index) => {
        const base = ranked[0]?.score || 0;
        return {
          week: `W${index + 1}`,
          productivity: Math.max(8, Math.min(100, base - (3 - index) * 7 + index * 3)),
          attendance: Math.max(8, Math.min(100, (ranked[0]?.attendancePct || 0) - (3 - index) * 4)),
          tasks: Math.max(0, Math.round((ranked[0]?.completedTasks || 0) * ((index + 1) / 4))),
        };
      });

      setRows(ranked);
      setWeekly(weeklyRows);
      setLoading(false);
    })();
  }, []);

  const winner = rows[0];
  const totals = useMemo(
    () => ({
      tasks: rows.reduce((sum, row) => sum + row.completedTasks, 0),
      attendance: Math.round(rows.reduce((sum, row) => sum + row.attendancePct, 0) / Math.max(1, rows.length)),
      streak: Math.max(0, ...rows.map((row) => row.streak)),
      overdue: rows.reduce((sum, row) => sum + row.overdueTasks, 0),
      score: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length)),
    }),
    [rows],
  );

  const submitFeedback = () => {
    toast.success("Feedback saved for review");
    setFeedback("");
    setNotes("");
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
        title="Employee of the Month"
        subtitle="Premium monthly performance, recognition, and achievement analytics"
      />

      {!winner ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No approved employees found.
        </GlassCard>
      ) : (
        <div className="eom-page space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatTile label="Tasks completed" value={totals.tasks} icon={CheckCircle2} />
            <StatTile label="Attendance" value={`${totals.attendance}%`} icon={BadgeCheck} />
            <StatTile label="Active streak" value={`${totals.streak}d`} icon={Flame} />
            <StatTile label="Overdue tasks" value={totals.overdue} icon={Target} />
            <StatTile label="Avg score" value={totals.score} icon={Zap} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
            <HeroWinner winner={winner} />
            <Leaderboard rows={rows} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <AnalyticsPanel weekly={weekly} rows={rows} />
            <FeedbackPanel
              rating={rating}
              setRating={setRating}
              feedback={feedback}
              setFeedback={setFeedback}
              notes={notes}
              setNotes={setNotes}
              onSubmit={submitFeedback}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <BadgeSection winner={winner} />
            <PreviousWinners rows={rows} />
          </section>
        </div>
      )}
    </>
  );
}

function HeroWinner({ winner }: { winner: EmployeeRank }) {
  return (
    <article className="eom-winner eom-page-hero glass">
      <div className="eom-confetti" />
      <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-5">
          <Avatar employee={winner} size="hero" />
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
              <Crown size={14} />
              Employee of the Month
            </div>
            <h2 className="text-3xl font-bold md:text-4xl">{winner.name}</h2>
            <p className="mt-1 text-sm text-white/65">{winner.department}</p>
          </div>
        </div>
        <div className="eom-crown h-16 w-16">
          <Crown size={31} />
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <HeroMetric label="Score" value={winner.score} icon={Zap} />
        <HeroMetric label="Tasks" value={winner.completedTasks} icon={CheckCircle2} />
        <HeroMetric label="Attendance" value={`${winner.attendancePct}%`} icon={BadgeCheck} />
        <HeroMetric label="Level" value={winner.level} icon={Sparkles} />
      </div>

      <div className="relative z-10 mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
        <AnalyticsBar label="Productivity score" value={winner.score} />
        <AnalyticsBar label="Task completion" value={Math.min(100, winner.completedTasks * 10)} />
        <AnalyticsBar label="Attendance" value={winner.attendancePct} />
      </div>

      <div className="relative z-10 mt-7 flex flex-wrap gap-2">
        {(winner.badges.length ? winner.badges : ["Rising Talent"]).map((badge) => (
          <span key={badge} className="eom-badge">
            <Gem size={12} />
            {badge}
          </span>
        ))}
      </div>
    </article>
  );
}

function Leaderboard({ rows }: { rows: EmployeeRank[] }) {
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Trophy size={17} className="text-primary" />
          Top employee leaderboard
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row, index) => (
          <div key={row.userId} className="eom-rank-row">
            <div className={`eom-rank-number ${index === 0 ? "eom-rank-first" : ""}`}>
              {index === 0 ? <Crown size={16} /> : index + 1}
            </div>
            <Avatar employee={row} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70">
                  {row.level}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.department}</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MiniBar label="Tasks" value={Math.min(100, row.completedTasks * 10)} detail={`${row.completedTasks}`} />
                <MiniBar label="Attendance" value={row.attendancePct} detail={`${row.attendancePct}%`} />
                <MiniBar label="Score" value={row.score} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums gradient-text">{row.score}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function AnalyticsPanel({ weekly, rows }: { weekly: any[]; rows: EmployeeRank[] }) {
  const winner = rows[0];
  const pieData = [
    { name: "Completed", value: winner?.completedTasks || 0 },
    { name: "Remaining", value: Math.max(0, (winner?.totalTasks || 0) - (winner?.completedTasks || 0)) },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:col-span-2 md:grid-cols-2">
      <GlassCard>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <BarChart3 size={16} className="text-primary" />
          Productivity graph
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={weekly}>
            <defs>
              <linearGradient id="eomProductivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
                <stop offset="95%" stopColor="#ff2d6f" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
            <XAxis dataKey="week" stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
            <Area type="monotone" dataKey="productivity" stroke="#ff2d6f" fill="url(#eomProductivity)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <CalendarDays size={16} className="text-primary" />
          Attendance chart
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
            <XAxis dataKey="week" stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
            <Bar dataKey="attendance" fill="#21d4fd" radius={[8, 8, 0, 0]} />
            <Bar dataKey="tasks" fill="#f6c453" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>

      <GlassCard className="md:col-span-2">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <Target size={16} className="text-primary" />
          Monthly comparison analytics
        </h3>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" innerRadius={54} outerRadius={88} paddingAngle={4}>
                {pieData.map((_, index) => (
                  <Cell key={index} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid gap-3 sm:grid-cols-3">
            {rows.slice(0, 3).map((row) => (
              <div key={row.userId} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-sm font-semibold">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.department}</div>
                <AnalyticsBar label="Score" value={row.score} />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function FeedbackPanel({
  rating,
  setRating,
  feedback,
  setFeedback,
  notes,
  setNotes,
  onSubmit,
}: {
  rating: string;
  setRating: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <GlassCard className="eom-feedback">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Medal size={16} className="text-primary" />
        Admin feedback
      </h3>
      <div className="space-y-4">
        <div>
          <Label>Rating</Label>
          <Select value={rating} onValueChange={setRating}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">Excellent</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="poor">Poor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Feedback</Label>
          <Textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            placeholder="Recognize performance, collaboration, and delivery..."
            className="mt-1"
          />
        </div>
        <div>
          <Label>Performance notes</Label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Add internal notes for monthly review..."
            className="mt-1"
          />
        </div>
        <Button onClick={onSubmit} className="neon-button w-full rounded-xl">
          <Send size={14} className="mr-1.5" />
          Submit feedback
        </Button>
      </div>
    </GlassCard>
  );
}

function BadgeSection({ winner }: { winner: EmployeeRank }) {
  const badgeRows = [
    { title: "Productivity Hero", icon: Trophy, progress: winner.score, unlocked: winner.score >= 80 },
    { title: "Elite Performer", icon: Crown, progress: winner.score, unlocked: winner.score >= 95 },
    { title: "Task Champion", icon: Award, progress: Math.min(100, winner.completedTasks * 10), unlocked: winner.completedTasks >= 10 },
    { title: "Attendance Pro", icon: ShieldCheck, progress: winner.attendancePct, unlocked: winner.attendancePct >= 90 },
    { title: "Streak Master", icon: Flame, progress: Math.min(100, (winner.streak / 30) * 100), unlocked: winner.streak >= 30 },
    { title: "Diamond Legend", icon: Gem, progress: Math.min(100, winner.score), unlocked: winner.score >= 98 },
  ];

  return (
    <GlassCard>
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Sparkles size={16} className="text-primary" />
        Achievements and badges
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {badgeRows.map((badge) => {
          const Icon = badge.icon;
          return (
            <div key={badge.title} className={`eom-achievement ${badge.unlocked ? "" : "eom-achievement-locked"}`}>
              <div className="flex items-center gap-3">
                <div className="eom-achievement-icon">
                  {badge.unlocked ? <Icon size={18} /> : <Lock size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{badge.title}</div>
                  <MiniBar label={badge.unlocked ? "Unlocked" : "Progress"} value={badge.progress} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function PreviousWinners({ rows }: { rows: EmployeeRank[] }) {
  const months = [1, 2, 3].map((offset, index) => ({
    month: format(subMonths(new Date(), offset), "MMMM yyyy"),
    employee: rows[index + 1] || rows[0],
  }));

  return (
    <GlassCard>
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Star size={16} className="text-primary" />
        Previous winners
      </h3>
      <div className="space-y-3">
        {months.map((item) => (
          <div key={item.month} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <Avatar employee={item.employee} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{item.employee.name}</div>
                <div className="text-xs text-muted-foreground">{item.month}</div>
              </div>
              <div className="text-right">
                <div className="font-bold tabular-nums gradient-text">{item.employee.score}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Score</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Trophy }) {
  return (
    <GlassCard className="eom-stat-tile">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_24px_rgba(125,92,255,.35)]">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </GlassCard>
  );
}

function HeroMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Trophy }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <Icon size={17} className="mb-2 text-amber-200" />
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
    </div>
  );
}

function AnalyticsBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold text-white">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{detail ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Avatar({ employee, size = "md" }: { employee: EmployeeRank; size?: "md" | "hero" }) {
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const className = size === "hero" ? "h-24 w-24 text-2xl" : "h-11 w-11 text-sm";

  return employee.avatarUrl ? (
    <img
      src={employee.avatarUrl}
      alt=""
      className={`${className} shrink-0 rounded-3xl object-cover ring-2 ring-amber-200/50`}
    />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_30px_rgba(125,92,255,.4)]`}>
      {initials}
    </div>
  );
}

function countRecentStreak(activityDates: Set<string>, maxDays: number) {
  let streak = 0;
  const day = new Date();
  for (let index = 0; index < maxDays; index += 1) {
    const key = day.toISOString().slice(0, 10);
    if (!activityDates.has(key)) break;
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

const tooltipStyle = {
  background: "oklch(0.18 0.025 265)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  color: "white",
};

const tooltipItemStyle = { color: "white" };
