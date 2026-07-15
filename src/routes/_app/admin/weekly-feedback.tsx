import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Edit3,
  History,
  Loader2,
  LockKeyhole,
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
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { calculateWeightedAttendancePct, resolvedReviewScore, reviewScoreFromRating } from "@/lib/employee-scoring";
import { formatNepaliDate, getCurrentNepaliMonthRange, getWeeklyReviewCyclesForNepaliMonth } from "@/lib/nepali-calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/weekly-feedback")({
  component: WeeklyFeedbackPage,
});

type Rating = "Excellent" | "Good" | "Average" | "Poor";
type WeekStatus = "completed" | "pending" | "missed" | "locked";

type WeeklyFeedbackRow = {
  id: string;
  employee_id: string;
  week_number: number;
  week_start: string;
  nepali_year?: number | null;
  nepali_month?: number | null;
  unlock_date?: string | null;
  rating: string;
  strengths: string | null;
  improvements: string | null;
  admin_notes: string | null;
  notes: string | null;
  score: number;
  review_score: number;
  created_at: string;
  updated_at: string;
};

type EmployeeWeek = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  completedTasks: number;
  overdueTasks: number;
  attendancePct: number;
  score: number;
  totalTasks: number;
  streak: number;
  rank: number;
  trend: number;
  history: WeeklyFeedbackRow[];
};

const ratingOptions: Rating[] = ["Excellent", "Good", "Average", "Poor"];
const REVIEW_UNLOCK_DAY = 2;

