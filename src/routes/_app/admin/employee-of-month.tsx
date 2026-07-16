import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Crown,
  Flame,
  Gem,
  History,
  Loader2,
  Lock,
  Medal,
  MessageSquare,
  Minus,
  PartyPopper,
  Rocket,
  Search,
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { differenceInCalendarDays } from "date-fns";
import { getNepaliMonthRange, getNepaliMonthLabel, formatNepaliDate } from "@/lib/nepali-calendar";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  calculateStandupScore,
  calculateTaskProgressMetrics,
  calculateWeightedAttendancePct,
  ratingLabelFromAverage,
  resolvedReviewScore,
  TASK_COMPLEXITY_DESCRIPTIONS,
  TASK_COMPLEXITY_LABELS,
  TASK_COMPLEXITY_POINTS,
  normalizedTaskComplexity,
  type TaskComplexity,
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
  effortPoints: number;
  earnedEffortPoints: number;
  completedEffortPoints: number;
  effortProgress: number;
  effortCompletion: number;
  normalizedPerformanceScore: number;
  departmentRank: number;
  complexityBreakdown: Record<TaskComplexity, number>;
  activeTasks: number;
  completionTrend: number;
  completedTaskContribution: number;
  dailyImprovement: number;
  completedTasks: number;
  totalTasks: number;
  overdueTasks: number;
  overduePenalty: number;
  attendancePct: number;
  standupScore: number;
  standupSubmittedDays: number;
  standupSubmissionRate: number;
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
const EOM_DEPARTMENTS = ["Development", "UI/UX", "Marketing", "HR", "QA"] as const;
const DEPARTMENT_FILTERS = ["All Departments", ...EOM_DEPARTMENTS] as const;
type DepartmentFilter = (typeof DEPARTMENT_FILTERS)[number];
type RecognitionType = "employee_of_month" | "emerging_employee";
type OfficialAward = {
  employee_id: string;
  month_start: string;
  score: number;
  rating: string;
  public_message: string | null;
  internal_notes: string | null;
  profiles?: {
    user_id: string;
    full_name: string;
    department: string | null;
    avatar_url: string | null;
  } | null;
};

function isDateInRange(value: string | null | undefined, startIso: string, endIso: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(startIso).getTime() && time <= new Date(endIso).getTime();
}

function formatDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isTaskRelevantForMonth(task: any, startIso: string, endIso: string) {
  const createdInMonth = isDateInRange(task.created_at, startIso, endIso);
  const completedInMonth = isDateInRange(task.completed_at || task.updated_at, startIso, endIso);
  const dueInMonth = isDateInRange(task.deadline, startIso, endIso);
  const openDuringMonth =
    task.status !== "completed" &&
    (!task.created_at || new Date(task.created_at).getTime() <= new Date(endIso).getTime());

  return createdInMonth || completedInMonth || dueInMonth || openDuringMonth;
}

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
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRank[]>([]);
  const [excludedRows, setExcludedRows] = useState<ExcludedEmployee[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [rating, setRating] = useState("excellent");
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [recognitionType, setRecognitionType] = useState<RecognitionType>("employee_of_month");
  const [successAward, setSuccessAward] = useState<{ employee: string; badge: string; type: RecognitionType } | null>(null);
  const [recognitionDialogOpen, setRecognitionDialogOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>("All Departments");
  const [officialAwards, setOfficialAwards] = useState<OfficialAward[]>([]);
  const [savingAward, setSavingAward] = useState(false);
  const [resettingAward, setResettingAward] = useState(false);

  const nepaliMonth = getNepaliMonthRange(-1);
  const monthStart = nepaliMonth.startAd;
  const monthEnd = nepaliMonth.endAd;

  const loadEomData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      const monthStartIso = `${monthStart}T00:00:00.000Z`;
      const monthEndIso = `${monthEnd}T23:59:59.999Z`;
      const today = new Date().toISOString().slice(0, 10);
      const effectiveEnd = today < monthEnd ? today : monthEnd;
      const monthStartDate = new Date(`${monthStart}T00:00:00`);
      const effectiveEndDate = new Date(`${effectiveEnd}T00:00:00`);
      const [
        { data: profiles },
        { data: roleRows },
        { data: tasks },
        assigneeResult,
        { data: attendance },
        { data: standups },
        feedbackResult,
        progressResult,
      ] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, department, position, avatar_url, is_eom_eligible")
            .eq("approval_status", "approved")
            .eq("is_suspended", false),
          supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
          supabase.from("tasks").select("*"),
          supabase.from("task_assignees").select("task_id,user_id"),
          supabase
            .from("attendance")
            .select("user_id,date,status,work_hours")
            .gte("date", monthStart)
            .lte("date", effectiveEnd),
          supabase
            .from("standups")
            .select("user_id,date,yesterday,today,blockers,work_hours")
            .gte("date", monthStart)
            .lte("date", effectiveEnd),
          fetchWeeklyReviews(),
          (supabase as any)
            .from("task_progress_updates")
            .select("task_id,old_progress,new_progress,created_at")
            .gte("created_at", monthStartIso)
            .lte("created_at", monthEndIso),
        ]);
      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays = Math.max(1, differenceInCalendarDays(effectiveEndDate, monthStartDate) + 1);
      const feedbackRows = (feedbackResult.error ? [] : feedbackResult.data || []) as WeeklyReview[];
      const progressRows = progressResult.error ? [] : progressResult.data || [];
      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
      const profileRows = ((profiles || []) as EomProfile[]).filter((profile) => !adminUserIds.has(profile.user_id));
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
          const monthRelevantTasks = assignedTasks.filter((task: any) =>
            isTaskRelevantForMonth(task, monthStartIso, monthEndIso),
          );
          const taskMetrics = calculateTaskProgressMetrics(monthRelevantTasks);
          const completedMonthTasks = assignedTasks.filter(
            (task: any) =>
              (task.status === "completed" || Number(task.progress || 0) >= 100) &&
              isDateInRange(task.completed_at || task.updated_at, monthStartIso, monthEndIso),
          );
          const completedTasks = completedMonthTasks.length;
          const completedMonthEffortPoints = completedMonthTasks.reduce(
            (sum: number, task: any) => sum + TASK_COMPLEXITY_POINTS[normalizedTaskComplexity(task.task_complexity)],
            0,
          );
          const completedTaskContribution = taskMetrics.totalEffortPoints
            ? Math.round((completedMonthEffortPoints / taskMetrics.totalEffortPoints) * 100)
            : 0;
          const overdueTasks = assignedTasks.filter(
            (task: any) =>
              task.deadline &&
              new Date(task.deadline).getTime() < Date.now() &&
              task.status !== "completed",
          ).length;
          const employeeAttendance = (attendance || []).filter(
            (row) => row.user_id === profile.user_id,
          );
          const attendancePct = calculateWeightedAttendancePct(employeeAttendance, elapsedDays);
          const employeeStandups = (standups || []).filter((row) => row.user_id === profile.user_id);
          const standupMetrics = calculateStandupScore(employeeStandups, elapsedDays);
          const assignedTaskIds = new Set(monthRelevantTasks.map((task: any) => task.id));
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
            taskMetrics.effortProgress >= 10 ? "Progress Starter" : null,
            taskMetrics.effortProgress >= 50 ? "Momentum Builder" : null,
            attendancePct >= 90 ? "Attendance Pro" : null,
            standupMetrics.score >= 85 ? "Standup Pro" : null,
            overdueTasks === 0 && monthRelevantTasks.length > 0 ? "No Overdue" : null,
            streak >= 7 ? "7 Day Streak" : null,
            taskMetrics.effortProgress >= 95 ? "Diamond Focus" : null,
          ].filter(Boolean) as string[];
          const complexityBreakdown = monthRelevantTasks.reduce(
            (breakdown: Record<TaskComplexity, number>, task: any) => {
              const complexity = normalizedTaskComplexity(task.task_complexity);
              breakdown[complexity] += 1;
              return breakdown;
            },
            { small: 0, medium: 0, large: 0, epic: 0 },
          );
          const reviews = feedbackRows.filter(
            (item) =>
              item.employee_id === profile.user_id &&
              item.week_start >= monthStart &&
              item.week_start <= effectiveEnd,
          );
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
            completedTaskContribution,
            attendance: attendancePct,
            averageReviewScore: reviewAverage,
            standupScore: standupMetrics.score,
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
            taskProgress: taskMetrics.effortProgress,
            totalTaskProgress: taskMetrics.totalTaskProgress,
            productivityContribution: taskMetrics.productivityContribution,
            effortPoints: taskMetrics.totalEffortPoints,
            earnedEffortPoints: taskMetrics.earnedEffortPoints,
            completedEffortPoints: completedMonthEffortPoints || taskMetrics.completedEffortPoints,
            effortProgress: taskMetrics.effortProgress,
            effortCompletion: taskMetrics.effortCompletion,
            normalizedPerformanceScore: score,
            departmentRank: 0,
            complexityBreakdown,
            activeTasks: taskMetrics.activeTasks,
            completionTrend: taskMetrics.completionTrend,
            completedTaskContribution,
            dailyImprovement,
            completedTasks,
            totalTasks: taskMetrics.totalTasks,
            overdueTasks,
            overduePenalty,
            attendancePct,
            standupScore: standupMetrics.score,
            standupSubmittedDays: standupMetrics.submittedDays,
            standupSubmissionRate: standupMetrics.submissionRate,
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
            b.normalizedPerformanceScore - a.normalizedPerformanceScore ||
            b.earnedEffortPoints - a.earnedEffortPoints ||
            b.attendancePct - a.attendancePct,
        );

      const departmentRanks = new Map<string, number>();
      EOM_DEPARTMENTS.forEach((department) => {
        ranked
          .filter((row) => row.department === department)
          .sort(
            (a, b) =>
              b.normalizedPerformanceScore - a.normalizedPerformanceScore ||
              b.earnedEffortPoints - a.earnedEffortPoints ||
              b.attendancePct - a.attendancePct,
          )
          .forEach((row, index) => departmentRanks.set(row.userId, index + 1));
      });
      ranked.forEach((row, index) => {
        row.departmentRank = departmentRanks.get(row.userId) || index + 1;
      });

      const winner = ranked[0];
      const visibleWeekCount = Math.max(1, Math.min(5, Math.ceil(elapsedDays / 7)));
      const winnerAttendanceRows = (attendance || []).filter((row) => row.user_id === winner?.userId);
      const weeklyRows = Array.from({ length: visibleWeekCount }).map((_, index) => {
        const weekStartDate = new Date(monthStartDate);
        weekStartDate.setDate(monthStartDate.getDate() + index * 7);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);
        const effectiveWeekEndDate = weekEndDate > effectiveEndDate ? effectiveEndDate : weekEndDate;
        const weekStart = formatDateKey(weekStartDate);
        const weekEnd = formatDateKey(effectiveWeekEndDate);
        const weekElapsedDays = Math.max(1, differenceInCalendarDays(effectiveWeekEndDate, weekStartDate) + 1);
        const weekAttendanceRows = winnerAttendanceRows.filter((row) => row.date >= weekStart && row.date <= weekEnd);
        const base = ranked[0]?.score || 0;
        return {
          week: `W${index + 1}`,
          productivity: Math.max(8, Math.min(100, base - (visibleWeekCount - 1 - index) * 7 + index * 3)),
          attendance: calculateWeightedAttendancePct(weekAttendanceRows, weekElapsedDays),
          standup: Math.max(8, Math.min(100, (ranked[0]?.standupScore || 0) - (visibleWeekCount - 1 - index) * 3)),
          taskProgress: Math.max(0, Math.round((ranked[0]?.effortProgress || 0) * ((index + 1) / visibleWeekCount))),
          tasksCompleted: Math.max(0, Math.round((ranked[0]?.completedEffortPoints || 0) * ((index + 1) / visibleWeekCount))),
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
        .select("*")
        .eq("month_start", monthStart)
        .order("created_at", { ascending: false });
      const profileByUserId = new Map(profileRows.map((profile) => [profile.user_id, profile]));
      setOfficialAwards(
        awardResult.error
          ? []
          : ((awardResult.data || []) as OfficialAward[]).map((award) => {
              const awardProfile = profileByUserId.get(award.employee_id);

              return {
                ...award,
                profiles: awardProfile
                  ? {
                      user_id: awardProfile.user_id,
                      full_name: awardProfile.full_name,
                      department: awardProfile.department,
                      avatar_url: awardProfile.avatar_url,
                    }
                  : award.profiles,
              };
            }),
      );
      setLoading(false);
  }, [monthEnd, monthStart]);

  const refreshEomData = useCallback(() => {
    void loadEomData({ silent: true });
  }, [loadEomData]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    loadEomData();

    const channel = supabase
      .channel("eom-live-rankings")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "standups" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_feedback" }, refreshEomData)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_progress_updates" }, refreshEomData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, loadEomData, refreshEomData, user?.id]);

  const filteredRows = useMemo(
    () =>
      departmentFilter === "All Departments"
        ? rows
        : rows.filter((row) => row.department === departmentFilter),
    [departmentFilter, rows],
  );
  const visibleRows = filteredRows.slice(0, 10);
  const winner = visibleRows[0] || rows[0];
  const selectedEmployee = rows.find((row) => row.userId === selectedEmployeeId) || winner;
  const generatedFeedback = selectedEmployee
    ? getGeneratedRecognitionMessage(recognitionType, selectedEmployee.name)
    : "";
  const previousGeneratedFeedback = useRef("");
  const totals = useMemo(
    () => ({
      taskProgress: Math.round(visibleRows.reduce((sum, row) => sum + row.taskProgress, 0) / Math.max(1, visibleRows.length)),
      effortPoints: Number(visibleRows.reduce((sum, row) => sum + row.earnedEffortPoints, 0).toFixed(1)),
      completedTasks: visibleRows.reduce((sum, row) => sum + row.completedTasks, 0),
      activeTasks: visibleRows.reduce((sum, row) => sum + row.activeTasks, 0),
      attendance: Math.round(visibleRows.reduce((sum, row) => sum + row.attendancePct, 0) / Math.max(1, visibleRows.length)),
      standup: Math.round(visibleRows.reduce((sum, row) => sum + row.standupScore, 0) / Math.max(1, visibleRows.length)),
      streak: Math.max(0, ...visibleRows.map((row) => row.streak)),
      overdue: visibleRows.reduce((sum, row) => sum + row.overdueTasks, 0),
      score: Math.round(visibleRows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, visibleRows.length)),
    }),
    [visibleRows],
  );

  const submitFeedback = async (awardType: RecognitionType = recognitionType) => {
    if (!user || !selectedEmployee) return;
    const badgeLabel = getRecognitionConfig(awardType).title;
    const employeeAlreadyAwarded = officialAwards.some((award) => award.employee_id === selectedEmployee.userId);
    const badgeAlreadyAwarded = officialAwards.some((award) => award.rating === badgeLabel);
    if (employeeAlreadyAwarded) {
      return toast.error(`${selectedEmployee.name} already has an official award for ${nepaliMonth.label} BS`);
    }
    if (badgeAlreadyAwarded) {
      return toast.error(`${badgeLabel} has already been assigned for ${nepaliMonth.label} BS`);
    }

    setSavingAward(true);
    const resetResult = await (supabase as any)
      .from("employee_month_awards")
      .delete()
      .eq("month_start", monthStart)
      .eq("rating", badgeLabel);
    if (resetResult.error) {
      setSavingAward(false);
      return toast.error(resetResult.error.message);
    }

    const { error } = await (supabase as any).from("employee_month_awards").insert({
      employee_id: selectedEmployee.userId,
      admin_id: user.id,
      month_start: monthStart,
      score: selectedEmployee.score,
      rating: badgeLabel,
      public_message: feedback || null,
      internal_notes: notes || null,
    });
    setSavingAward(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedEmployee.name} was awarded ${badgeLabel}`);
    const nextOfficialAward: OfficialAward = {
      employee_id: selectedEmployee.userId,
      month_start: monthStart,
      score: selectedEmployee.score,
      rating: badgeLabel,
      public_message: feedback,
      internal_notes: notes,
      profiles: {
        user_id: selectedEmployee.userId,
        full_name: selectedEmployee.name,
        department: selectedEmployee.department,
        avatar_url: selectedEmployee.avatarUrl,
      },
    };
    setOfficialAwards((current) => [
      nextOfficialAward,
      ...current.filter((award) => award.rating !== badgeLabel),
    ]);
    setSuccessAward({ employee: selectedEmployee.name, badge: badgeLabel, type: awardType });
    setRecognitionDialogOpen(false);
    setFeedback("");
    setNotes("");
  };

  useEffect(() => {
    if (!selectedEmployee) return;

    const generatedMessages = rows.flatMap((row) =>
      (["employee_of_month", "emerging_employee"] as RecognitionType[]).map((type) =>
        getGeneratedRecognitionMessage(type, row.name),
      ),
    );
    setFeedback((current) => {
      const shouldRegenerate =
        !current.trim() ||
        current === previousGeneratedFeedback.current ||
        generatedMessages.includes(current);
      previousGeneratedFeedback.current = generatedFeedback;
      return shouldRegenerate ? generatedFeedback : current;
    });
  }, [generatedFeedback, rows, selectedEmployee?.userId]);

  const resetOfficialAward = async () => {
    if (!officialAwards.length) return;
    const confirmed = window.confirm("Reset Employee of the Month for the previous month?");
    if (!confirmed) return;

    setResettingAward(true);
    const { error } = await (supabase as any)
      .from("employee_month_awards")
      .delete()
      .eq("month_start", monthStart);
    setResettingAward(false);

    if (error) return toast.error(error.message);

    toast.success("Employee of the Month has been reset for the previous month");
    setOfficialAwards([]);
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
        subtitle="Fair monthly scoring by department, task effort, attendance, standups, HR reviews, and normalized performance"
      />

      {!winner ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No EOM-eligible employees found.
        </GlassCard>
      ) : (
        <div className="eom-page space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <StatTile label="Effort progress" value={`${totals.taskProgress}%`} icon={CheckCircle2} />
            <StatTile label="Effort points" value={totals.effortPoints} icon={BadgeCheck} />
            <StatTile label="Active tasks" value={totals.activeTasks} icon={Target} />
            <StatTile label="Attendance" value={`${totals.attendance}%`} icon={BadgeCheck} />
            <StatTile label="Standup" value={`${totals.standup}%`} icon={ClipboardList} />
            <StatTile label="HR reviews" value={rows.reduce((sum, row) => sum + row.reviewCount, 0)} icon={MessageSquare} />
            <StatTile label="Normalized score" value={totals.score} icon={Zap} />
          </section>

          <DepartmentFilterBar
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            rows={rows}
          />

          <EligibilitySummary eligibleCount={rows.length} excludedRows={excludedRows} />

          <section className="eom-top-row grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[1.15fr_.85fr]">
            <TopContenders rows={visibleRows} />
            <Leaderboard rows={visibleRows} departmentFilter={departmentFilter} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <AnalyticsPanel weekly={weekly} rows={visibleRows} />
            <FeedbackPanel
              rows={rows}
              selectedEmployeeId={selectedEmployeeId}
              setSelectedEmployeeId={setSelectedEmployeeId}
              selectedEmployee={selectedEmployee}
              officialAwards={officialAwards}
              recognitionType={recognitionType}
              setRecognitionType={setRecognitionType}
              rating={rating}
              setRating={setRating}
              feedback={feedback}
              setFeedback={setFeedback}
              notes={notes}
              setNotes={setNotes}
              recognitionDialogOpen={recognitionDialogOpen}
              setRecognitionDialogOpen={setRecognitionDialogOpen}
              onSubmit={submitFeedback}
              saving={savingAward}
              monthLabel={nepaliMonth.label}
              successAward={successAward}
              onClearSuccess={() => setSuccessAward(null)}
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
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 ">
            <Trophy size={14} />
            Top 5 Contenders
          </div>
          <h2 className="text-3xl font-bold md:text-4xl">Employee of the Month race</h2>
          <p className="mt-1 text-sm text-foreground/65">
            Live ranking from effort-weighted task progress, attendance, standups, HR reviews, bonuses, and overdue penalties.
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

      <div className="relative z-10 mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Score comparison</div>
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
            <p className="mt-1 text-sm text-muted-foreground">{employee.department} · {employee.position}</p>
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
        <ContenderMetric label="Effort progress" value={`${employee.effortProgress}%`} icon={CheckCircle2} />
        <ContenderMetric label="Attendance" value={`${employee.attendancePct}%`} icon={BadgeCheck} />
        <ContenderMetric label="Effort points" value={`${employee.earnedEffortPoints}/${employee.effortPoints}`} icon={BadgeCheck} />
        <ContenderMetric label="Active tasks" value={employee.activeTasks} icon={Target} />
        <ContenderMetric label="Standup" value={`${employee.standupScore}%`} icon={ClipboardList} />
        <ContenderMetric label="HR review" value={`${employee.reviewAverage}/10`} icon={MessageSquare} />
        <ContenderMetric label="Normalized score" value={employee.normalizedPerformanceScore} icon={TrendingUp} />
        <ContenderMetric
          label="Weekly trend"
          value={<span className="inline-flex items-center gap-1"><TrendIcon trend={employee.reviewTrend} />{contenderTrendLabel(employee.reviewTrend)}</span>}
          icon={BarChart3}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <AnalyticsBar label="Effort progression" value={employee.effortProgress} />
        <AnalyticsBar label="Completed effort" value={employee.completedTaskContribution} />
        <AnalyticsBar label="Normalized performance" value={employee.normalizedPerformanceScore} />
        <AnalyticsBar label="Attendance" value={employee.attendancePct} />
        <AnalyticsBar label="Standup score" value={employee.standupScore} />
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
      <Icon size={15} className="text-amber-600 " />
      <div className="mt-2 text-lg font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function contenderTrendLabel(trend: EmployeeRank["reviewTrend"]) {
  if (trend === "up") return "Improving";
  if (trend === "down") return "Dropping";
  return "Stable";
}

function DepartmentFilterBar({
  value,
  onValueChange,
  rows,
}: {
  value: DepartmentFilter;
  onValueChange: (value: DepartmentFilter) => void;
  rows: EmployeeRank[];
}) {
  return (
    <GlassCard className="eom-department-filter">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 size={16} className="text-primary" />
            Department leaderboards
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare employees inside their role area before choosing an overall winner.
          </p>
        </div>
        <Select value={value} onValueChange={(next) => onValueChange(next as DepartmentFilter)}>
          <SelectTrigger className="w-full lg:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENT_FILTERS.map((department) => (
              <SelectItem key={department} value={department}>
                {department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {EOM_DEPARTMENTS.map((department) => {
          const departmentRows = rows.filter((row) => row.department === department);
          const leader = departmentRows.find((row) => row.departmentRank === 1);
          return (
            <ReviewSummaryTile
              key={department}
              label={department}
              value={leader ? `#1 ${leader.name.split(" ")[0]} · ${leader.normalizedPerformanceScore}` : "No ranking"}
            />
          );
        })}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        {(Object.keys(TASK_COMPLEXITY_LABELS) as TaskComplexity[]).map((complexity) => (
          <div key={complexity} className="rounded-2xl border border-border bg-card p-3">
            <div className="text-xs font-semibold text-foreground">
              {TASK_COMPLEXITY_LABELS[complexity]} · {TASK_COMPLEXITY_POINTS[complexity]} pts
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {TASK_COMPLEXITY_DESCRIPTIONS[complexity]}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function Leaderboard({ rows, departmentFilter }: { rows: EmployeeRank[]; departmentFilter: DepartmentFilter }) {
  return (
    <GlassCard className="eom-leaderboard overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Trophy size={17} className="text-primary" />
          {departmentFilter === "All Departments" ? "Overall leaderboard" : `${departmentFilter} leaderboard`}
        </h3>
      </div>
      <div className="eom-leaderboard-list divide-y divide-border/50">
        {!rows.length && (
          <div className="p-6 text-sm text-muted-foreground">
            No EOM-eligible employees found for this department.
          </div>
        )}
        {rows.map((row, index) => (
          <div key={row.userId} className="eom-rank-row">
            <div className={`eom-rank-number ${index === 0 ? "eom-rank-first" : ""}`}>
              {index === 0 ? <Crown size={16} /> : index + 1}
            </div>
            <Avatar employee={row} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                  {row.level}
                </span>
                <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-foreground">
                  Dept #{row.departmentRank}
                </span>
                <EligibilityBadge eligible={row.isEomEligible} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.department} · {row.position}</div>
              <div className="eom-leader-metrics mt-3 grid gap-3">
                <MiniBar label="Effort progress" value={row.effortProgress} detail={`${row.effortProgress}%`} />
                <MiniBar label="Effort points" value={Math.min(100, row.earnedEffortPoints)} detail={`${row.earnedEffortPoints}/${row.effortPoints}`} />
                <MiniBar label="Completed effort" value={row.completedTaskContribution} detail={`${row.completedEffortPoints} pts`} />
                <MiniBar label="Normalized" value={row.normalizedPerformanceScore} detail={`${row.normalizedPerformanceScore}/100`} />
                <MiniBar label="Active tasks" value={Math.min(100, row.activeTasks * 10)} detail={`${row.activeTasks}`} />
                <MiniBar label="Attendance" value={row.attendancePct} detail={`${row.attendancePct}%`} />
                <MiniBar label="Standup" value={row.standupScore} detail={`${row.standupSubmittedDays} days · ${row.standupSubmissionRate}%`} />
                <MiniBar label="HR avg" value={row.reviewAverage * 10} detail={row.reviewAverage ? `${row.reviewAverage}/10` : "0"} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="eom-review-pill">
                  {ratingLabelFromAverage(row.reviewAverage)} · {row.reviewCount} reviews
                </span>
                <span className="eom-review-pill">
                  {complexitySummary(row.complexityBreakdown)} · +{row.dailyImprovement}%/day
                </span>
                <span className="eom-review-pill">
                  Standup {row.standupScore}% · {row.standupSubmittedDays} days
                </span>
                {row.overduePenalty > 0 && (
                  <span className="eom-review-pill">
                    -{row.overduePenalty} overdue penalty
                  </span>
                )}
                <span className="eom-review-pill">
                  Latest {row.latestReview ? `${formatNepaliDate(row.latestReview.week_start, "DD MMM")} BS` : "None"}
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
  const productivityTarget = 85;
  const attendanceTarget = 90;
  const monthlyAverage = Math.round(
    weekly.reduce((sum, row) => sum + Number(row.productivity || 0), 0) / Math.max(1, weekly.length),
  );
  const firstWeek = weekly[0]?.productivity || 0;
  const lastWeek = weekly[weekly.length - 1]?.productivity || 0;
  const growthPct = firstWeek ? Math.round(((lastWeek - firstWeek) / Math.max(1, firstWeek)) * 100) : 0;
  const highWeek = weekly.reduce((best, row) => (Number(row.productivity || 0) > Number(best.productivity || 0) ? row : best), weekly[0] || {});
  const lowWeek = weekly.reduce((worst, row) => (Number(row.productivity || 0) < Number(worst.productivity || 0) ? row : worst), weekly[0] || {});
  const targetWeeks = weekly.filter((row) => Number(row.productivity || 0) >= productivityTarget).length;
  const excellentWeeks = weekly.filter((row) => Number(row.productivity || 0) >= 90).length;
  const trendSummary = `Productivity ${growthPct >= 0 ? "increased" : "decreased"} by ${Math.abs(growthPct)}% during the previous month.`;
  const productivityInsight = makeEomProductivityInsight({
    name: winner?.name || "Top employee",
    monthlyAverage,
    growthPct,
    targetWeeks,
    attendance: Math.round(weekly.reduce((sum, row) => sum + Number(row.attendance || 0), 0) / Math.max(1, weekly.length)),
    taskProgress: winner?.taskProgress || 0,
  });
  const overallAttendance = Math.round(
    weekly.reduce((sum, row) => sum + Number(row.attendance || 0), 0) / Math.max(1, weekly.length),
  );
  const bestAttendanceWeek = weekly.reduce((best, row) => (Number(row.attendance || 0) > Number(best.attendance || 0) ? row : best), weekly[0] || {});
  const attendanceGrowth = weekly[0]?.attendance
    ? Math.round(((Number(weekly[weekly.length - 1]?.attendance || 0) - Number(weekly[0]?.attendance || 0)) / Math.max(1, Number(weekly[0]?.attendance || 0))) * 100)
    : 0;
  const attendanceTargetWeeks = weekly.filter((row) => Number(row.attendance || 0) >= attendanceTarget).length;
  const attendanceTargetAchievement = Math.round((attendanceTargetWeeks / Math.max(1, weekly.length)) * 100);
  const attendanceInsight = makeEomAttendanceInsight({
    overallAttendance,
    bestWeek: bestAttendanceWeek.week || "W1",
    growth: attendanceGrowth,
    targetWeeks: attendanceTargetWeeks,
  });
  const pieData = [
    { name: "Progress", value: winner?.taskProgress || 0 },
    { name: "Remaining", value: Math.max(0, 100 - (winner?.taskProgress || 0)) },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:col-span-2 md:grid-cols-2">
      <GlassCard>
        <div className="eom-productivity-header">
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 size={16} className="text-primary" />
            Effort productivity graph
          </h3>
          <div className="eom-productivity-average">
            <span>Monthly avg</span>
            <b>{monthlyAverage}</b>
          </div>
        </div>
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
            <YAxis domain={[0, 100]} stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <Tooltip content={<EomProductivityTooltip />} />
            <ReferenceLine y={productivityTarget} stroke="#f6c453" strokeDasharray="6 6" strokeWidth={1.4} />
            <Area
              type="monotone"
              dataKey="productivity"
              stroke="#ff2d6f"
              fill="url(#eomProductivity)"
              strokeWidth={3}
              dot={(props) => <EomProductivityDot {...props} highWeek={highWeek.week} lowWeek={lowWeek.week} target={productivityTarget} />}
              activeDot={{ r: 6, stroke: "#f1f0ee", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="eom-productivity-footer">
          <div className={`eom-productivity-trend ${growthPct >= 0 ? "up" : "down"}`}>
            <TrendingUp size={14} />
            {trendSummary}
          </div>
          <div className="eom-productivity-legend">
            <span><i className="target" />Target {productivityTarget}</span>
            <span><i className="high" />High {highWeek.week || "--"}</span>
            <span><i className="low" />Low {lowWeek.week || "--"}</span>
          </div>
          <div className="eom-productivity-badges">
            {targetWeeks > 0 && <span><BadgeCheck size={13} /> Target met {targetWeeks}x</span>}
            {excellentWeeks > 0 && <span><Trophy size={13} /> {excellentWeeks} excellent week{excellentWeeks === 1 ? "" : "s"}</span>}
            {monthlyAverage >= productivityTarget && <span><Award size={13} /> Monthly target achieved</span>}
          </div>
          <div className="eom-productivity-ai">
            <Sparkles size={14} />
            {productivityInsight}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="eom-attendance-card">
        <div className="eom-attendance-header">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarDays size={16} className="text-primary" />
              Attendance chart
            </h3>
            <p>Monthly Attendance Performance</p>
          </div>
          <div className="eom-attendance-legend">
            <span><i className="actual" />Actual attendance</span>
            <span><i className="target" />Target 90%</span>
          </div>
        </div>
        <div className="eom-attendance-kpis">
          <EomAttendanceKpi label="Overall Attendance" value={`${overallAttendance}%`} />
          <EomAttendanceKpi label="Best Week" value={`${bestAttendanceWeek.week || "--"} · ${Math.round(bestAttendanceWeek.attendance || 0)}%`} />
          <EomAttendanceKpi label="Attendance Growth" value={`${attendanceGrowth >= 0 ? "+" : ""}${attendanceGrowth}%`} tone={attendanceGrowth >= 0 ? "up" : "down"} />
          <EomAttendanceKpi label="Target Achievement" value={`${attendanceTargetAchievement}%`} />
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weekly} margin={{ top: 24, right: 8, left: -12, bottom: 2 }}>
            <defs>
              <linearGradient id="eomAttendanceActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#21d4fd" stopOpacity={0.98} />
                <stop offset="55%" stopColor="#8b5cf6" stopOpacity={0.86} />
                <stop offset="100%" stopColor="#ff2d6f" stopOpacity={0.68} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 6" stroke="oklch(1 0 0 / 0.075)" vertical={false} />
            <XAxis dataKey="week" stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <YAxis domain={[0, 100]} stroke="oklch(0.7 0.03 250)" fontSize={12} tickFormatter={(value) => `${value}%`} />
            <Tooltip content={<EomAttendanceTooltip target={attendanceTarget} />} />
            <ReferenceLine y={attendanceTarget} stroke="#f6c453" strokeDasharray="7 6" strokeWidth={1.5} />
            <Bar
              dataKey="attendance"
              fill="url(#eomAttendanceActual)"
              radius={[12, 12, 5, 5]}
              barSize={34}
              label={<EomAttendanceValueLabel />}
              isAnimationActive
              animationDuration={850}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="eom-attendance-insight">
          <Sparkles size={14} />
          {attendanceInsight}
        </div>
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
              <div key={row.userId} className="rounded-2xl border border-border bg-card p-4">
                <div className="text-sm font-semibold">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.department}</div>
                <AnalyticsBar label="Effort progress" value={row.effortProgress} />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function EomProductivityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="eom-productivity-tooltip">
      <div className="eom-productivity-tooltip-week">{row.week}</div>
      <div className="eom-productivity-tooltip-row">
        <span>Normalized Score</span>
        <b>{Math.round(row.productivity || 0)}</b>
      </div>
      <div className="eom-productivity-tooltip-row">
        <span>Effort Completed</span>
        <b>{row.tasksCompleted || 0}</b>
      </div>
      <div className="eom-productivity-tooltip-row">
        <span>Attendance</span>
        <b>{Math.round(row.attendance || 0)}%</b>
      </div>
      <div className="eom-productivity-tooltip-row">
        <span>Standup</span>
        <b>{Math.round(row.standup || 0)}%</b>
      </div>
      <div className="eom-productivity-tooltip-status">{productivityStatus(row.productivity || 0)}</div>
    </div>
  );
}

function EomProductivityDot(props: any) {
  const { cx, cy, payload, highWeek, lowWeek, target } = props;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  const isHigh = payload?.week === highWeek;
  const isLow = payload?.week === lowWeek;
  const metTarget = Number(payload?.productivity || 0) >= target;
  const fill = isHigh ? "#22c55e" : isLow ? "#ff2d6f" : metTarget ? "#f6c453" : "#ff7ab3";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isHigh || isLow || metTarget ? 5 : 3.5}
      fill={fill}
      stroke={isHigh || isLow || metTarget ? "#f1f0ee" : "#07111f"}
      strokeWidth={isHigh || isLow || metTarget ? 2 : 1}
      className={metTarget || isHigh ? "eom-exceptional-dot" : ""}
    />
  );
}

function productivityStatus(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Average";
  return "Needs Improvement";
}

function makeEomProductivityInsight({
  name,
  monthlyAverage,
  growthPct,
  targetWeeks,
  attendance,
  taskProgress,
}: {
  name: string;
  monthlyAverage: number;
  growthPct: number;
  targetWeeks: number;
  attendance: number;
  taskProgress: number;
}) {
  const firstName = name.split(" ")[0] || "Employee";
  if (monthlyAverage >= 90) {
    return `${firstName} is performing at an excellent level with strong monthly productivity and ${targetWeeks} target week${targetWeeks === 1 ? "" : "s"}. Keep assigning high-impact tasks.`;
  }
  if (growthPct >= 15) {
    return `${firstName} shows strong upward momentum with ${growthPct}% growth. Strength is consistency, while the next focus is sustaining effort progress above ${Math.max(80, Math.round(taskProgress))}%.`;
  }
  if (attendance < 75) {
    return `${firstName}'s productivity is being limited by attendance consistency. Improving attendance should lift monthly performance quickly.`;
  }
  if (monthlyAverage < 60) {
    return `${firstName} needed support in the previous month. Review blockers, reduce context switching, and set smaller weekly productivity targets.`;
  }
  return `${firstName} has stable productivity with a ${monthlyAverage}/100 monthly average. Focus on one more target-level week to strengthen EOM readiness.`;
}

function EomAttendanceKpi({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className={`eom-attendance-kpi ${tone || ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function EomAttendanceTooltip({ active, payload, target }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const attendance = Math.round(Number(row.attendance || 0));
  return (
    <div className="eom-attendance-tooltip">
      <div className="eom-attendance-tooltip-week">{row.week}</div>
      <div className="eom-attendance-tooltip-row">
        <span>Actual Attendance</span>
        <b>{attendance}%</b>
      </div>
      <div className="eom-attendance-tooltip-row">
        <span>Target</span>
        <b>{target}%</b>
      </div>
      <div className="eom-attendance-tooltip-row">
        <span>Effort Progress</span>
        <b>{Math.round(Number(row.taskProgress || 0))}%</b>
      </div>
      <div className={`eom-attendance-tooltip-status ${attendance >= target ? "met" : ""}`}>
        {attendance >= target ? "Target achieved" : "Below target"}
      </div>
    </div>
  );
}

function EomAttendanceValueLabel(props: any) {
  const { x, y, width, value } = props;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fill="#e5edf8"
      fontSize={11}
      fontWeight={800}
    >
      {Math.round(Number(value || 0))}%
    </text>
  );
}

function makeEomAttendanceInsight({
  overallAttendance,
  bestWeek,
  growth,
  targetWeeks,
}: {
  overallAttendance: number;
  bestWeek: string;
  growth: number;
  targetWeeks: number;
}) {
  if (overallAttendance >= 90) {
    return `Attendance is operating above the executive benchmark, with ${targetWeeks} target week${targetWeeks === 1 ? "" : "s"} and peak consistency in ${bestWeek}.`;
  }
  if (growth >= 10) {
    return `Attendance improved by ${growth}% across the month. The trend is positive, and one more target-level week will strengthen EOM confidence.`;
  }
  if (growth < 0) {
    return `Attendance declined by ${Math.abs(growth)}% in the previous month. Review late or missed days and reinforce weekly consistency before the next evaluation cycle.`;
  }
  return `Attendance is stable at ${overallAttendance}%. Best performance was ${bestWeek}; focus on crossing the 90% benchmark consistently.`;
}

function getRecognitionConfig(type: RecognitionType) {
  if (type === "emerging_employee") {
    return {
      title: "Emerging Employee",
      shortTitle: "Emerging",
      icon: Rocket,
      theme: "emerging",
      symbol: "🚀",
      cta: "Award Emerging Employee",
      description: "Recognizes rapid growth, outstanding potential, and continuous improvement.",
    };
  }

  return {
    title: "Employee of the Month",
    shortTitle: "EOM",
    icon: Trophy,
    theme: "month",
    symbol: "🏆",
    cta: "Award Employee of the Month",
    description: "Recognizes exceptional performance, leadership, and consistent excellence.",
  };
}

function getGeneratedRecognitionMessage(type: RecognitionType, name: string) {
  if (type === "emerging_employee") {
    return `Congratulations ${name}! Your remarkable growth, commitment, and potential have earned you the Emerging Employee recognition.`;
  }

  return `Congratulations ${name}! Your exceptional dedication, leadership, and contribution have earned you the Employee of the Month award.`;
}

function FeedbackPanel({
  rows,
  selectedEmployeeId,
  setSelectedEmployeeId,
  selectedEmployee,
  officialAwards,
  recognitionType,
  setRecognitionType,
  rating,
  setRating,
  feedback,
  setFeedback,
  notes,
  setNotes,
  recognitionDialogOpen,
  setRecognitionDialogOpen,
  onSubmit,
  saving,
  monthLabel,
  successAward,
  onClearSuccess,
}: {
  rows: EmployeeRank[];
  selectedEmployeeId: string;
  setSelectedEmployeeId: (value: string) => void;
  selectedEmployee?: EmployeeRank;
  officialAwards: OfficialAward[];
  recognitionType: RecognitionType;
  setRecognitionType: (value: RecognitionType) => void;
  rating: string;
  setRating: (value: string) => void;
  feedback: string;
  setFeedback: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  recognitionDialogOpen: boolean;
  setRecognitionDialogOpen: (value: boolean) => void;
  onSubmit: (awardType?: RecognitionType) => Promise<void>;
  saving: boolean;
  monthLabel: string;
  successAward: { employee: string; badge: string; type: RecognitionType } | null;
  onClearSuccess: () => void;
}) {
  const officialWinnerItems = (["employee_of_month", "emerging_employee"] as RecognitionType[])
    .map((type) => {
      const config = getRecognitionConfig(type);
      const award = officialAwards.find((item) => item.rating === config.title);
      return {
        type,
        config,
        award,
        name: award?.profiles?.full_name,
      };
    })
    .filter((item) => item.award);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const selectedConfig = getRecognitionConfig(recognitionType);
  const SelectedIcon = selectedConfig.icon;
  const selectedEmployeeAward = selectedEmployee
    ? officialAwards.find((award) => award.employee_id === selectedEmployee.userId)
    : undefined;
  const selectedBadgeAward = officialAwards.find((award) => award.rating === selectedConfig.title);
  const awardLockReason = selectedEmployeeAward
    ? `${selectedEmployee?.name} already received ${selectedEmployeeAward.rating} for ${monthLabel} BS.`
    : selectedBadgeAward
      ? `${selectedConfig.title} is already assigned to ${selectedBadgeAward.profiles?.full_name || "another employee"} for ${monthLabel} BS.`
      : "";
  const filteredEmployees = rows.filter((row) => {
    const query = employeeSearch.trim().toLowerCase();
    return (
      !query ||
      row.name.toLowerCase().includes(query) ||
      row.department.toLowerCase().includes(query) ||
      String(row.score).includes(query)
    );
  });
  const selectedRank = selectedEmployee ? rows.findIndex((row) => row.userId === selectedEmployee.userId) + 1 : 0;
  const completionSteps = [
    { label: "Badge Selected", done: Boolean(recognitionType) },
    { label: "Employee Selected", done: Boolean(selectedEmployee) },
    { label: "Message Added", done: feedback.trim().length > 0 },
    { label: "Award Available", done: !awardLockReason },
    { label: "Ready to Assign", done: Boolean(recognitionType && selectedEmployee && feedback.trim() && !awardLockReason) },
  ];
  const noteTags = ["Leadership", "High impact", "Growth", "Ownership", "Consistency"];

  return (
    <>
      <GlassCard className="eom-feedback eom-recognition-launcher">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-foreground">
              <Medal size={13} />
              Recognition console
            </div>
            <h3 className="text-2xl font-bold text-foreground">Employee Recognition</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Celebrate achievements and recognize outstanding talent.
            </p>
          </div>
          <Button className="neon-button rounded-2xl px-5" onClick={() => setRecognitionDialogOpen(true)}>
            <Sparkles size={15} className="mr-2" />
            Assign official badge
          </Button>
        </div>
        {officialWinnerItems.length > 0 && (
          <div className="eom-recognition-winners">
            <div className="eom-recognition-winners-header">
              <span>
                <Trophy size={14} />
                Official winners
              </span>
              <span>
                <CalendarDays size={14} />
                {monthLabel} BS
              </span>
            </div>
            <div className="eom-recognition-winner-stack">
              {officialWinnerItems.map(({ type, config, name }) => {
                const Icon = config.icon;

                return (
                  <div key={type} className={`eom-recognition-winner-row ${config.theme}`}>
                    <span className="eom-recognition-winner-badge">
                      <Icon size={15} />
                      {config.title}
                    </span>
                    <span className="eom-recognition-winner-name">{name || "Unknown employee"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </GlassCard>

      <Dialog open={recognitionDialogOpen} onOpenChange={setRecognitionDialogOpen}>
        <DialogContent className="recognition-modal max-h-[92vh] w-[calc(100vw-1.25rem)] max-w-6xl overflow-hidden border-border p-0">
          <div className="recognition-particles" />
          <div className="recognition-modal-shell">
            <DialogHeader className="recognition-modal-header">
              <div className="recognition-header-icon">
                <Trophy size={24} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold md:text-3xl">Employee Recognition</DialogTitle>
                <DialogDescription>
                  Celebrate achievements and recognize outstanding talent
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="recognition-modal-body">
              <section className="recognition-main">
                <div className="recognition-badge-grid">
                  {(["employee_of_month", "emerging_employee"] as RecognitionType[]).map((type) => {
                    const config = getRecognitionConfig(type);
                    const Icon = config.icon;
                    const selected = recognitionType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`recognition-badge-card ${config.theme} ${selected ? "selected" : ""}`}
                        onClick={() => setRecognitionType(type)}
                      >
                        <span className="recognition-card-glow" />
                        <span className="recognition-card-check">
                          <CheckCircle2 size={16} />
                        </span>
                        <span className="recognition-card-icon">
                          <Icon size={28} />
                        </span>
                        <span className="recognition-card-title">{config.title}</span>
                        <span className="recognition-card-copy">{config.description}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="recognition-field-panel recognition-employee-picker">
                  <div className="recognition-floating-label">Employee Selection</div>
                  {selectedEmployee && (
                    <div className="recognition-selected-employee">
                      <Avatar employee={selectedEmployee} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{selectedEmployee.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{selectedEmployee.department} Department</span>
                      </span>
                      <span className="recognition-score">
                        <b>{selectedEmployee.score}</b>
                        Score
                      </span>
                      <span className="recognition-rank">#{selectedRank}</span>
                    </div>
                  )}
                  <div className="recognition-search">
                    <Search size={16} />
                    <Input
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search employees by name, department, or score"
                    />
                  </div>
                  <div className="recognition-employee-list">
                    {filteredEmployees.slice(0, 6).map((row) => {
                      const rank = rows.findIndex((item) => item.userId === row.userId) + 1;
                      const selected = selectedEmployeeId === row.userId;
                      const employeeAward = officialAwards.find((award) => award.employee_id === row.userId);
                      return (
                        <button
                          key={row.userId}
                          type="button"
                          className={`recognition-employee-row ${selected ? "selected" : ""} ${employeeAward ? "awarded" : ""}`}
                          onClick={() => setSelectedEmployeeId(row.userId)}
                        >
                          <Avatar employee={row} />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate font-semibold text-foreground">{row.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{row.department} Department</span>
                          </span>
                          <span className="recognition-score">
                            <b>{row.score}</b>
                            Score
                          </span>
                          {employeeAward && <span className="recognition-awarded-pill">Awarded</span>}
                          <span className="recognition-rank">#{rank}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
                  <div className="recognition-field-panel">
                    <div className="recognition-field-heading">
                      <Label>Recognition Message</Label>
                      <span>{feedback.length} chars</span>
                    </div>
                    <Textarea
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      rows={4}
                      className="recognition-textarea mt-2"
                      placeholder={`Congratulations message for ${selectedEmployee?.name || "the employee"}...`}
                    />
                  </div>
                  <div className="recognition-field-panel">
                    <div className="recognition-field-heading">
                      <Label>Recognition Rating</Label>
                      <span>Internal score</span>
                    </div>
                    <Select value={rating} onValueChange={setRating}>
                      <SelectTrigger className="mt-2">
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
                </div>

                <div className="recognition-field-panel">
                  <div className="recognition-field-heading">
                    <Label>Internal Performance Notes</Label>
                    <span>{notes.length}/500</span>
                  </div>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                    rows={5}
                    className="recognition-textarea mt-2"
                    placeholder="Add internal notes for monthly review..."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {noteTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="recognition-tag"
                        onClick={() => setNotes(notes ? `${notes}, ${tag}` : tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <aside className="recognition-side">
                <div className={`recognition-preview ${selectedConfig.theme}`}>
                  <div className="recognition-preview-particles" />
                  <div className="recognition-preview-icon">
                    <SelectedIcon size={34} />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Award Certificate</div>
                  <h3>{selectedEmployee?.name || "Select Employee"}</h3>
                  <p>{selectedConfig.title}</p>
                  <span>{monthLabel} BS</span>
                </div>

                <div className="recognition-progress">
                  {completionSteps.map((step) => (
                    <div key={step.label} className={step.done ? "done" : ""}>
                      <CheckCircle2 size={15} />
                      {step.label}
                    </div>
                  ))}
                </div>

                {awardLockReason && (
                  <div className="recognition-lock-note">
                    <Lock size={15} />
                    <span>{awardLockReason}</span>
                  </div>
                )}

                <Button
                  onClick={() => onSubmit(recognitionType)}
                  disabled={saving || !selectedEmployee || !feedback.trim() || Boolean(awardLockReason)}
                  className={`recognition-cta ${selectedConfig.theme}`}
                >
                  {awardLockReason
                    ? "Award already assigned"
                    : saving
                      ? "Assigning recognition..."
                      : `${selectedConfig.symbol} ${selectedConfig.cta}`}
                </Button>
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(successAward)} onOpenChange={(open) => !open && onClearSuccess()}>
        <DialogContent className="recognition-success-modal border-border p-0">
          {successAward && (
            <div className="recognition-success-shell">
              <div className="eom-confetti" />
              <div className={`recognition-preview ${getRecognitionConfig(successAward.type).theme}`}>
                <div className="recognition-preview-particles" />
                <div className="recognition-preview-icon">
                  {successAward.type === "employee_of_month" ? <Trophy size={34} /> : <Rocket size={34} />}
                </div>
                <h3>{successAward.employee}</h3>
                <p>{successAward.badge}</p>
                <span>{monthLabel} BS</span>
              </div>
              <div className="px-6 pb-6 text-center">
                <h3 className="text-2xl font-bold text-foreground">Recognition Successfully Assigned</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {successAward.employee} has been awarded {successAward.badge}.
                </p>
                <Button className="neon-button mt-5 rounded-2xl px-6" onClick={onClearSuccess}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
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
  const reviewEmployee =
    rows.find((row) => row.userId === reviewEmployeeId) || selectedEmployee || rows[0];
  const selectedReviews = reviewEmployee?.reviews || [];
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
                      <span className="text-sm text-muted-foreground">{review.rating}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNepaliDate(review.week_start, "DD MMMM YYYY")} BS
                      </span>
                    </div>
                    <MiniBar label="Review score" value={score * 10} detail={`${score}/10`} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
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
        <div className="eom-review-name-list">
          {employeesWithReviews.length ? (
            employeesWithReviews.map((employee) => (
              <button
                key={employee.userId}
                type="button"
                className={`eom-review-name-row ${employee.userId === reviewEmployeeId ? "active" : ""}`}
                onClick={() => openEmployeeReviews(employee.userId)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{employee.name}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {employee.department} · {employee.position}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-black tabular-nums gradient-text">{employee.reviewAverage || 0}/10</span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                    {employee.reviewCount} reviews
                  </span>
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              HR weekly review history will appear here after submissions.
            </div>
          )}
        </div>
      </GlassCard>
    </section>
    <Dialog open={Boolean(dialogEmployee)} onOpenChange={(open) => !open && setReviewDialogEmployeeId(null)}>
      <DialogContent className="eom-review-dialog max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden border-border bg-background/95 sm:max-w-4xl">
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
                          {formatNepaliDate(review.week_start, "DD MMMM YYYY")} BS
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
            <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

function ReviewText({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-2 text-sm text-muted-foreground">{value || "No notes added."}</p>
    </div>
  );
}

function BadgeSection({ winner }: { winner: EmployeeRank }) {
  const badgeRows = [
    { title: "Productivity Hero", icon: Trophy, progress: winner.score, unlocked: winner.score >= 80 },
    { title: "Elite Performer", icon: Crown, progress: winner.score, unlocked: winner.score >= 95 },
    { title: "Effort Champion", icon: Award, progress: winner.effortProgress, unlocked: winner.effortProgress >= 80 },
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
    month: `${getNepaliMonthLabel(-offset)} BS`,
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
          <div key={item.month} className="rounded-2xl border border-border bg-card p-4">
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
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-400 via-violet-500 to-pink-500 text-foreground shadow-[0_0_24px_rgba(125,92,255,.35)]">
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
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card">
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
      <div className="h-1.5 overflow-hidden rounded-full bg-card">
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
    <div className={`${className} flex shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-foreground shadow-[0_0_30px_rgba(125,92,255,.4)]`}>
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

function complexitySummary(breakdown: Record<TaskComplexity, number>) {
  const parts = (Object.keys(TASK_COMPLEXITY_LABELS) as TaskComplexity[])
    .filter((complexity) => breakdown[complexity] > 0)
    .map((complexity) => `${TASK_COMPLEXITY_LABELS[complexity][0]}:${breakdown[complexity]}`);
  return parts.length ? parts.join(" ") : "No effort mix";
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
