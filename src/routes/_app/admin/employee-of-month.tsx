import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Crown,
  Flame,
  Gem,
  History,
  Loader2,
  Lock,
  Medal,
  MessageSquare,
  Minus,
  Send,
  ShieldOff,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingDown,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  calculateFinalEmployeeScore,
  calculateOverduePenalty,
  calculateReviewAverage,
  calculateTaskProgressMetrics,
  ratingLabelFromAverage,
  resolvedReviewScore,
} from "@/lib/employee-scoring";
import { eomEligibilityLabel, isEomEligible } from "@/lib/eom-eligibility";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/employee-of-month")({
  component: EmployeeOfMonthPage,
});

type EmployeeRank = {
  userId: string;
  name: string;
  department: string;
  position: string;
  isEomEligible: boolean;
  avatarUrl: string | null;
  taskProgress: number;
  totalTaskProgress: number;
  productivityContribution: number;
  activeTasks: number;
  completionTrend: number;
  dailyImprovement: number;
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  overduePenalty: number;
  attendancePct: number;
  streak: number;
  score: number;
  achievementBonus: number;
  reviewAverage: number;
  reviewCount: number;
  reviewTrend: "up" | "down" | "steady" | "new";
  latestReview: WeeklyReview | null;
  reviews: WeeklyReview[];
  level: string;
  badges: string[];
};

type EomProfile = {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  is_eom_eligible?: boolean | null;
};

type ExcludedEmployee = {
  userId: string;
  name: string;
  department: string;
  position: string;
  avatarUrl: string | null;
  isEomEligible: false;
};

type WeeklyReview = {
  id: string;
  employee_id: string;
  week_start: string;
  rating: string;
  review_score?: number | null;
  strengths: string | null;
  improvements: string | null;
  notes: string | null;
  created_at: string;
};

const chartColors = ["#21d4fd", "#8b5cf6", "#ff2d6f", "#f6c453", "#22c55e"];

async function fetchWeeklyReviews() {
  const result = await (supabase as any)
    .from("weekly_feedback")
    .select("id,employee_id,week_start,rating,review_score,strengths,improvements,notes,created_at")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (!result.error || !isMissingReviewScoreError(result.error)) return result;

  return (supabase as any)
    .from("weekly_feedback")
    .select("id,employee_id,week_start,rating,strengths,improvements,notes,created_at")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false });
}

function EmployeeOfMonthPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRank[]>([]);
  const [excludedRows, setExcludedRows] = useState<ExcludedEmployee[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [rating, setRating] = useState("excellent");
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [officialAward, setOfficialAward] = useState<any>(null);
  const [savingAward, setSavingAward] = useState(false);
  const [resettingAward, setResettingAward] = useState(false);

  const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);

  const loadEomData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      const monthStartIso = `${monthStart}T00:00:00.000Z`;
      const today = new Date().toISOString().slice(0, 10);
      const [
        { data: profiles },
        { data: tasks },
        assigneeResult,
        { data: attendance },
        feedbackResult,
        progressResult,
      ] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, department, position, avatar_url, is_eom_eligible")
            .eq("approval_status", "approved")
            .eq("is_suspended", false),
          supabase.from("tasks").select("*"),
          supabase.from("task_assignees").select("task_id,user_id"),
          supabase
            .from("attendance")
            .select("user_id,date,status,work_hours")
            .gte("date", monthStart)
            .lte("date", today),
          fetchWeeklyReviews(),
          (supabase as any)
            .from("task_progress_updates")
            .select("task_id,old_progress,new_progress,created_at")
            .gte("created_at", monthStartIso),
        ]);
      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays = Math.max(1, new Date().getDate());
      const feedbackRows = (feedbackResult.error ? [] : feedbackResult.data || []) as WeeklyReview[];
      const progressRows = progressResult.error ? [] : progressResult.data || [];
      const profileRows = ((profiles || []) as EomProfile[]);
      const eligibleProfiles = profileRows.filter(isEomEligible);
      const excludedProfiles = profileRows.filter((profile) => !isEomEligible(profile));

      const ranked = eligibleProfiles
        .map((profile) => {
          const assignedTasks = (tasks || []).filter(
            (task: any) =>
              task.assigned_to === profile.user_id ||
              assignees.some(
                (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
              ),
          );
          const taskMetrics = calculateTaskProgressMetrics(assignedTasks);
          const completedTasks = assignedTasks.filter(
            (task: any) =>
              (task.status === "completed" || Number(task.progress || 0) >= 100) &&
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
          const attendancePct = Math.min(100, Math.round((attendedDays / elapsedDays) * 100));
          const assignedTaskIds = new Set(assignedTasks.map((task: any) => task.id));
          const progressGain = progressRows
            .filter((row: any) => assignedTaskIds.has(row.task_id))
            .reduce(
              (sum: number, row: any) =>
                sum + Math.max(0, Number(row.new_progress || 0) - Number(row.old_progress || 0)),
              0,
            );
          const dailyImprovement = taskMetrics.totalTasks
            ? Math.min(100, Number((progressGain / taskMetrics.totalTasks / elapsedDays).toFixed(1)))
            : 0;
          const streak = countRecentStreak(new Set(employeeAttendance.map((row) => row.date)), 30);
          const badges = [
            taskMetrics.averageProgress >= 10 ? "Progress Starter" : null,
            taskMetrics.averageProgress >= 50 ? "Momentum Builder" : null,
            attendancePct >= 90 ? "Attendance Pro" : null,
            overdueTasks === 0 && assignedTasks.length > 0 ? "No Overdue" : null,
            streak >= 7 ? "7 Day Streak" : null,
            taskMetrics.averageProgress >= 95 ? "Diamond Focus" : null,
          ].filter(Boolean) as string[];
          const reviews = feedbackRows.filter((item) => item.employee_id === profile.user_id);
          const reviewAverage = calculateReviewAverage(reviews);
          const latestReview = reviews[0] || null;
          const latestReviewScore = latestReview ? resolvedReviewScore(latestReview) : 0;
          const previousReviewScore = reviews[1] ? resolvedReviewScore(reviews[1]) : null;
          const reviewTrend =
            previousReviewScore === null
              ? latestReview
                ? "new"
                : "steady"
              : latestReviewScore > previousReviewScore
                ? "up"
                : latestReviewScore < previousReviewScore
                  ? "down"
                  : "steady";
          const achievementBonus = Math.min(100, Math.round((badges.length / 6) * 100));
          const overduePenalty = calculateOverduePenalty(overdueTasks);
          const score = calculateFinalEmployeeScore({
            taskProgressContribution: taskMetrics.productivityContribution,
            attendance: attendancePct,
            averageReviewScore: reviewAverage,
            achievementBonus,
            overduePenalty,
          });
          const level = score >= 95 ? "Legendary" : score >= 80 ? "Elite" : score >= 60 ? "Rising" : "Building";

          return {
            userId: profile.user_id,
            name: profile.full_name,
            department: profile.department || "Unassigned",
            position: profile.position || "Employee",
            isEomEligible: true,
            avatarUrl: profile.avatar_url,
            taskProgress: taskMetrics.averageProgress,
            totalTaskProgress: taskMetrics.totalTaskProgress,
            productivityContribution: taskMetrics.productivityContribution,
            activeTasks: taskMetrics.activeTasks,
            completionTrend: taskMetrics.completionTrend,
            dailyImprovement,
            completedTasks,
            totalTasks: taskMetrics.totalTasks,
            overdueTasks,
            overduePenalty,
            attendancePct,
            streak,
            score,
            achievementBonus,
            reviewAverage,
            reviewCount: reviews.length,
            reviewTrend,
            latestReview,
            reviews,
            level,
            badges,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.taskProgress - a.taskProgress ||
            b.attendancePct - a.attendancePct,
        )
        .slice(0, 8);

      const weeklyRows = Array.from({ length: 4 }).map((_, index) => {
        const base = ranked[0]?.score || 0;
        return {
          week: `W${index + 1}`,
          productivity: Math.max(8, Math.min(100, base - (3 - index) * 7 + index * 3)),
          attendance: Math.max(8, Math.min(100, (ranked[0]?.attendancePct || 0) - (3 - index) * 4)),
          taskProgress: Math.max(0, Math.round((ranked[0]?.taskProgress || 0) * ((index + 1) / 4))),
        };
      });

      setRows(ranked);
      setExcludedRows(
        excludedProfiles.map((profile) => ({
          userId: profile.user_id,
          name: profile.full_name,
          department: profile.department || "Unassigned",
          position: profile.position || "Employee",
          avatarUrl: profile.avatar_url,
          isEomEligible: false,
        })),
      );
      setSelectedEmployeeId((current) =>
        ranked.some((row) => row.userId === current) ? current : ranked[0]?.userId || "",
      );
      setWeekly(weeklyRows);

      const awardResult = await (supabase as any)
        .from("employee_month_awards")
        .select("*, profiles:employee_id(user_id, full_name, department, avatar_url)")
        .eq("month_start", monthStart)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setOfficialAward(awardResult.error ? null : awardResult.data);
      setLoading(false);
  }, [monthStart]);

  const refreshEomData = useCallback(() => {
    void loadEomData({ silent: true });
  }, [loadEomData]);

  useEffect(() => {
    loadEomData();

    const channel = supabase
      .channel("eom-live-rankings")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_feedback" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_progress_updates" }, refreshEomData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadEomData, refreshEomData]);

  const winner = rows[0];
  const selectedEmployee = rows.find((row) => row.userId === selectedEmployeeId) || winner;
  const totals = useMemo(
    () => ({
      taskProgress: Math.round(rows.reduce((sum, row) => sum + row.taskProgress, 0) / Math.max(1, rows.length)),
      activeTasks: rows.reduce((sum, row) => sum + row.activeTasks, 0),
      attendance: Math.round(rows.reduce((sum, row) => sum + row.attendancePct, 0) / Math.max(1, rows.length)),
      streak: Math.max(0, ...rows.map((row) => row.streak)),
      overdue: rows.reduce((sum, row) => sum + row.overdueTasks, 0),
      score: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length)),
    }),
    [rows],
  );

  const submitFeedback = async () => {
    if (!user || !selectedEmployee) return;
    setSavingAward(true);
    const { error } = await (supabase as any).from("employee_month_awards").upsert(
      {
        employee_id: selectedEmployee.userId,
        admin_id: user.id,
        month_start: monthStart,
        score: selectedEmployee.score,
        rating,
        public_message: feedback || null,
        internal_notes: notes || null,
      },
      { onConflict: "employee_id,month_start" },
    );
    setSavingAward(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedEmployee.name} was assigned Employee of the Month`);
    setOfficialAward({
      employee_id: selectedEmployee.userId,
      month_start: monthStart,
      score: selectedEmployee.score,
      rating,
      public_message: feedback,
      internal_notes: notes,
      profiles: {
        user_id: selectedEmployee.userId,
        full_name: selectedEmployee.name,
        department: selectedEmployee.department,
        avatar_url: selectedEmployee.avatarUrl,
      },
    });
    setFeedback("");
    setNotes("");
  };

  const resetOfficialAward = async () => {
    if (!officialAward) return;
    const confirmed = window.confirm("Reset Employee of the Month for this month?");
    if (!confirmed) return;

    setResettingAward(true);
    const { error } = await (supabase as any)
      .from("employee_month_awards")
      .delete()
      .eq("month_start", monthStart);
    setResettingAward(false);

    if (error) return toast.error(error.message);

    toast.success("Employee of the Month has been reset for this month");
    setOfficialAward(null);
    void loadEomData({ silent: true });
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
          No EOM-eligible employees found.
        </GlassCard>
      ) : (
        <div className="eom-page space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatTile label="Task progress" value={`${totals.taskProgress}%`} icon={CheckCircle2} />
            <StatTile label="Active tasks" value={totals.activeTasks} icon={Target} />
            <StatTile label="Attendance" value={`${totals.attendance}%`} icon={BadgeCheck} />
            <StatTile label="HR reviews" value={rows.reduce((sum, row) => sum + row.reviewCount, 0)} icon={MessageSquare} />
            <StatTile label="Avg score" value={totals.score} icon={Zap} />
          </section>

          <EligibilitySummary eligibleCount={rows.length} excludedRows={excludedRows} />

          <section className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <TopContenders rows={rows} />
            <Leaderboard rows={rows} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <AnalyticsPanel weekly={weekly} rows={rows} />
            <FeedbackPanel
              rows={rows}
              selectedEmployeeId={selectedEmployeeId}
              setSelectedEmployeeId={setSelectedEmployeeId}
              selectedEmployee={selectedEmployee}
              officialAward={officialAward}
              rating={rating}
              setRating={setRating}
              feedback={feedback}
              setFeedback={setFeedback}
              notes={notes}
              setNotes={setNotes}
              onSubmit={submitFeedback}
              saving={savingAward}
            />
          </section>

          <HrReviewsSection rows={rows} selectedEmployee={selectedEmployee} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_.8fr]">
            <BadgeSection winner={winner} />
            <PreviousWinners rows={rows} />
          </section>
        </div>
      )}
    </>
  );
}

function TopContenders({ rows }: { rows: EmployeeRank[] }) {
  const contenders = rows.slice(0, 5);
  const leader = contenders[0];
  const leaderGap = contenders[0] && contenders[1] ? contenders[0].score - contenders[1].score : null;
  const isTightRace = leaderGap !== null && leaderGap <= 5;
  const contenderLabels = [
    "Top Performer",
    "Rising Star",
    "Consistent Contributor",
    "Strong Challenger",
    "Close Contender",
  ];

  return (
    <article className="eom-contenders eom-page-hero glass">
      <div className="eom-confetti" />
      <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
            <Trophy size={14} />
            Top 5 Contenders
          </div>
          <h2 className="text-3xl font-bold md:text-4xl">Employee of the Month race</h2>
          <p className="mt-1 text-sm text-white/65">
            Live ranking from task progression, attendance, HR reviews, bonuses, and overdue penalties.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isTightRace && (
            <span className="eom-tight-race">
              <Flame size={13} />
              Tight Race · {leaderGap} point gap
            </span>
          )}
          {leader && (
            <span className="eom-review-pill">
              <Crown size={13} />
              Leader: {leader.name}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-6 eom-contender-grid">
        {contenders.map((employee, index) => (
          <ContenderCard
            key={employee.userId}
            employee={employee}
            rank={index + 1}
            label={contenderLabels[index]}
            featured={index === 0}
          />
        ))}
      </div>

      <div className="relative z-10 mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Score comparison</div>
          <div className="text-xs text-muted-foreground">Auto-sorted by final score</div>
        </div>
        <div className="space-y-3">
          {contenders.map((employee, index) => (
            <MiniBar
              key={employee.userId}
              label={`#${index + 1} ${employee.name}`}
              value={employee.score}
              detail={`${employee.score}/100`}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function ContenderCard({
  employee,
  rank,
  label,
  featured = false,
}: {
  employee: EmployeeRank;
  rank: number;
  label: string;
  featured?: boolean;
}) {
  const rankTone = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "neutral";

  return (
    <div className={`eom-contender-card ${rankTone} ${featured ? "featured" : ""}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar employee={employee} size={featured ? "hero" : "md"} />
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`eom-rank-medal ${rankTone}`}>
                {rank === 1 ? <Crown size={13} /> : <Medal size={13} />}
                Rank {rank}
              </span>
              <span className="eom-badge">{label}</span>
            </div>
            <h3 className={featured ? "text-2xl font-bold md:text-3xl" : "text-lg font-bold"}>
              {employee.name}
            </h3>
            <p className="mt-1 text-sm text-white/65">{employee.department} · {employee.position}</p>
            <div className="mt-3">
              <EligibilityBadge eligible={employee.isEomEligible} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          {rank === 1 && (
            <div className="eom-crown eom-contender-crown">
              <Crown size={28} />
            </div>
          )}
          <div className="text-left sm:text-right">
            <div className="text-4xl font-black tabular-nums gradient-text">{employee.score}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Final score</div>
          </div>
        </div>
      </div>

      <div className="eom-contender-metrics-grid mt-5 grid gap-3">
        <ContenderMetric label="Task progress" value={`${employee.taskProgress}%`} icon={CheckCircle2} />
        <ContenderMetric label="Attendance" value={`${employee.attendancePct}%`} icon={BadgeCheck} />
        <ContenderMetric label="Active tasks" value={employee.activeTasks} icon={Target} />
        <ContenderMetric label="HR review" value={`${employee.reviewAverage}/10`} icon={MessageSquare} />
        <ContenderMetric label="Daily improvement" value={`${employee.dailyImprovement}%`} icon={TrendingUp} />
        <ContenderMetric
          label="Weekly trend"
          value={<span className="inline-flex items-center gap-1"><TrendIcon trend={employee.reviewTrend} />{contenderTrendLabel(employee.reviewTrend)}</span>}
          icon={BarChart3}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <AnalyticsBar label="Task progression" value={employee.taskProgress} />
        <AnalyticsBar label="Productivity" value={employee.productivityContribution} />
        <AnalyticsBar label="Attendance" value={employee.attendancePct} />
        <AnalyticsBar label="HR review score" value={employee.reviewAverage * 10} />
      </div>
    </div>
  );
}

function ContenderMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number | ReactNode;
  icon: typeof Trophy;
}) {
  return (
    <div className="eom-contender-metric">
      <Icon size={15} className="text-amber-200" />
      <div className="mt-2 text-lg font-bold tabular-nums text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
    </div>
  );
}

function contenderTrendLabel(trend: EmployeeRank["reviewTrend"]) {
  if (trend === "up") return "Improving";
  if (trend === "down") return "Dropping";
  return "Stable";
}

function Leaderboard({ rows }: { rows: EmployeeRank[] }) {
  return (
    <GlassCard className="eom-leaderboard overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Trophy size={17} className="text-primary" />
          Top employee leaderboard
        </h3>
      </div>
      <div className="eom-leaderboard-list divide-y divide-border/50">
        {rows.map((row, index) => (
          <div key={row.userId} className="eom-rank-row">
            <div className={`eom-rank-number ${index === 0 ? "eom-rank-first" : ""}`}>
              {index === 0 ? <Crown size={16} /> : index + 1}
            </div>
            <Avatar employee={row} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                  {row.level}
                </span>
                <EligibilityBadge eligible={row.isEomEligible} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.department} · {row.position}</div>
              <div className="eom-leader-metrics mt-3 grid gap-3">
                <MiniBar label="Task progress" value={row.taskProgress} detail={`${row.taskProgress}%`} />
                <MiniBar label="Productivity" value={row.productivityContribution} detail={`${row.productivityContribution}%`} />
                <MiniBar label="Active tasks" value={Math.min(100, row.activeTasks * 10)} detail={`${row.activeTasks}`} />
                <MiniBar label="Attendance" value={row.attendancePct} detail={`${row.attendancePct}%`} />
                <MiniBar label="HR avg" value={row.reviewAverage * 10} detail={row.reviewAverage ? `${row.reviewAverage}/10` : "0"} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="eom-review-pill">
                  {ratingLabelFromAverage(row.reviewAverage)} · {row.reviewCount} reviews
                </span>
                <span className="eom-review-pill">
                  Trend {row.completionTrend}% · +{row.dailyImprovement}%/day
                </span>
                {row.overduePenalty > 0 && (
                  <span className="eom-review-pill">
                    -{row.overduePenalty} overdue penalty
                  </span>
                )}
                <span className="eom-review-pill">
                  Latest {row.latestReview ? format(new Date(row.latestReview.week_start), "MMM d") : "None"}
                </span>
                <span className="eom-review-pill">
                  <TrendIcon trend={row.reviewTrend} />
                  {trendLabel(row.reviewTrend)}
                </span>
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

function EligibilitySummary({
  eligibleCount,
  excludedRows,
}: {
  eligibleCount: number;
  excludedRows: ExcludedEmployee[];
}) {
  return (
    <GlassCard className="eom-eligibility-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={16} className="text-success" />
            EOM eligibility
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Competition scoring only includes employees marked eligible.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <ReviewSummaryTile label="EOM Eligible" value={eligibleCount} />
          <ReviewSummaryTile label="Excluded from EOM" value={excludedRows.length} />
        </div>
      </div>
      {excludedRows.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {excludedRows.map((employee) => (
            <span key={employee.userId} className="eom-excluded-pill">
              <ShieldOff size={12} />
              {employee.name} · {employee.department || employee.position}
            </span>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function AnalyticsPanel({ weekly, rows }: { weekly: any[]; rows: EmployeeRank[] }) {
  const winner = rows[0];
  const pieData = [
    { name: "Progress", value: winner?.taskProgress || 0 },
    { name: "Remaining", value: Math.max(0, 100 - (winner?.taskProgress || 0)) },
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
            <Bar dataKey="taskProgress" fill="#f6c453" radius={[8, 8, 0, 0]} />
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
                <AnalyticsBar label="Task progress" value={row.taskProgress} />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function FeedbackPanel({
  rows,
  selectedEmployeeId,
  setSelectedEmployeeId,
  selectedEmployee,
  officialAward,
  rating,
  setRating,
  feedback,
  setFeedback,
  notes,
  setNotes,
  onSubmit,
  saving,
}: {
  rows: EmployeeRank[];
  selectedEmployeeId: string;
  setSelectedEmployeeId: (value: string) => void;
  selectedEmployee?: EmployeeRank;
  officialAward: any;
  rating: string;
  setRating: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onSubmit: () => Promise<void>;
  saving: boolean;
}) {
  const awardedName = officialAward?.profiles?.full_name;

  return (
    <GlassCard className="eom-feedback">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Medal size={16} className="text-primary" />
        Assign official badge
      </h3>
      <div className="space-y-4">
        {awardedName && (
          <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3 text-sm text-amber-100">
            Current official winner for this month: <span className="font-semibold">{awardedName}</span>
          </div>
        )}
        <div>
          <Label>Employee</Label>
          <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.userId} value={row.userId}>
                  #{rows.findIndex((item) => item.userId === row.userId) + 1} {row.name} · {row.score}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
          <Label>Public employee message</Label>
          <Textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={4}
            placeholder={`Congratulations message for ${selectedEmployee?.name || "the employee"}...`}
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
        <Button onClick={onSubmit} disabled={saving || !selectedEmployee} className="neon-button w-full rounded-xl">
          <Send size={14} className="mr-1.5" />
          {saving ? "Assigning..." : "Assign Employee of the Month"}
        </Button>
      </div>
    </GlassCard>
  );
}

function HrReviewsSection({
  rows,
  selectedEmployee,
}: {
  rows: EmployeeRank[];
  selectedEmployee?: EmployeeRank;
}) {
  const [reviewEmployeeId, setReviewEmployeeId] = useState(selectedEmployee?.userId || rows[0]?.userId || "");
  const [reviewDialogEmployeeId, setReviewDialogEmployeeId] = useState<string | null>(null);
  const reviewRows = rows.flatMap((row) =>
    row.reviews.map((review, index) => ({
      ...review,
      employeeId: row.userId,
      employeeName: row.name,
      department: row.department,
      weekLabel: `Week ${row.reviews.length - index}`,
      scoreValue: resolvedReviewScore(review),
    })),
  );
  const reviewEmployee =
    rows.find((row) => row.userId === reviewEmployeeId) || selectedEmployee || rows[0];
  const selectedReviews = reviewEmployee?.reviews || [];
  const filteredReviewRows = reviewEmployeeId
    ? reviewRows.filter((review) => review.employeeId === reviewEmployeeId)
    : reviewRows;
  const employeesWithReviews = rows.filter((row) => row.reviewCount > 0);
  const dialogEmployee = rows.find((row) => row.userId === reviewDialogEmployeeId);

  const openEmployeeReviews = (employeeId: string) => {
    setReviewEmployeeId(employeeId);
    setReviewDialogEmployeeId(employeeId);
  };

  useEffect(() => {
    if (reviewEmployeeId && rows.some((row) => row.userId === reviewEmployeeId)) return;
    setReviewEmployeeId(selectedEmployee?.userId || rows[0]?.userId || "");
  }, [reviewEmployeeId, rows, selectedEmployee?.userId]);

  return (
    <>
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[.9fr_1.1fr]">
      <GlassCard className="eom-hr-panel">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <MessageSquare size={16} className="text-primary" />
          HR Weekly Reviews
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <ReviewSummaryTile label="Employee" value={reviewEmployee?.name || "None"} />
          <ReviewSummaryTile label="Average HR Rating" value={reviewEmployee ? ratingLabelFromAverage(reviewEmployee.reviewAverage) : "No reviews"} />
          <ReviewSummaryTile label="Total Reviews" value={reviewEmployee?.reviewCount || 0} />
          <ReviewSummaryTile
            label="Latest Review"
            value={reviewEmployee?.latestReview ? reviewEmployee.latestReview.rating : "None"}
          />
          <ReviewSummaryTile
            label="Review Trend"
            value={<span className="inline-flex items-center gap-1"><TrendIcon trend={reviewEmployee?.reviewTrend || "steady"} />{trendLabel(reviewEmployee?.reviewTrend || "steady")}</span>}
          />
        </div>
        <div className="eom-review-timeline-list mt-5 space-y-3">
          {selectedReviews.length ? (
            selectedReviews.map((review, index) => {
              const score = resolvedReviewScore(review);
              return (
                <div key={review.id} className="eom-review-timeline-item">
                  <div className="eom-review-node">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">Week {selectedReviews.length - index}</span>
                      <span className="text-sm text-white/75">{review.rating}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.week_start), "MMM d, yyyy")}
                      </span>
                    </div>
                    <MiniBar label="Review score" value={score * 10} detail={`${score}/10`} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-muted-foreground">
              No HR weekly reviews have been submitted for this employee yet.
            </div>
          )}
        </div>
      </GlassCard>

      <GlassCard className="eom-hr-panel">
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <History size={16} className="text-primary" />
          Review history
        </h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {employeesWithReviews.map((employee) => (
            <button
              key={employee.userId}
              type="button"
              className={`eom-review-employee-pill ${employee.userId === reviewEmployeeId ? "active" : ""}`}
              onClick={() => openEmployeeReviews(employee.userId)}
            >
              {employee.name}
              <span>{employee.reviewCount}</span>
            </button>
          ))}
        </div>
        <div className="eom-review-history-list space-y-3">
          {filteredReviewRows.length ? (
            filteredReviewRows.map((review) => (
              <article key={review.id} className="eom-review-card">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="eom-review-name-button"
                        onClick={() => openEmployeeReviews(review.employeeId)}
                      >
                        {review.employeeName}
                      </button>
                      <span className="eom-review-rating">{review.rating}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.week_start), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{review.department}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold gradient-text">{review.scoreValue}/10</div>
                    <div className="text-[10px] uppercase text-muted-foreground">HR score</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3">
                  <ReviewText label="Strengths" value={review.strengths} />
                  <ReviewText label="Improvements" value={review.improvements} />
                  <ReviewText label="Admin notes" value={review.notes} />
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-muted-foreground">
              HR weekly review history will appear here after submissions.
            </div>
          )}
        </div>
      </GlassCard>
    </section>
    <Dialog open={Boolean(dialogEmployee)} onOpenChange={(open) => !open && setReviewDialogEmployeeId(null)}>
      <DialogContent className="eom-review-dialog max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden border-white/10 bg-background/95 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{dialogEmployee?.name || "Employee"} review history</DialogTitle>
          <DialogDescription>
            Weekly HR reviews for {dialogEmployee?.department || "this employee"}.
          </DialogDescription>
        </DialogHeader>
        <div className="eom-review-dialog-list space-y-3">
          {dialogEmployee?.reviews.length ? (
            dialogEmployee.reviews.map((review, index) => {
              const score = resolvedReviewScore(review);

              return (
                <article key={review.id} className="eom-review-card">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Week {dialogEmployee.reviews.length - index}</span>
                        <span className="eom-review-rating">{review.rating}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(review.week_start), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{dialogEmployee.position}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-xl font-bold gradient-text">{score}/10</div>
                      <div className="text-[10px] uppercase text-muted-foreground">HR score</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    <ReviewText label="Strengths" value={review.strengths} />
                    <ReviewText label="Improvements" value={review.improvements} />
                    <ReviewText label="Admin notes" value={review.notes} />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm text-muted-foreground">
              No HR weekly reviews have been submitted for this employee yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function ReviewSummaryTile({
  label,
  value,
}: {
  label: string;
  value: string | number | ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold text-white">{value}</div>
    </div>
  );
}

function ReviewText({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-2 text-sm text-white/75">{value || "No notes added."}</p>
    </div>
  );
}

function BadgeSection({ winner }: { winner: EmployeeRank }) {
  const badgeRows = [
    { title: "Productivity Hero", icon: Trophy, progress: winner.score, unlocked: winner.score >= 80 },
    { title: "Elite Performer", icon: Crown, progress: winner.score, unlocked: winner.score >= 95 },
    { title: "Progress Champion", icon: Award, progress: winner.taskProgress, unlocked: winner.taskProgress >= 80 },
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
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_24px_rgba(125,92,255,.35)]">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </GlassCard>
  );
}

function AnalyticsBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="eom-analytics-bar mt-3">
      <div className="eom-analytics-bar-label mb-1 flex justify-between text-xs">
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
    <div className="eom-mini-bar">
      <div className="eom-mini-bar-label mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{detail ?? `${Math.round(value)}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function EligibilityBadge({ eligible }: { eligible: boolean }) {
  return (
    <span className={`eom-eligibility-badge ${eligible ? "eligible" : "excluded"}`}>
      {eligible ? <ShieldCheck size={11} /> : <ShieldOff size={11} />}
      {eomEligibilityLabel({ is_eom_eligible: eligible })}
    </span>
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
    <div className={`${className} flex shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_30px_rgba(125,92,255,.4)]`}>
      {initials}
    </div>
  );
}

function TrendIcon({ trend }: { trend: EmployeeRank["reviewTrend"] }) {
  if (trend === "up") return <TrendingUp size={12} className="text-success" />;
  if (trend === "down") return <TrendingDown size={12} className="text-primary" />;
  return <Minus size={12} className="text-muted-foreground" />;
}

function trendLabel(trend: EmployeeRank["reviewTrend"]) {
  if (trend === "up") return "Improving";
  if (trend === "down") return "Needs focus";
  if (trend === "new") return "New";
  return "Steady";
}

function isMissingReviewScoreError(error: { message?: string; details?: string; code?: string }) {
  const text = `${error.message || ""} ${error.details || ""}`;
  return text.includes("review_score") && (text.includes("schema cache") || error.code === "PGRST204");
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