function RatingSelector({
  value,
  onChange,
  disabled,
}: {
  value: Rating;
  onChange: (value: Rating) => void;
  disabled?: boolean;
}) {
  const options: { label: Rating; icon: React.ReactNode; colorClass: string }[] = [
    { label: "Excellent", icon: <span className="text-xl">🌟</span>, colorClass: "hover:bg-emerald-50 hover:border-emerald-200 data-[state=active]:text-foreground data-[state=active]:border-transparent data-[state=active]:shadow-sm" },
    { label: "Good", icon: <span className="text-xl">👍</span>, colorClass: "hover:bg-blue-50 hover:border-blue-200 data-[state=active]:text-foreground data-[state=active]:border-transparent data-[state=active]:shadow-sm" },
    { label: "Average", icon: <span className="text-xl">😐</span>, colorClass: "hover:bg-amber-50 hover:border-amber-200 data-[state=active]:text-foreground data-[state=active]:border-transparent data-[state=active]:shadow-sm" },
    { label: "Poor", icon: <span className="text-xl">⚠️</span>, colorClass: "hover:bg-rose-50 hover:border-rose-200 data-[state=active]:text-foreground data-[state=active]:border-transparent data-[state=active]:shadow-sm" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          disabled={disabled}
          data-state={value === opt.label ? "active" : "inactive"}
          style={value === opt.label ? { background: "var(--gradient-brand)" } : {}}
          onClick={() => onChange(opt.label)}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${opt.colorClass}`}
        >
          {opt.icon}
          <span className="text-sm font-semibold">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

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
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const reviewWeeks = useMemo(() => getReviewWeeks(new Date()), []);
  const currentWeekNumber = getCurrentReviewWeek(new Date(), reviewWeeks);
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(currentWeekNumber);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    const weekStartDate = new Date(`${weekStart}T00:00:00`);
    const weekStartIso = weekStartDate.toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const reviewCycleStart = reviewWeeks[0]?.startDate || weekStart;
    const [{ data: profiles }, { data: roleRows }, { data: tasks }, assigneeResult, { data: attendance }, feedbackResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, department, position, avatar_url")
          .eq("approval_status", "approved")
          .eq("is_suspended", false),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
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
          .gte("week_start", subDays(new Date(`${reviewCycleStart}T00:00:00`), 7).toISOString().slice(0, 10))
          .order("week_start", { ascending: false }),
      ]);
    const assignees =
      assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : assigneeResult.data || [];
    const feedback = feedbackResult.error ? [] : feedbackResult.data || [];
    const elapsedDays = Math.max(1, Math.min(7, Math.floor((Date.now() - weekStartDate.getTime()) / 86400000) + 1));
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeProfiles = (profiles || []).filter(
      (profile) => !adminUserIds.has(profile.user_id) && !isHrProfile(profile),
    );

    const ranked = employeeProfiles
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
        const attendancePct = calculateWeightedAttendancePct(employeeAttendance, elapsedDays);
        const score = productivityScore({
          completed: completedTasks,
          total: Math.max(assignedTasks.length, completedTasks),
          onTimeRate: assignedTasks.length ? Math.max(0, 1 - overdueTasks / assignedTasks.length) : 1,
          hours,
          targetHours: 40,
        });
        const history = feedback.filter((item: WeeklyFeedbackRow) => item.employee_id === profile.user_id);
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
          totalTasks: assignedTasks.length,
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
  const selectedHistory = selected?.history || [];
  const selectedWeek = reviewWeeks.find((week) => week.weekNumber === selectedWeekNumber) || reviewWeeks[0];
  const selectedWeekReview = selectedHistory.find((item) =>
    (item.nepali_year === selectedWeek.bsYear && item.nepali_month === selectedWeek.bsMonth && item.week_number === selectedWeekNumber) ||
    (!item.nepali_year && getFeedbackWeekNumber(item) === selectedWeekNumber && isSameReviewCycle(item.week_start, selectedWeek?.startDate))
  );
  const completedWeeks = reviewWeeks.filter((week) =>
    selectedHistory.some((item) => 
      (item.nepali_year === week.bsYear && item.nepali_month === week.bsMonth && item.week_number === week.weekNumber) ||
      (!item.nepali_year && getFeedbackWeekNumber(item) === week.weekNumber && isSameReviewCycle(item.week_start, week.startDate))
    )
  ).length;
  const selectedWeekStatus = getWeekStatus(selectedWeek, Boolean(selectedWeekReview));
  const selectedWeekLocked = selectedWeekStatus === "locked";
  const canEditSelectedReview = Boolean(selectedWeekReview && editingReviewId === selectedWeekReview.id);
  const formLocked = selectedWeekLocked || (Boolean(selectedWeekReview) && !canEditSelectedReview);
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
  const selectedTaskCompletion = selected
    ? Math.min(100, Math.round((selected.completedTasks / Math.max(1, selected.totalTasks || selected.completedTasks)) * 100))
    : 0;
  const teamAverageScore = average(rows.map((row) => row.score));
  const currentTrendRow = {
    week: `W${currentWeekNumber}`,
    weekLabel: `Current week`,
    score: selected?.score || 0,
    attendance: selected?.attendancePct || 0,
    taskCompletion: selectedTaskCompletion,
    status: performanceStatus(selected?.score || 0),
    teamAverage: teamAverageScore,
  };
  const historyTrendRows = selectedHistory
    .slice()
    .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
    .slice(-4)
    .map((review, index, history) => {
      const score = resolvedReviewScore(review);
      const progressFactor = history.length <= 1 ? 1 : index / (history.length - 1);
      return {
        week: `W${getFeedbackWeekNumber(review)}`,
        weekLabel: `${formatNepaliDate(review.week_start, "DD MMM YYYY")} BS`,
        score,
        attendance: Math.max(0, Math.min(100, Math.round((selected?.attendancePct || 0) - (history.length - 1 - index) * 4))),
        taskCompletion: Math.max(0, Math.min(100, Math.round(selectedTaskCompletion - (1 - progressFactor) * 12))),
        status: performanceStatus(score),
        teamAverage: teamAverageScore,
      };
    });
  const trendRows = [...historyTrendRows, currentTrendRow]
    .filter((row, index, list) => list.findIndex((item) => item.week === row.week) === index)
    .slice(-5);
  const previousTrendRow = trendRows.length > 1 ? trendRows[trendRows.length - 2] : null;
  const weeklyGrowth = previousTrendRow?.score
    ? Math.round(((currentTrendRow.score - previousTrendRow.score) / Math.max(1, previousTrendRow.score)) * 100)
    : 0;
  const highPoint = trendRows.reduce((best, row) => (row.score > best.score ? row : best), trendRows[0] || currentTrendRow);
  const lowPoint = trendRows.reduce((worst, row) => (row.score < worst.score ? row : worst), trendRows[0] || currentTrendRow);
  const trendDirection = currentTrendRow.score >= (previousTrendRow?.score ?? currentTrendRow.score);
  const aiInsight = selected
    ? makeWeeklyProgressInsight(selected.name, currentTrendRow.score, weeklyGrowth, selected.attendancePct, selectedTaskCompletion)
    : "Select an employee to view weekly progress insight.";
  const currentReviewWeek = reviewWeeks.find((week) => week.weekNumber === currentWeekNumber);
  const reviewedThisWeek = feedbackRows.filter(
    (row) =>
      getFeedbackWeekNumber(row) === currentWeekNumber &&
      isSameReviewCycle(row.week_start, currentReviewWeek?.startDate),
  ).length;
  const totalReviews = feedbackRows.length;
  const avgHrRating = average(
    feedbackRows.map((row) => resolvedReviewScore(row)),
  );
  const lastReviewed = feedbackRows[0]?.created_at
    ? `${formatNepaliDate(feedbackRows[0].created_at, "DD MMM")} BS`
    : "None";

  useEffect(() => {
    setEditingReviewId(null);
    if (selectedWeekReview) {
      setRating((selectedWeekReview.rating as Rating) || "Excellent");
      setStrengths(selectedWeekReview.strengths || "");
      setImprovements(selectedWeekReview.improvements || "");
      setGoals(selectedWeekReview.admin_notes || "");
      setNotes(selectedWeekReview.notes || "");
      return;
    }
    setRating("Excellent");
    setStrengths("");
    setImprovements("");
    setGoals("");
    setNotes("");
  }, [
    selectedId,
    selectedWeekNumber,
    selectedWeekReview?.id,
    selectedWeekReview?.rating,
    selectedWeekReview?.strengths,
    selectedWeekReview?.improvements,
    selectedWeekReview?.admin_notes,
    selectedWeekReview?.notes,
  ]);

  const saveFeedback = async () => {
    if (!user || !selected || !selectedWeek) return;
    if (selectedWeekLocked) {
      toast.error(`Week ${selectedWeekNumber} is locked until that week starts`);
      return;
    }
    setSaving(true);
    const reviewPayload = {
      employee_id: selected.userId,
      admin_id: user.id,
      week_start: selectedWeek.startDate,
      week_number: selectedWeek.weekNumber,
      nepali_year: selectedWeek.bsYear,
      nepali_month: selectedWeek.bsMonth,
      unlock_date: selectedWeek.unlockDate,
      rating,
      strengths,
      improvements,
      notes,
      admin_notes: goals,
      score: selected.score,
      review_score: reviewScoreFromRating(rating),
    };

    if (selectedWeekReview && editingReviewId !== selectedWeekReview.id) {
      setSaving(false);
      toast.error(`Week ${selectedWeekNumber} review already submitted`);
      return;
    }

    const existingResult = await (supabase as any)
      .from("weekly_feedback")
      .select("id")
      .eq("employee_id", selected.userId)
      .eq("week_start", selectedWeek.startDate)
      .maybeSingle();

    if (!editingReviewId && existingResult.data) {
      setSaving(false);
      toast.error(`Week ${selectedWeekNumber} review already submitted`);
      return;
    }

    const result = editingReviewId
      ? await (supabase as any)
          .from("weekly_feedback")
          .update(reviewPayload)
          .eq("id", editingReviewId)
      : await (supabase as any).from("weekly_feedback").insert(reviewPayload);
    const { review_score: _reviewScore, week_number: _weekNumber, admin_notes: _adminNotes, ...legacyReviewPayload } = reviewPayload;
    const fallbackResult =
      result.error && isMissingWeeklyFeedbackColumnError(result.error)
        ? editingReviewId
          ? await (supabase as any)
              .from("weekly_feedback")
              .update(legacyReviewPayload)
              .eq("id", editingReviewId)
          : await (supabase as any).from("weekly_feedback").insert(legacyReviewPayload)
        : result;
    setSaving(false);
    if (fallbackResult.error) return toast.error(fallbackResult.error.message);
    toast.success(editingReviewId ? "Weekly review updated" : "Weekly feedback saved");
    setEditingReviewId(null);
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
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <WeeklyStat label="Employees" value={rows.length} icon={UserCheck} />
          <WeeklyStat label="Reviewed this week" value={reviewedThisWeek} icon={MessageSquare} />
          <WeeklyStat label="Total reviews" value={totalReviews} icon={History} />
          <WeeklyStat label="Avg HR rating" value={avgHrRating || 0} icon={Crown} />
          <WeeklyStat label="Last reviewed" value={lastReviewed} icon={CalendarDays} />
        </section>

        <section>
          <GlassCard className="weekly-feedback-panel">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
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
              <div className="weekly-feedback-queue-count">
                {filtered.length} employees
              </div>
            </div>
            <div className="weekly-employee-grid">
              {filtered.map((employee) => (
                <EmployeeCard
                  key={employee.userId}
                  employee={employee}
                  active={selected?.userId === employee.userId}
                  onClick={() => {
                    setSelectedId(employee.userId);
                    setFeedbackDialogOpen(true);
                  }}
                />
              ))}
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                <Bar dataKey="score" fill="#ff2d6f" radius={[8, 8, 0, 0]} />
                <Bar dataKey="attendance" fill="#21d4fd" radius={[8, 8, 0, 0]} />
                <Bar dataKey="tasks" fill="#f6c453" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard className="weekly-feedback-panel">
            <div className="weekly-progress-chart-header">
              <div>
                <h3 className="flex items-center gap-2 font-semibold">
                  <TrendingUp size={16} className="text-primary" />
                  Employee weekly progress
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">Score, attendance, target, and team comparison</p>
              </div>
              <div className={`weekly-trend-chip ${trendDirection ? "up" : "down"}`}>
                {trendDirection ? "↗ Improving" : "↘ Declining"}
                <span>{weeklyGrowth >= 0 ? "+" : ""}{weeklyGrowth}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trendRows} margin={{ top: 8, right: 10, bottom: 2, left: -12 }}>
                <defs>
                  <linearGradient id="weeklyTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#ff2d6f" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <ReferenceArea y1={0} y2={50} fill="#ff2d6f" fillOpacity={0.08} />
                <ReferenceArea y1={51} y2={75} fill="#f6c453" fillOpacity={0.07} />
                <ReferenceArea y1={76} y2={100} fill="#22c55e" fillOpacity={0.08} />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <Tooltip content={<WeeklyProgressTooltip />} />
                <ReferenceLine y={80} stroke="#f6c453" strokeDasharray="6 6" strokeWidth={1.5} />
                <ReferenceLine y={teamAverageScore} stroke="#8b5cf6" strokeDasharray="4 5" strokeOpacity={0.7} />
                <Area type="monotone" dataKey="score" fill="url(#weeklyTrend)" stroke="none" isAnimationActive animationDuration={900} />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Performance Score"
                  stroke="#ff2d6f"
                  strokeWidth={3}
                  dot={(props) => <PerformanceDot {...props} highWeek={highPoint.week} lowWeek={lowPoint.week} />}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "#f1f0ee" }}
                  isAnimationActive
                  animationDuration={900}
                />
                <Line
                  type="monotone"
                  dataKey="attendance"
                  name="Attendance %"
                  stroke="#21d4fd"
                  strokeWidth={2.4}
                  dot={{ r: 3, fill: "#21d4fd", stroke: "#07111f", strokeWidth: 1 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#f1f0ee" }}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Line
                  type="monotone"
                  dataKey="taskCompletion"
                  name="Task Completion %"
                  stroke="#f6c453"
                  strokeWidth={1.8}
                  strokeOpacity={0.85}
                  dot={false}
                  isAnimationActive
                  animationDuration={1000}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="weekly-zone-legend">
              <span><i className="target" />Target 80</span>
              <span><i className="team" />Team avg {teamAverageScore}</span>
              <span><i className="needs" />0-50 Needs improvement</span>
              <span><i className="average" />51-75 Average</span>
              <span><i className="excellent" />76-100 Excellent</span>
            </div>
            <div className="weekly-ai-insight">
              <Sparkles size={14} />
              <span>{aiInsight}</span>
            </div>
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
              Review history timeline
            </h3>
            <div className="space-y-3">
              {reviewWeeks.map((week) => {
                const review = selectedHistory.find((item) =>
                  getFeedbackWeekNumber(item) === week.weekNumber && isSameReviewCycle(item.week_start, week.startDate),
                );
                const status = getWeekStatus(week, Boolean(review));
                return (
                  <div key={week.weekNumber} className={`weekly-history-item ${status}`}>
                    <div className="weekly-history-dot" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">Week {week.weekNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {review?.rating || labelForWeekStatus(status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {review
                          ? review.strengths || review.improvements || review.admin_notes || review.notes || "No notes added."
                          : `${labelForWeekStatus(status)} review`}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                );
              })}
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
      <Dialog open={feedbackDialogOpen && Boolean(selected)} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="flex max-h-[95vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl border-border bg-background p-0 shadow-2xl sm:flex-row">
          {selected && (
            <>
              {/* LEFT COLUMN: Form & Header (70%) */}
              <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/50">
                
                {/* Scrollable Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {/* Premium Header */}
                  <header className="flex flex-col gap-6 border-b border-border bg-card p-6 md:p-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar employee={selected} size="lg" />
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">{selected.name}</h2>
                          <p className="text-sm font-medium text-muted-foreground">{selected.department}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start gap-2 text-left md:items-end md:text-right">
                        <StatusBadge status={selectedWeekStatus} />
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          Week {selectedWeekNumber} Review • {formatNepaliDate(new Date().toISOString(), "DD MMM YYYY")} BS
                        </div>
                      </div>
                    </div>

                    {/* Animated Progress Bar */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span className="text-slate-700 dark:text-slate-300">Review Cycle Progress</span>
                        <span className="text-primary">{Math.round((completedWeeks / reviewWeeks.length) * 100)}% ({completedWeeks} of {reviewWeeks.length} Completed)</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-out"
                          style={{ width: `${(completedWeeks / reviewWeeks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </header>

                  {/* Main Form Area */}
                  <div className="p-6 pb-16 md:p-8">
                    {/* Summary Metrics (moved above form) */}
                    <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
                      <MiniMetric label="Score" value={selected.score} icon={Zap} />
                      <MiniMetric label="Tasks" value={selected.completedTasks} icon={CheckCircle2} />
                      <MiniMetric label="Overdue" value={selected.overdueTasks} icon={ShieldAlert} />
                      <MiniMetric label="Attendance" value={`${selected.attendancePct}%`} icon={CalendarDays} />
                    </div>

                    {/* Horizontal Stepper Navigation */}
                    <div className="hide-scrollbar mb-10 flex items-center gap-2 overflow-x-auto pb-4">
                      {reviewWeeks.map((week, idx) => {
                        const review = selectedHistory.find((item) =>
                          getFeedbackWeekNumber(item) === week.weekNumber && isSameReviewCycle(item.week_start, week.startDate)
                        );
                        const status = getWeekStatus(week, Boolean(review));
                        const isSelected = selectedWeekNumber === week.weekNumber;
                        
                        let colors = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
                        let customStyle = {};
                        let icon = null;
                        if (status === "completed") {
                          colors = "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/40 dark:text-emerald-400";
                          icon = <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />;
                        } else if (status === "pending" || isSelected) {
                          if (isSelected) {
                            colors = "text-foreground shadow-sm ring-1 ring-border";
                            customStyle = { background: "var(--gradient-brand)" };
                          } else {
                            colors = "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800/30 dark:bg-indigo-900/30 dark:text-indigo-400";
                          }
                        } else if (status === "locked") {
                          colors = "cursor-not-allowed bg-slate-100 text-slate-400 opacity-70 dark:bg-slate-900 dark:text-slate-600";
                          icon = <LockKeyhole size={14} />;
                        }

                        return (
                          <div key={week.weekNumber} className="flex shrink-0 items-center">
                            <button
                              type="button"
                              onClick={() => status !== "locked" && setSelectedWeekNumber(week.weekNumber)}
                              disabled={status === "locked"}
                              style={customStyle}
                              className={`flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-transparent px-4 py-2 transition-all ${colors} ${status !== "locked" ? "active:scale-95 hover:scale-105" : ""}`}
                            >
                              {icon}
                              <span className="text-sm font-bold tracking-wide">
                                Week {week.weekNumber}
                              </span>
                            </button>
                            {idx < reviewWeeks.length - 1 && (
                              <div className="mx-2 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                <ChevronRight size={16} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Form Content */}
                    {selectedWeekLocked ? (
                      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center dark:border-slate-800 dark:bg-slate-900/50">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800">
                          <LockKeyhole size={32} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Review Locked</h3>
                          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                            This review is currently locked. It will automatically become available on {selectedWeek?.unlockDate ? `Wednesday, ${formatNepaliDate(new Date(`${selectedWeek.unlockDate}T00:00:00`).toISOString(), "DD MMM YYYY")} BS` : "the coming Wednesday"}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-8">
                        {/* Read Only Details Component */}
                        {selectedWeekReview && !canEditSelectedReview && (
                          <ReviewDetails
                            review={selectedWeekReview}
                            weekNumber={selectedWeekNumber}
                            onEdit={() => setEditingReviewId(selectedWeekReview.id)}
                          />
                        )}

                        {/* Editable Form */}
                        {(!selectedWeekReview || canEditSelectedReview) && (
                          <div className="flex flex-col gap-8">
                            <div>
                              <Label className="mb-3 block text-sm font-bold text-foreground">Overall Weekly Rating</Label>
                              <RatingSelector value={rating} onChange={setRating} disabled={formLocked} />
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                              <div>
                                <Label className="mb-2 flex items-center gap-2 text-sm font-bold text-emerald-600">
                                  <TrendingUp size={16} />
                                  Strengths
                                </Label>
                                <Textarea
                                  value={strengths}
                                  onChange={(event) => setStrengths(event.target.value)}
                                  disabled={formLocked}
                                  rows={5}
                                  placeholder="What went especially well this week? Describe achievements, technical contributions, teamwork..."
                                  className="resize-none rounded-xl border-emerald-100 bg-emerald-50/30 p-4 leading-relaxed shadow-sm focus-visible:ring-emerald-500 dark:border-emerald-900/30 dark:bg-emerald-950/20"
                                />
                              </div>
                              <div>
                                <Label className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-500">
                                  <Target size={16} />
                                  Areas for Improvement
                                </Label>
                                <Textarea
                                  value={improvements}
                                  onChange={(event) => setImprovements(event.target.value)}
                                  disabled={formLocked}
                                  rows={5}
                                  placeholder="What should improve next week? Mention blockers, challenges, communication issues..."
                                  className="resize-none rounded-xl border-orange-100 bg-orange-50/30 p-4 leading-relaxed shadow-sm focus-visible:ring-orange-500 dark:border-orange-900/30 dark:bg-orange-950/20"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                <Sparkles size={16} />
                                Goals for Next Week
                              </Label>
                              <Textarea
                                value={goals}
                                onChange={(event) => setGoals(event.target.value)}
                                disabled={formLocked}
                                rows={4}
                                placeholder="Define measurable goals and objectives for next week..."
                                className="resize-none rounded-xl border-indigo-100 bg-indigo-50/30 p-4 leading-relaxed shadow-sm focus-visible:ring-indigo-500 dark:border-indigo-900/30 dark:bg-indigo-950/20"
                              />
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                              <Label className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-2">
                                  <LockKeyhole size={14} />
                                  Private Admin Notes
                                </div>
                                <span className="text-xs font-normal text-slate-500">Visible only to HR/Admins</span>
                              </Label>
                              <Textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                disabled={formLocked}
                                rows={3}
                                placeholder="Internal notes visible only to administrators and HR..."
                                className="mt-3 resize-none rounded-lg bg-white p-4 leading-relaxed dark:bg-slate-950"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fixed Footer */}
                {(!selectedWeekLocked && (!selectedWeekReview || canEditSelectedReview)) && (
                  <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-background/80 p-4 backdrop-blur-md">
                    <Button 
                      variant="outline"
                      onClick={() => setFeedbackDialogOpen(false)}
                      className="rounded-xl px-6"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={saveFeedback} 
                      disabled={saving || formLocked} 
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 text-white shadow-lg transition-all hover:brightness-110 hover:shadow-xl"
                    >
                      {canEditSelectedReview ? <Edit3 size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
                      {saving ? "Saving..." : canEditSelectedReview ? "Update Review" : `Submit Week ${selectedWeekNumber} Review`}
                    </Button>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Review History (30%) */}
              <aside className="flex w-full flex-col border-l border-border bg-card sm:max-w-md">
                <div className="flex items-center justify-between border-b border-border p-6">
                  <div className="flex items-center gap-2">
                    <History size={18} className="text-slate-500" />
                    <h3 className="font-bold">Review History</h3>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">{completedWeeks} / {reviewWeeks.length}</div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex flex-col gap-3">
                    {reviewWeeks.map((week) => {
                      const review = selectedHistory.find((item) =>
                        getFeedbackWeekNumber(item) === week.weekNumber && isSameReviewCycle(item.week_start, week.startDate)
                      );
                      const status = getWeekStatus(week, Boolean(review));
                      
                      return (
                        <div 
                          key={week.weekNumber}
                          onClick={() => setSelectedWeekNumber(week.weekNumber)}
                          className={`group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md ${selectedWeekNumber === week.weekNumber ? "border-indigo-500 bg-indigo-50/30 dark:border-indigo-500/50 dark:bg-indigo-900/10" : "border-border bg-background hover:border-slate-300 dark:hover:border-slate-700"}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-foreground">Week {week.weekNumber}</h4>
                                {status === "completed" && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">Completed</span>}
                                {status === "missed" && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-400">Missed</span>}
                                {status === "pending" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">Pending</span>}
                                {status === "locked" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-400"><LockKeyhole size={10} className="inline mr-1" />Locked</span>}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {review ? formatNepaliDate(review.created_at, "DD MMM YYYY") + " BS" : week.startDate}
                              </p>
                            </div>
                          </div>
                          
                          {review && (
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="text-[10px] uppercase text-muted-foreground">Rating</span>
                                  <span className="text-sm font-semibold">{review.rating}</span>
                                </div>
                                <div className="h-6 w-px bg-border" />
                                <div className="flex flex-col">
                                  <span className="text-[10px] uppercase text-muted-foreground">Score</span>
                                  <span className="text-sm font-semibold">{review.score}/100</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center text-sm font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                                View <ChevronRight size={16} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </>
          )}
        </DialogContent>
      </Dialog>
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
      <div className="weekly-employee-card-glow" />
      <div className="weekly-employee-card-top">
        <Avatar employee={employee} />
        <div className="weekly-employee-identity">
          <div className="weekly-employee-name">{employee.name}</div>
          <div className="weekly-employee-department">{employee.department}</div>
        </div>
        <div className={`weekly-employee-rank ${employee.rank <= 3 ? "top" : ""}`}>
          #{employee.rank}
        </div>
      </div>
      <div className="weekly-employee-metrics">
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
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">
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
    <div className="rounded-2xl border border-border bg-card p-3">
      <Icon size={15} className="mb-2 text-primary" />
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ProgressMetric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="weekly-progress-metric">
      <div className="weekly-progress-label">
        <span>{label}</span>
        <span>{detail ?? `${value}%`}</span>
      </div>
      <div className="weekly-progress-track">
        <div className="weekly-progress" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function ReviewDetails({
  review,
  weekNumber,
  onEdit,
}: {
  review: WeeklyFeedbackRow;
  weekNumber: number;
  onEdit: () => void;
}) {
  return (
    <div className="weekly-review-details">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Existing review details</div>
          <div className="mt-1 text-lg font-bold">Week {weekNumber} review already submitted</div>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onEdit} className="rounded-xl">
          <Edit3 size={14} className="mr-1.5" />
          Edit Review
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ReviewDetail label="Rating" value={review.rating} />
        <ReviewDetail label="Score" value={resolvedReviewScore(review)} />
        <ReviewDetail label="Submission date" value={`${formatNepaliDate(review.created_at, "DD MMM YYYY")} BS`} />
        <ReviewDetail label="Strengths" value={review.strengths || "No strengths added."} />
        <ReviewDetail label="Improvements" value={review.improvements || "No improvements added."} />
        <ReviewDetail label="Notes" value={review.admin_notes || review.notes || "No notes added."} />
      </div>
    </div>
  );
}

function ReviewDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">{value}</div>
    </div>
  );
}

function CompactReviewCard({
  weekNumber,
  weekStatus,
  reviewWeeks,
  review,
}: {
  weekNumber: number;
  weekStatus: WeekStatus;
  reviewWeeks: any[];
  review?: WeeklyFeedbackRow;
}) {
  const score = review ? resolvedReviewScore(review) : null;
  return (
    <div className={`weekly-review-card ${review ? "completed" : "pending"}`}>
      <div className="weekly-review-card-marker" />
      <div className="weekly-review-card-main">
        <div className="min-w-0">
          <div className="weekly-review-card-kicker">Week {weekNumber}{weekStatus === "locked" && ` • Available ${reviewWeeks.find(w => w.weekNumber === weekNumber)?.unlockDate}`}</div>
          <div className="weekly-review-card-title">{review?.rating || "Pending"}</div>
          <div className="weekly-review-card-date">
            {review ? `${formatNepaliDate(review.created_at, "DD MMM YYYY")} BS` : "No review yet"}
          </div>
        </div>
        <div className={`weekly-review-score ${review ? "completed" : "pending"}`}>
          {score ?? "--"}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: WeekStatus }) {
  return (
    <span className={`weekly-status-badge ${status}`}>
      <WeekStatusIcon status={status} />
      {status === "completed" ? "Completed" : status === "locked" ? "Locked" : status === "missed" ? "Missed" : "Pending"}
    </span>
  );
}

function WeekStatusIcon({ status }: { status: WeekStatus }) {
  if (status === "completed") return <CheckCircle2 size={14} />;
  if (status === "locked") return <LockKeyhole size={14} />;
  return <Clock3 size={14} />;
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
    <img src={employee.avatarUrl} alt="" className={`${className} shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-800`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-indigo-50 font-bold text-indigo-700 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20`}>
      {initials}
    </div>
  );
}

function WeeklyProgressTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="weekly-progress-tooltip">
      <div className="weekly-progress-tooltip-week">{row.weekLabel || row.week}</div>
      <div className="weekly-progress-tooltip-row">
        <span>Performance Score</span>
        <b>{Math.round(row.score)}</b>
      </div>
      <div className="weekly-progress-tooltip-row">
        <span>Attendance</span>
        <b>{Math.round(row.attendance)}%</b>
      </div>
      <div className="weekly-progress-tooltip-row">
        <span>Task Completion</span>
        <b>{Math.round(row.taskCompletion)}%</b>
      </div>
      <div className="weekly-progress-tooltip-status">
        {row.status}
      </div>
    </div>
  );
}

function PerformanceDot(props: any) {
  const { cx, cy, payload, highWeek, lowWeek } = props;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  const isHigh = payload?.week === highWeek;
  const isLow = payload?.week === lowWeek;
  const fill = isHigh ? "#22c55e" : isLow ? "#ff2d6f" : "#ff7ab3";
  const radius = isHigh || isLow ? 5.8 : 3.6;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fill}
      stroke={isHigh || isLow ? "#f1f0ee" : "#07111f"}
      strokeWidth={isHigh || isLow ? 2 : 1}
      className={isHigh || isLow ? "weekly-highlight-dot" : ""}
    />
  );
}

function average(values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
}

function performanceStatus(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 76) return "Good";
  if (score >= 51) return "Average";
  return "Needs Improvement";
}

function makeWeeklyProgressInsight(name: string, score: number, growth: number, attendance: number, taskCompletion: number) {
  const firstName = name.split(" ")[0] || "Employee";
  if (score >= 80 && growth >= 0) {
    return `${firstName} is above target with ${growth >= 0 ? "+" : ""}${growth}% weekly growth, strong attendance, and ${taskCompletion}% task completion.`;
  }
  if (attendance < 70) {
    return `${firstName}'s performance needs attendance focus this week; improving consistency should lift the overall score.`;
  }
  if (taskCompletion < 60) {
    return `${firstName} is active but task completion is behind pace, so managers should review blockers early.`;
  }
  if (growth < 0) {
    return `${firstName} is declining by ${Math.abs(growth)}% versus last week; check workload balance and overdue tasks.`;
  }
  return `${firstName} is trending steadily with a ${score}/100 score and balanced attendance-performance movement.`;
}

function getCurrentReviewWeek(date: Date, cycles: any[]) {
  const today = format(date, "yyyy-MM-dd");
  const current = [...cycles].reverse().find(c => c.unlockDate <= today);
  return current?.weekNumber || 1;
}

function getReviewWeeks(date: Date) {
  const cycles = getWeeklyReviewCyclesForNepaliMonth(date);
  return cycles.map((cycle, index) => {
    const endDate = cycles[index + 1] ? new Date(cycles[index + 1].unlockDate) : new Date(cycle.unlockDate);
    if (cycles[index + 1]) endDate.setDate(endDate.getDate() - 1);
    else endDate.setDate(endDate.getDate() + 6);
    return {
      weekNumber: cycle.weekNumber,
      unlockDate: cycle.unlockDate,
      startDate: cycle.startDate,
      endDate: toDateKey(endDate),
      bsYear: cycle.bsYear,
      bsMonth: cycle.bsMonth,
    };
  });
}

function getReviewWeekNumber(date: Date) {
  // Legacy fallback
  const cycleStart = getReviewCycleStart(date);
  const secondWeekStart = nextWeekdayAfter(cycleStart, REVIEW_UNLOCK_DAY);
  const weekStarts = Array.from({ length: 4 }).map((_, index) => {
    if (index === 0) return new Date(cycleStart);
    const startDate = new Date(secondWeekStart);
    startDate.setDate(secondWeekStart.getDate() + (index - 1) * 7);
    return startDate;
  });
  const today = startOfDay(date).getTime();
  let currentWeekIndex = -1;
  for (let i = weekStarts.length - 1; i >= 0; i--) {
    if (weekStarts[i].getTime() <= today) {
      currentWeekIndex = i;
      break;
    }
  }
  return Math.min(4, Math.max(1, currentWeekIndex + 1));
}

function getReviewCycleStart(date: Date) {
  const monthStart = getCurrentNepaliMonthRange(date).startAd;
  return startOfDay(new Date(`${monthStart}T00:00:00`));
}

function nextWeekdayAfter(date: Date, weekday: number) {
  const next = new Date(date);
  const daysUntilWeekday = (weekday - next.getDay() + 7) % 7 || 7;
  next.setDate(next.getDate() + daysUntilWeekday);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getFeedbackWeekNumber(review: Pick<WeeklyFeedbackRow, "week_number" | "week_start">) {
  return getReviewWeekNumber(new Date(`${review.week_start}T00:00:00`));
}

function isSameReviewCycle(reviewDate: string, weekStart?: string) {
  if (!weekStart) return false;
  const reviewCycleStart = toDateKey(getReviewCycleStart(new Date(`${reviewDate}T00:00:00`)));
  const weekCycleStart = toDateKey(getReviewCycleStart(new Date(`${weekStart}T00:00:00`)));
  return reviewCycleStart === weekCycleStart;
}

function isHrProfile(profile: { department?: string | null; position?: string | null }) {
  const text = `${profile.department || ""} ${profile.position || ""}`.toLowerCase();
  return /\bhr\b/.test(text) || text.includes("human resources");
}

function getWeekStatus(week: any, completed: boolean): WeekStatus {
  if (completed) return "completed";
  const today = format(new Date(), "yyyy-MM-dd");
  if (week.unlockDate > today) return "locked";
  return "pending";
}

function labelForWeekStatus(status: WeekStatus) {
  if (status === "completed") return "Completed";
  if (status === "locked") return "Future week";
  if (status === "missed") return "Missed";
  return "Pending";
}

function isMissingWeeklyFeedbackColumnError(error: { message?: string; details?: string; code?: string }) {
  const text = `${error.message || ""} ${error.details || ""}`;
  return (
    (text.includes("review_score") || text.includes("week_number") || text.includes("admin_notes")) &&
    (text.includes("schema cache") || error.code === "PGRST204")
  );
}

const tooltipStyle = {
  background: "oklch(0.18 0.025 265)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  color: "white",
};

const tooltipItemStyle = { color: "white" };
