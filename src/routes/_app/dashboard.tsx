import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { getWeeklyReviewCyclesForNepaliMonth } from "@/lib/nepali-calendar";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeviceStatus } from "@/hooks/use-device-status";
import { LiveClock } from "@/components/LiveClock";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVerifiedAttendanceLocation } from "@/lib/attendance-location";
import {
  Activity,
  ArrowUpRight,
  Award,
  BadgeCheck,
  BarChart3,
  BellDot,
  Bot,
  Briefcase,
  Calendar,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  CircleUserRound,
  ClipboardList,
  Clock,
  Crown,
  Flame,
  Gauge,
  History,
  Laugh,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  PieChart as PieChartIcon,
  Plus,
  ShieldCheck,
  Sparkles,
  Smile,
  Fingerprint,
  Target,
  Trophy,
  TrendingUp,
  Users,
  UserRoundCog,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, subDays } from "date-fns";
import { productivityScore, STATUS_LABELS } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { formatWorkHours } from "@/lib/work-hours";
import { formatNepaliDate, getCurrentNepaliMonthRange } from "@/lib/nepali-calendar";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";

export const Route = createFileRoute("/_app/dashboard")({ component: EmployeeDashboard });

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type HeatmapDay = {
  date: string;
  status: "present" | "late" | "absent" | "holiday" | "none";
  checkIn?: string | null;
  checkOut?: string | null;
};

type ActivityItem = {
  kind: string;
  when: string;
  text: string;
};

type TeamLeader = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  score: number;
};

type MoodLog = {
  id?: string;
  user_id: string;
  mood: string;
  note?: string | null;
  log_date: string;
  created_at?: string;
  updated_at?: string;
};

const WEEKLY_TARGET_HOURS = 42;
const WEEKLY_WORKING_DAYS = 6;
const QUOTES = [
  "Small wins compound into remarkable work.",
  "Focus creates momentum. Momentum creates outcomes.",
  "Great teams move with clarity, care, and consistency.",
  "Your best work today is one deliberate step away.",
];

const BADGES = [
  { label: "Employee of the Month", icon: Crown, active: true },
  { label: "Productivity Hero", icon: Trophy, active: true },
  { label: "Perfect Attendance", icon: BadgeCheck, active: false },
  { label: "Early Bird", icon: Flame, active: true },
  { label: "Standup Champion", icon: MessageSquare, active: true },
];
const MOODS = [
  { value: "excellent", label: "Excellent", emoji: "😁" },
  { value: "good", label: "Good", emoji: "😃" },
  { value: "neutral", label: "Neutral", emoji: "🙂" },
  { value: "tired", label: "Tired", emoji: "😐" },
  { value: "stressed", label: "Stressed", emoji: "😔" },
];

function EmployeeWeeklyReviews({ reviews }: { reviews: any[] }) {
  const reviewCycles = useMemo(() => getWeeklyReviewCyclesForNepaliMonth(new Date()), []);
  const todayDate = format(new Date(), "yyyy-MM-dd");

  return (
    <GlassPanel className="p-5 sm:p-6">
      <SectionTitle icon={Target} eyebrow="Performance" title="Weekly Reviews" />
      <div className="mt-5 space-y-3">
        {reviewCycles.map((cycle) => {
          const review = reviews.find(
            (r) =>
              (r.nepali_year === cycle.bsYear &&
                r.nepali_month === cycle.bsMonth &&
                r.week_number === cycle.weekNumber) ||
              r.week_start === cycle.startDate,
          );

          let statusLabel = "Available [Write Review]";
          let statusStyle = "bg-[#EEF2FF] text-[#6B8AE5] border-[#C4DAFF]";

          if (review) {
            statusLabel = "Completed";
            statusStyle = "bg-[#ECFDF5] text-[#10B981] border-[#A7F3D0]";
          } else if (cycle.unlockDate > todayDate) {
            statusLabel = "Locked";
            statusStyle = "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]";
          }

          return (
            <div
              key={cycle.weekNumber}
              className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm"
            >
              <div className="font-semibold text-[#0F172A]">Week {cycle.weekNumber}</div>
              <div
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusStyle}`}
              >
                {statusLabel}
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function EmployeeDashboard() {
  const { user, profile, isAdmin, isTeamLead } = useAuth();
  const { deviceStatus, setupBiometrics, busy: biometricsBusy } = useDeviceStatus();
  const [today, setToday] = useState<any>(null);
  const [monthStats, setMonthStats] = useState({ present: 0, late: 0, leave: 0, hours: 0 });
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    pending: 0,
    score: 0,
  });
  const [recent, setRecent] = useState<ActivityItem[]>([]);
  const [focusTasks, setFocusTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [moodHistory, setMoodHistory] = useState<MoodLog[]>([]);
  const [monthAward, setMonthAward] = useState<any>(null);
  const [latestImprovement, setLatestImprovement] = useState<any>(null);
  const [improvementOpen, setImprovementOpen] = useState(false);
  const [notificationPopup, setNotificationPopup] = useState<NotificationRow | null>(null);
  const [weeklyReviews, setWeeklyReviews] = useState<any[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | "active" | "overdue">("all");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [mood, setMood] = useState<string>("good");

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);
  const firstName = profile?.full_name?.split(" ")[0] || "Suwam";
  const nepaliMonth = getCurrentNepaliMonthRange();
  const nepaliToday = formatNepaliDate(new Date());

  const load = async () => {
    if (!user) return;

    const monthStart = nepaliMonth.startAd;
    const monthEnd = nepaliMonth.endAd;
    const historyStart = format(subDays(new Date(), 14), "yyyy-MM-dd");

    const [
      { data: t },
      { data: monthAttendance },
      { data: historyRows },
      awardResult,
      improvementResult,
      moodResult,
      feedbackResult,
    ] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayDate)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", monthStart)
        .lte("date", monthEnd),
      supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", historyStart)
        .order("date", { ascending: true }),
      (supabase as any)
        .from("employee_month_awards")
        .select("*")
        .eq("employee_id", user.id)
        .eq("month_start", monthStart)
        .maybeSingle(),
      (supabase as any)
        .from("weekly_feedback")
        .select("id,week_start,rating,improvements,created_at")
        .eq("employee_id", user.id)
        .not("improvements", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("mood_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("log_date", historyStart)
        .order("log_date", { ascending: false }),
      (supabase as any)
        .from("weekly_feedback")
        .select("*")
        .eq("employee_id", user.id)
        .gte("week_start", monthStart)
        .order("week_number", { ascending: true }),
    ]);

    setToday(t);
    setAttendanceHistory(historyRows ?? []);
    setMonthAward(awardResult.error ? null : awardResult.data);
    const improvement = improvementResult.error ? null : improvementResult.data;
    setLatestImprovement(improvement);
    if (improvement?.id && !isImprovementDismissed(user.id, improvement.id)) {
      setImprovementOpen(true);
    }
    if (!moodResult.error) {
      const moodRows = (moodResult.data || []) as MoodLog[];
      setMoodHistory(moodRows);
      const todayMood = moodRows.find((row) => row.log_date === todayDate);
      const cachedMood =
        typeof window !== "undefined"
          ? window.localStorage.getItem("employee-dashboard-mood")
          : null;
      setMood(todayMood?.mood || cachedMood || "good");
    }

    setWeeklyReviews(feedbackResult?.data || []);

    const monthRows = monthAttendance || [];
    const hours =
      Math.round(monthRows.reduce((sum, row) => sum + Number(row.work_hours || 0), 0) * 10) / 10;
    setMonthStats({
      present: monthRows.filter((row) => ["present", "late", "wfh"].includes(row.status)).length,
      late: monthRows.filter((row) => row.is_late).length,
      leave: monthRows.filter((row) => row.status === "leave").length,
      hours,
    });

    const [directTaskResult, assigneeResult, teamLeadResult] = await Promise.all([
      supabase.from("tasks").select("*").eq("assigned_to", user.id),
      supabase.from("task_assignees").select("task_id").eq("user_id", user.id),
      supabase.from("task_team_leads").select("task_id").eq("user_id", user.id),
    ]);
    const assignedTaskIds =
      assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : (assigneeResult.data || []).map((row) => row.task_id).filter(Boolean);
    const teamLeadTaskIds = teamLeadResult.data
      ? teamLeadResult.data.map((row) => row.task_id).filter(Boolean)
      : [];

    const allTaskIds = Array.from(new Set([...assignedTaskIds, ...teamLeadTaskIds]));

    const { data: multiAssignedTasks } = allTaskIds.length
      ? await supabase.from("tasks").select("*").in("id", allTaskIds)
      : { data: [] };
    const taskRows = Array.from(
      new Map(
        [...(directTaskResult.data || []), ...(multiAssignedTasks || [])].map((task) => [
          task.id,
          task,
        ]),
      ).values(),
    ).sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    const total = taskRows.length;
    const completed = taskRows.filter(isDashboardTaskComplete).length;
    const active = taskRows.filter(
      (task) =>
        !isDashboardTaskComplete(task) &&
        (task.status === "in_progress" || task.status === "review"),
    ).length;
    const pending = taskRows.filter((task) => !isDashboardTaskComplete(task)).length;
    const overdue = taskRows.filter(
      (task) =>
        task.deadline &&
        new Date(task.deadline).getTime() < Date.now() &&
        !isDashboardTaskComplete(task),
    ).length;
    const onTime = taskRows.filter(
      (task) =>
        isDashboardTaskComplete(task) &&
        (!task.deadline ||
          !task.completed_at ||
          new Date(task.completed_at) <= new Date(task.deadline)),
    ).length;
    const score = productivityScore({
      completed,
      total,
      onTimeRate: completed ? onTime / completed : 0,
      hours,
      targetHours: 160,
    });
    setTaskStats({ total, completed, active, overdue, pending, score });
    setFocusTasks(
      taskRows
        .filter((task) => !isDashboardTaskComplete(task))
        .sort((a, b) => {
          const aOverdue = a.deadline && new Date(a.deadline).getTime() < Date.now();
          const bOverdue = b.deadline && new Date(b.deadline).getTime() < Date.now();
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        })
        .slice(0, 3),
    );

    const { data: meetingRows } = await supabase
      .from("meetings")
      .select("*")
      .gte("meeting_time", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
      .order("meeting_time", { ascending: true })
      .limit(8);
    setMeetings(meetingRows ?? []);

    const [{ data: standups }] = await Promise.all([
      supabase
        .from("standups")
        .select("id,date,today,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
    const items = [
      ...(t?.check_in_time
        ? [
            {
              kind: "Attendance",
              when: t.check_in_time,
              text: `Checked in at ${format(new Date(t.check_in_time), "HH:mm")}`,
            },
          ]
        : []),
      ...(t?.check_out_time
        ? [
            {
              kind: "Attendance",
              when: t.check_out_time,
              text: `Checked out at ${format(new Date(t.check_out_time), "HH:mm")}`,
            },
          ]
        : []),
      ...taskRows
        .filter((task) => task.updated_at)
        .sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
        .slice(0, 5)
        .map((task: any) => ({
          kind: "Task",
          when: task.updated_at,
          text: `${task.title} moved to ${isDashboardTaskComplete(task) ? "completed" : humanize(task.status)}`,
        })),
      ...(standups || []).map((standup: any) => ({
        kind: "Standup",
        when: standup.updated_at,
        text: `Submitted standup for ${standup.date}`,
      })),
    ]
      .sort((a, b) => +new Date(b.when) - +new Date(a.when))
      .slice(0, 7);
    setRecent(items);

    const [
      { data: profileRows },
      { data: roleRows },
      { data: teamTasks },
      teamAssigneeResult,
      { data: teamAttendance },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, department, avatar_url")
        .eq("approval_status", "approved")
        .eq("is_suspended", false)
        .order("full_name"),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin", "hr_manager"]),
      supabase.from("tasks").select("*"),
      supabase.from("task_assignees").select("task_id,user_id"),
      supabase.from("attendance").select("*").gte("date", historyStart),
    ]);
    const teamAssignees =
      teamAssigneeResult.error &&
      isMissingSupabaseTableError(teamAssigneeResult.error, "task_assignees")
        ? []
        : teamAssigneeResult.data || [];
    setTeamLeaders(
      buildTeamLeaderboard({
        profiles: profileRows || [],
        roles: roleRows || [],
        tasks: teamTasks || [],
        assignees: teamAssignees,
        attendance: teamAttendance || [],
      }),
    );
  };

  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadUnreadNotification = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      const next = ((data ?? []) as NotificationRow[]).find(
        (notification) => !hasSeenNotification(notification.id),
      );
      if (next) showNotificationOnce(next);
    };

    loadUnreadNotification();

    const channel = supabase
      .channel(`dashboard-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => showNotificationOnce(payload.new as NotificationRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const checkIn = async () => {
    if (!user) return;
    if (!isAdmin) {
      if (deviceStatus === "setup_required")
        return toast.error(
          "Biometric registration required. Please go to the Check-in page to complete setup.",
        );
      if (deviceStatus !== "registered")
        return toast.error("Use an approved registered device to mark attendance.");
    }
    if (isWeeklyOff) return toast.info("Saturday is a weekly off. Attendance is not required.");
    setBusy(true);
    let location: Awaited<ReturnType<typeof getVerifiedAttendanceLocation>>;
    try {
      location = await getVerifiedAttendanceLocation();
    } catch (error) {
      setBusy(false);
      return toast.error(error instanceof Error ? error.message : "Unable to verify location");
    }
    const { data: settings } = await supabase
      .from("settings")
      .select("late_after_time")
      .limit(1)
      .maybeSingle();
    const now = new Date();
    const lateTime = settings?.late_after_time || "09:15:00";
    const [lh, lm] = lateTime.split(":").map(Number);
    const lateBoundary = new Date();
    lateBoundary.setHours(lh, lm, 0, 0);
    const isLate = now > lateBoundary;
    const { data: insertedToday, error } = await supabase
      .from("attendance")
      .insert({
        user_id: user.id,
        date: todayDate,
        check_in_time: now.toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        check_in_accuracy_meters: location.accuracy,
        status: isLate ? "late" : "present",
        is_late: isLate,
      })
      .select()
      .maybeSingle();
    setBusy(false);
    if (error || !insertedToday) return toast.error(error?.message ?? "Unable to check in");
    setToday(insertedToday);
    load();
    toast.success(isLate ? "Checked in (late)" : "Checked in");
  };

  const checkOut = async () => {
    if (!user || !today) return;
    if (!isAdmin) {
      if (deviceStatus === "setup_required")
        return toast.error(
          "Biometric registration required. Please go to the Check-in page to complete setup.",
        );
      if (deviceStatus !== "registered")
        return toast.error("Use an approved registered device to mark attendance.");
    }
    setBusy(true);
    let location: Awaited<ReturnType<typeof getVerifiedAttendanceLocation>>;
    try {
      location = await getVerifiedAttendanceLocation();
    } catch (error) {
      setBusy(false);
      return toast.error(error instanceof Error ? error.message : "Unable to verify location");
    }
    const now = new Date();
    const { data: settings } = await supabase
      .from("settings")
      .select("office_end_time")
      .limit(1)
      .maybeSingle();
    const isEarlyCheckout = isBeforeOfficeEnd(now, settings?.office_end_time);
    const inT = new Date(today.check_in_time);
    const hours = Math.round(((now.getTime() - inT.getTime()) / 3600000) * 100) / 100;
    const { data: updatedToday, error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_accuracy_meters: location.accuracy,
        is_early_checkout: isEarlyCheckout,
        work_hours: hours,
      })
      .eq("id", today.id)
      .select()
      .maybeSingle();
    setBusy(false);
    if (error || !updatedToday) return toast.error(error?.message ?? "Unable to check out");
    setToday(updatedToday);
    load();
    toast.success(`Checked out - ${formatWorkHours(hours)} worked`);
  };

  const status = isWeeklyOff
    ? WEEKLY_OFF_LABEL
    : !today
      ? "Not checked in"
      : today.check_out_time
        ? "Day completed"
        : "Working";
  const workedHours = liveWorkedHours(today, nowTick);
  const weeklyWorkedHours = useMemo(
    () => calculateWeeklyWorkedHours(attendanceHistory, today, workedHours),
    [attendanceHistory, today, workedHours],
  );
  const workProgress = Math.min(100, Math.round((workedHours / 8) * 100));
  const attendanceStreak = calculateAttendanceStreak(attendanceHistory, today);
  const weeklyProgress = calculateWeeklyProgress(attendanceHistory, today);
  const todayMeetings = meetings
    .filter((meeting) => isSameDay(new Date(meeting.meeting_time), new Date()))
    .slice(0, 3);
  const heatmapDays = useMemo(() => makeHeatmapDays(attendanceHistory), [attendanceHistory]);
  const heatmapSummary = useMemo(
    () => summarizeHeatmap(heatmapDays, attendanceStreak, attendanceHistory, today),
    [heatmapDays, attendanceStreak, attendanceHistory, today],
  );
  const pendingLeaveRequests = monthStats.leave;
  const attendanceRate = heatmapSummary.rate;
  const weeklyHoursProgress = Math.min(
    100,
    Math.round((weeklyWorkedHours / WEEKLY_TARGET_HOURS) * 100),
  );
  const scoreBreakdown = [
    { label: "Attendance", value: attendanceRate || 88, color: "#22d3ee" },
    {
      label: "Task Completion",
      value: taskStats.total ? Math.round((taskStats.completed / taskStats.total) * 100) : 72,
      color: "#8b5cf6",
    },
    {
      label: "Standup Consistency",
      value: recent.some((item) => item.kind === "Standup") ? 92 : 68,
      color: "#ec4899",
    },
    { label: "Focus Hours", value: weeklyHoursProgress, color: "#34d399" },
  ];
  const employeeScore = Math.round(
    scoreBreakdown.reduce((sum, item) => sum + item.value, 0) / scoreBreakdown.length,
  );
  const chartData = makeDashboardChartData(
    attendanceHistory,
    today,
    focusTasks,
    weeklyWorkedHours,
    taskStats,
  );
  const filteredTasks = focusTasks.filter((task) => {
    if (taskFilter === "active") return task.status === "in_progress" || task.status === "review";
    if (taskFilter === "overdue")
      return task.deadline && new Date(task.deadline).getTime() < Date.now();
    return true;
  });
  const aiSummary = taskStats.overdue
    ? `${taskStats.overdue} overdue task${taskStats.overdue === 1 ? "" : "s"} need attention. Completing one today could lift your score by 8%.`
    : weeklyHoursProgress < 75
      ? "Your attendance is strong. Add more focus hours this week to reach the 42h target."
      : "Your attendance is excellent. Completing one more task today could improve your productivity score by 8%.";
  const recommendations = [
    attendanceRate >= 85 ? "Attendance is excellent." : "Improve attendance consistency this week.",
    taskStats.overdue
      ? `${taskStats.overdue} overdue task needs immediate focus.`
      : "No overdue tasks right now.",
    weeklyHoursProgress < 100 ? "Weekly hours are below target." : "Weekly hours are on target.",
    scoreBreakdown[3].value < 80 ? "Focus time needs improvement." : "Focus time is healthy.",
  ];
  const notifications = [
    {
      title: "Task reminders",
      text: taskStats.pending
        ? `${taskStats.pending} pending tasks in your queue.`
        : "No pending task reminders.",
    },
    {
      title: "Project updates",
      text: focusTasks.length
        ? `${focusTasks[0].title} is at ${focusTasks[0].progress || 0}%.`
        : "No active projects.",
    },
    {
      title: "Team mentions",
      text: todayMeetings.length ? "You have meeting activity today." : "No new team mentions.",
    },
    {
      title: "HR announcements",
      text: latestImprovement?.improvements
        ? "New weekly review available."
        : "No new HR announcements.",
    },
  ];
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  const dismissImprovement = () => {
    if (user && latestImprovement?.id) {
      markImprovementDismissed(user.id, latestImprovement.id);
    }
    setImprovementOpen(false);
  };

  const showNotificationOnce = (notification: NotificationRow) => {
    if (notification.is_read || hasSeenNotification(notification.id)) return;
    if (!isMeetingNotification(notification)) return;
    markNotificationSeen(notification.id);
    setNotificationPopup(notification);
  };

  const closeNotificationPopup = () => {
    setNotificationPopup(null);
  };

  const saveMood = async (value: string) => {
    if (!user) return;
    setMood(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("employee-dashboard-mood", value);
    }
    const optimisticRow: MoodLog = {
      user_id: user.id,
      mood: value,
      note: null,
      log_date: todayDate,
      updated_at: new Date().toISOString(),
    };
    setMoodHistory((current) => [
      optimisticRow,
      ...current.filter((row) => row.log_date !== todayDate),
    ]);
    const { data, error } = await (supabase as any)
      .from("mood_logs")
      .upsert(
        {
          user_id: user.id,
          mood: value,
          note: null,
          log_date: todayDate,
        },
        { onConflict: "user_id,log_date" },
      )
      .select()
      .maybeSingle();
    if (error) {
      toast.error(error.message || "Unable to save mood");
      return;
    }
    if (data) {
      setMoodHistory((current) => [
        data as MoodLog,
        ...current.filter((row) => row.log_date !== todayDate),
      ]);
    }
    toast.success("Mood saved for today");
  };

  return (
    <>
      <Dialog open={!isAdmin && deviceStatus === "setup_required"}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#4F46E5] text-xl">
              <Fingerprint className="h-6 w-6 animate-pulse" />
              Biometric Setup Required
            </DialogTitle>
            <DialogDescription className="text-base pt-3 text-slate-600">
              Before you can check in, you need to register this device for attendance using your
              device's built-in biometrics (like Face ID, Touch ID, or Windows Hello).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="bg-[#EEF2FF] rounded-lg p-4 border border-[#C4DAFF]">
              <p className="text-sm text-[#4338CA]">
                This is a one-time setup. Once registered, you won't need to authenticate with
                biometrics every day.
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end mt-2">
            <Button
              onClick={() => setupBiometrics()}
              disabled={biometricsBusy}
              className="w-full sm:w-auto bg-[#4F46E5] hover:bg-[#4338CA] text-white"
            >
              {biometricsBusy ? "Starting..." : "Start Setup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NotificationPopup
        notification={notificationPopup}
        meetings={meetings}
        blocked={improvementOpen}
        onClose={closeNotificationPopup}
      />

      <Dialog
        open={improvementOpen}
        onOpenChange={(open) => {
          if (!open) dismissImprovement();
          else setImprovementOpen(true);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-[18px] border border-[#E2E8F0] bg-[#f1f0ee] p-6 shadow-2xl sm:max-w-2xl text-[#0F172A]">
          <DialogHeader className="relative text-left">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#6B8AE5] shadow-sm">
                  <MessageSquare size={22} />
                </div>
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#EEF2FF] border border-[#C4DAFF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6B8AE5]">
                      HR Review
                    </span>
                    {latestImprovement?.rating && (
                      <span className="rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                        {latestImprovement.rating}
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-xl font-bold leading-snug text-[#0F172A] sm:text-2xl">
                    Weekly improvement note
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 text-sm font-medium leading-relaxed text-[#64748B]">
                    {latestImprovement?.week_start
                      ? `Your HR review for the week of ${formatNepaliDate(latestImprovement.week_start, "DD MMM YYYY")} BS`
                      : "Your latest HR weekly review"}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="relative grid gap-4">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#64748B]">
                <Target size={14} className="text-[#4F46E5]" />
                Focus Area
              </div>
              <p className="max-h-[38dvh] overflow-y-auto whitespace-pre-wrap pr-1 text-sm font-normal leading-relaxed text-[#0F172A] [scrollbar-color:#CBD5E1_transparent] [scrollbar-width:thin]">
                {latestImprovement?.improvements || "No improvement note was added for this week."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Next Step
                </div>
                <div className="mt-1 text-xs font-normal leading-relaxed text-[#64748B]">
                  Review the note and apply it to this week's focus tasks.
                </div>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  Visibility
                </div>
                <div className="mt-1 text-xs font-normal leading-relaxed text-[#64748B]">
                  This reminder appears once until you acknowledge it.
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="relative mt-6 flex-col gap-3 sm:flex-row sm:justify-end sm:space-x-0">
            <Button
              onClick={dismissImprovement}
              className="h-11 rounded-[14px] border-0 bg-gradient-to-r from-[#C4DAFF] to-[#E5CCFF] px-6 font-bold text-[#0F172A] shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 hover:from-[#B1CDFA] hover:to-[#D8B4FE]"
            >
              <CheckCheck size={16} className="mr-2" />
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Employee Dashboard"
          subtitle="Welcome back! Here's your attendance and work summary."
        />

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-[#f1f0ee] p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          <div className="relative grid gap-6 xl:grid-cols-[minmax(220px,.8fr)_minmax(300px,1fr)_minmax(360px,1.2fr)] xl:items-center">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheck size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">
                  Attendance
                </div>
                <div className="mt-1 text-lg font-bold leading-tight text-[#0F172A]">
                  Quick check-in
                </div>
                <div className="mt-0.5 text-sm font-medium text-[#64748B]">{status}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={checkIn}
                disabled={busy || isWeeklyOff || Boolean(today)}
                className="h-12 rounded-[14px] bg-gradient-to-r from-[#C4DAFF] to-[#E5CCFF] hover:from-[#B1CDFA] hover:to-[#D8B4FE] text-sm font-bold text-[#0F172A] shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <LogIn size={16} className="mr-2" /> Check In
              </Button>
              <Button
                onClick={checkOut}
                disabled={busy || !today || Boolean(today?.check_out_time)}
                variant="outline"
                className="h-12 rounded-[14px] border-[#E2E8F0] bg-[#f1f0ee] text-sm font-bold text-[#0F172A] hover:bg-[#F8FAFC] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <LogOut size={16} className="mr-2" /> Check Out
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoTile
                label="Check In"
                value={today?.check_in_time ? format(new Date(today.check_in_time), "HH:mm") : "--"}
              />
              <InfoTile
                label="Check Out"
                value={
                  today?.check_out_time ? format(new Date(today.check_out_time), "HH:mm") : "--"
                }
              />
              <InfoTile label="Worked" value={workedHours ? formatWorkHours(workedHours) : "--"} />
              <InfoTile label="Progress" value={`${workProgress}%`} />
            </div>
          </div>
        </motion.section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={BadgeCheck}
            title="Attendance"
            value={`${monthStats.present} days`}
            detail={`${attendanceRate}% rate · ${attendanceStreak} day streak`}
            tone="cyan"
          />
          <MetricCard
            icon={Gauge}
            title="Productivity"
            value={`${taskStats.score}%`}
            detail={`+${Math.max(0, taskStats.score - 72)}% trend · team avg 82%`}
            tone="purple"
          />
          <MetricCard
            icon={Target}
            title="Tasks"
            value={`${taskStats.completed}/${taskStats.total}`}
            detail={`${taskStats.pending} pending · ${taskStats.overdue} overdue`}
            tone="pink"
          />
          <MetricCard
            icon={Clock}
            title="Work Hours"
            value={formatWorkHours(weeklyWorkedHours)}
            detail={`${WEEKLY_TARGET_HOURS}h target · ${weeklyHoursProgress}%`}
            tone="green"
          />
        </section>

        <section className="grid gap-6">
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle
              icon={Bot}
              eyebrow="AI Performance"
              title="Overall employee score"
              action={`${employeeScore}/100`}
            />
            <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
              <RadialScore score={employeeScore} />
              <div className="space-y-4">
                {scoreBreakdown.map((item) => (
                  <ProgressLine key={item.label} {...item} />
                ))}
                <div className="rounded-xl border border-[#C4DAFF]/50 bg-[#EEF2FF]/40 p-4 text-xs font-semibold leading-relaxed text-[#5E7CCC]">
                  {aiSummary}
                </div>
              </div>
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle
              icon={Activity}
              eyebrow="Last 15 Days"
              title="Attendance heatmap"
              action={`${heatmapSummary.rate}%`}
            />
            <HeatmapGrid days={heatmapDays} />
            <div className="mt-6 grid grid-cols-3 gap-3">
              <InfoTile label="Current Streak" value={`${attendanceStreak}d`} />
              <InfoTile label="Best Streak" value={`${heatmapSummary.bestStreak}d`} />
              <InfoTile label="Holidays" value={`${heatmapSummary.holiday}`} />
            </div>
          </GlassPanel>
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle
              icon={ClipboardList}
              eyebrow="Today"
              title="Tasks command center"
              action={`${filteredTasks.length} visible`}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {(["all", "active", "overdue"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all duration-200 ${
                    taskFilter === filter
                      ? "bg-[#EEF2FF] border border-[#C4DAFF] text-[#6B8AE5]"
                      : "bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {filteredTasks.length ? (
                filteredTasks.map((task) => (
                  <TaskCommandCard key={task.id} task={task} nowTick={nowTick} />
                ))
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="No tasks in this filter"
                  text="Your work queue is calm."
                />
              )}
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-4">
          <ChartPanel title="Weekly productivity" icon={BarChart3}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={chartData.weekly}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#A7C5FF" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Monthly productivity" icon={TrendingUp}>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData.monthly}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#D8B4FE"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Focus hours" icon={PieChartIcon}>
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={chartData.focus}
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.focus.map((entry, index) => (
                    <Cell key={entry.name} fill={["#A7C5FF", "#D8B4FE", "#F97316"][index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Task completion trend" icon={CheckCircle2}>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData.tasks}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#10B981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle
              icon={Briefcase}
              eyebrow="Projects"
              title="Active contribution"
              action={`${focusTasks.length} live`}
            />
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {focusTasks.length > 0 ? (
                focusTasks.map((task) => (
                  <ProjectCard
                    key={task.id}
                    project={{
                      name: task.title,
                      progress: task.progress || 0,
                      deadline: task.deadline
                        ? format(new Date(task.deadline), "dd MMM")
                        : "No deadline",
                      members: [initials(firstName)],
                      status:
                        STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status,
                    }}
                  />
                ))
              ) : (
                <EmptyState
                  icon={Briefcase}
                  title="No active contributions"
                  text="You have no active tasks currently."
                />
              )}
            </div>
          </GlassPanel>
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={Award} eyebrow="Gamification" title="Achievements" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              {BADGES.map((badge) => (
                <AchievementBadge key={badge.label} badge={badge} />
              ))}
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={Trophy} eyebrow="Team" title="Leaderboard" action="Live" />
            <div className="mt-5 space-y-3">
              {teamLeaders.length ? (
                teamLeaders.map((member, index) => (
                  <LeaderboardRow key={member.userId} member={member} rank={index + 1} />
                ))
              ) : (
                <EmptyState
                  icon={Users}
                  title="No team ranking yet"
                  text="Approved employees will appear after attendance or task activity is available."
                />
              )}
            </div>
          </GlassPanel>
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={Sparkles} eyebrow="AI" title="Recommendations" />
            <div className="mt-5 space-y-3">
              {recommendations.map((item) => (
                <InsightCard key={item} text={item} />
              ))}
            </div>
          </GlassPanel>
          <MoodTrackerPanel mood={mood} history={moodHistory} onSave={saveMood} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={Plus} eyebrow="Workflow" title="Quick actions" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ActionCard to="/tasks" icon={Plus} label="Create Task" />
              <ActionCard to="/standup" icon={MessageSquare} label="Submit Standup" />
              <ActionCard to="/my-leaves" icon={Calendar} label="Request Leave" />
              <ActionCard to="/my-attendance" icon={BarChart3} label="View Reports" />
              <ActionCard to="/my-attendance" icon={History} label="Attendance History" />
              <ActionCard to="/meetings" icon={Users} label="Team Chat" />
            </div>
          </GlassPanel>
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={Calendar} eyebrow="Leave" title="Leave management" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <LeaveRing label="Annual" value={12} total={18} />
              <LeaveRing label="Sick" value={5} total={8} />
              <LeaveRing label="Casual" value={4} total={6} />
              <InfoTile label="Pending" value={`${pendingLeaveRequests}`} />
            </div>
          </GlassPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <EmployeeWeeklyReviews reviews={weeklyReviews} />
          <ActivityTimelinePanel items={recent} />
          <GlassPanel className="p-5 sm:p-6">
            <SectionTitle icon={BellDot} eyebrow="Live" title="Notification center" />
            <div className="mt-5 space-y-3">
              {notifications.map((item) => (
                <NotificationCard key={item.title} {...item} />
              ))}
            </div>
          </GlassPanel>
        </section>
      </div>

      {/* eslint-disable-next-line no-constant-binary-expression */}
      {false && (
        <main className="employee-dashboard">
          <header className="employee-dashboard-header">
            <div className="min-w-0">
              <div className="employee-dashboard-kicker">Aslenix Attendance</div>
              <h1>Hello, {firstName} 👋</h1>
              <p>{nepaliToday} BS</p>
            </div>
            <div className="employee-dashboard-toolbar">
              <div className="employee-header-clock">
                <LiveClock className="employee-live-clock" />
              </div>
            </div>
          </header>

          {monthAward && (
            <section className="employee-award-card">
              <div className="employee-award-icon">
                <Crown size={28} />
              </div>
              <div className="min-w-0">
                <div className="employee-dashboard-kicker">Employee of the Month</div>
                <h2>Congratulations, {firstName}</h2>
                <p>
                  {monthAward.public_message ||
                    `You earned the official ASLENIX monthly badge with a ${monthAward.score}/100 score.`}
                </p>
              </div>
              <div className="employee-award-score">
                <span>{monthAward.score}</span>
                Award score
              </div>
            </section>
          )}

          <section className="employee-kpi-grid">
            <DashboardKpi
              label={`Present Days · ${nepaliMonth.label} BS`}
              value={monthStats.present}
              trend={`+${attendanceStreak} day streak`}
              icon={BadgeCheck}
              tone="green"
            />
            <DashboardKpi
              label="Hours Worked This Week"
              value={formatWorkHours(weeklyWorkedHours)}
              trend={`${Math.round((weeklyWorkedHours / WEEKLY_TARGET_HOURS) * 100)}% of 42h target`}
              icon={Clock}
              tone="blue"
            />
            <DashboardKpi
              label="Pending Tasks"
              value={taskStats.pending}
              trend={taskStats.overdue ? `${taskStats.overdue} overdue` : "No overdue tasks"}
              icon={Target}
              tone={taskStats.overdue ? "red" : "amber"}
            />
            <DashboardKpi
              label="Productivity Score"
              value={`${taskStats.score}%`}
              trend={`${taskStats.completed}/${taskStats.total} completed`}
              icon={Gauge}
              tone="pink"
            />
          </section>

          <section className="employee-main-grid">
            <article className="employee-panel employee-attendance-panel">
              <div className="employee-panel-heading">
                <div>
                  <span>Today's Attendance</span>
                  <h2>{status}</h2>
                </div>
                <StatusDot status={status} />
              </div>
              {isAdmin ? (
                <div className="employee-action-row employee-action-row-top">
                  <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-muted-foreground">
                    Admin attendance is not required.
                  </div>
                </div>
              ) : (
                <div className="employee-action-row employee-action-row-top">
                  <Button
                    onClick={checkIn}
                    disabled={busy || isWeeklyOff || Boolean(today)}
                    className="neon-button h-12 rounded-xl"
                  >
                    <LogIn size={17} className="mr-2" />
                    Check In
                  </Button>
                  <Button
                    onClick={checkOut}
                    disabled={busy || !today || Boolean(today?.check_out_time)}
                    variant="outline"
                    className="h-12 rounded-xl"
                  >
                    <LogOut size={17} className="mr-2" />
                    Check Out
                  </Button>
                </div>
              )}
              <div className="employee-attendance-body">
                <WorkHoursRing progress={workProgress} hours={workedHours} />
                <div className="employee-attendance-details">
                  <MiniMetric
                    label="Check In"
                    value={
                      today?.check_in_time ? format(new Date(today.check_in_time), "HH:mm") : "--"
                    }
                  />
                  <MiniMetric
                    label="Check Out"
                    value={
                      today?.check_out_time ? format(new Date(today.check_out_time), "HH:mm") : "--"
                    }
                  />
                  <MiniMetric
                    label="Working Hours"
                    value={workedHours ? formatWorkHours(workedHours) : "--"}
                  />
                  <MiniMetric label="Attendance Streak" value={`${attendanceStreak} days`} />
                </div>
              </div>
              <div className="employee-week-progress">
                <div>
                  <span>Weekly Attendance Progress</span>
                  <strong>
                    {weeklyProgress}/{WEEKLY_WORKING_DAYS} days
                  </strong>
                </div>
                <div className="employee-progress-track">
                  <div
                    style={{
                      width: `${Math.min(100, (weeklyProgress / WEEKLY_WORKING_DAYS) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </article>

            <article className="employee-panel employee-quick-panel">
              <div className="employee-panel-heading compact">
                <div>
                  <span>Next Actions</span>
                  <h2>Quick Actions</h2>
                </div>
                <ArrowUpRight size={20} />
              </div>
              <div className="employee-quick-grid">
                <QuickActionLink to="/tasks" icon={Target} label="My Tasks" />
                <QuickActionLink to="/standup" icon={Activity} label="Daily Standup" />
                <QuickActionLink to="/my-leaves" icon={Calendar} label="Request Leave" />
                <QuickActionLink to="/my-attendance" icon={History} label="Attendance History" />
                <QuickActionLink to="/meetings" icon={Video} label="Meetings" />
                <QuickActionLink to="/profile" icon={UserRoundCog} label="Update Profile" />
              </div>
            </article>
          </section>

          <section className="employee-work-grid">
            <article className="employee-panel">
              <div className="employee-panel-heading compact">
                <div>
                  <span>Work Management</span>
                  <h2>Overdue & Active Tasks</h2>
                </div>
                <Link to="/tasks" className="employee-pill-link">
                  Open Tasks
                </Link>
              </div>
              <div className="employee-task-list">
                {focusTasks.length ? (
                  focusTasks.map((task) => (
                    <TaskFocusCard key={task.id} task={task} nowTick={nowTick} />
                  ))
                ) : (
                  <EmptyPanel
                    icon={CheckCircle2}
                    title="No urgent tasks"
                    text="Your active work queue is clear."
                  />
                )}
              </div>
            </article>

            <article className="employee-panel">
              <div className="employee-panel-heading compact">
                <div>
                  <span>Schedule</span>
                  <h2>Today's Meetings</h2>
                </div>
                <Link to="/meetings" className="employee-pill-link">
                  All Meetings
                </Link>
              </div>
              <div className="employee-meeting-list">
                {todayMeetings.length ? (
                  todayMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)
                ) : (
                  <EmptyPanel
                    icon={CalendarClock}
                    title="No meetings scheduled today"
                    text="Your calendar is clear for focused work."
                  />
                )}
              </div>
            </article>
          </section>

          <section className="employee-analytics-grid">
            <article className="employee-panel employee-heatmap-panel">
              <div className="employee-panel-heading compact">
                <div>
                  <span className="employee-heatmap-kicker">
                    <Activity size={14} />
                    Last 15 Days
                  </span>
                  <h2>Attendance Heatmap</h2>
                </div>
                <div className="employee-heatmap-summary" aria-label="Attendance summary">
                  <HeatmapSummaryPill
                    label="Present"
                    value={heatmapSummary.present}
                    tone="present"
                  />
                  <HeatmapSummaryPill label="Late" value={heatmapSummary.late} tone="late" />
                  <HeatmapSummaryPill label="Absent" value={heatmapSummary.absent} tone="absent" />
                  <HeatmapSummaryPill
                    label="Holiday"
                    value={heatmapSummary.holiday}
                    tone="holiday"
                  />
                </div>
              </div>
              <div className="employee-heatmap">
                {heatmapDays.map((day) => (
                  <span
                    key={day.date}
                    className={`heatmap-cell ${day.status}`}
                    title={`${day.date}: ${humanize(day.status)}`}
                  >
                    <span className="heatmap-tooltip">
                      <strong>{day.date}</strong>
                      <span>{humanize(day.status)}</span>
                      <small>Check-in: {formatHeatmapTime(day.checkIn)}</small>
                      <small>Check-out: {formatHeatmapTime(day.checkOut)}</small>
                    </span>
                  </span>
                ))}
              </div>
              <div className="employee-heatmap-stats">
                <HeatmapStatPill label="Attendance Rate" value={`${heatmapSummary.rate}%`} />
                <HeatmapStatPill label="Current Streak" value={`${attendanceStreak} Days`} />
                <HeatmapStatPill label="Best Streak" value={`${heatmapSummary.bestStreak} Days`} />
              </div>
              <div className="employee-heatmap-legend">
                <LegendDot tone="present" label="Present" />
                <LegendDot tone="late" label="Late" />
                <LegendDot tone="absent" label="Absent" />
                <LegendDot tone="holiday" label="Holiday" />
              </div>
            </article>

            <article className="employee-panel">
              <div className="employee-panel-heading compact">
                <div>
                  <span>Activity Feed</span>
                  <h2>Recent Activity</h2>
                </div>
              </div>
              <div className="employee-timeline">
                {recent.length ? (
                  recent.map((item, index) => (
                    <TimelineItem key={`${item.kind}-${item.when}-${index}`} item={item} />
                  ))
                ) : (
                  <EmptyPanel
                    icon={Activity}
                    title="No recent activity"
                    text="Task, attendance, and standup events will appear here."
                  />
                )}
              </div>
            </article>
          </section>

          <section className="employee-panel employee-insights">
            <div className="employee-panel-heading compact">
              <div>
                <span>AI Productivity Insights</span>
                <h2>Recommended focus for today</h2>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="employee-insight-grid">
              <InsightItem icon={Flame} text={`Attendance streak: ${attendanceStreak} days`} />
              <InsightItem
                icon={TrendingUp}
                text={`Productivity score is ${taskStats.score}% this month`}
              />
              <InsightItem
                icon={Target}
                text={
                  taskStats.overdue
                    ? `${taskStats.overdue} task requires immediate attention`
                    : "No overdue tasks right now"
                }
              />
              <InsightItem
                icon={Calendar}
                text={
                  pendingLeaveRequests
                    ? `${pendingLeaveRequests} leave day this month`
                    : "No pending leave requests"
                }
              />
            </div>
          </section>
        </main>
      )}
    </>
  );
}

const chartTooltipStyle = {
  background: "#f1f0ee",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  boxShadow: "0 4px 12px rgba(15,23,42,0.06)",
  color: "#0F172A",
  fontSize: 12,
};

function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      className={`relative overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-[#f1f0ee] shadow-[0_8px_24px_rgba(15,23,42,0.08)] ${className}`}
    >
      <div className="relative">{children}</div>
    </motion.article>
  );
}

function Badge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C4DAFF] bg-[#EEF2FF]/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B8AE5]">
      <Icon size={12} className="text-[#4F46E5]/80" />
      {label}
    </span>
  );
}

function HeroChip({
  icon: Icon,
  label,
  className = "",
}: {
  icon: any;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-102 ${className}`}
    >
      <Icon size={14} className="shrink-0" />
      {label}
    </span>
  );
}

function HeroMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-3 text-center shadow-sm">
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{label}</div>
      <div className="mt-1 text-lg font-bold text-[#0F172A]">{value}</div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: any;
  title: string;
  value: string;
  detail: string;
  tone: "cyan" | "purple" | "pink" | "green";
}) {
  const badgeColors = {
    cyan: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    pink: "bg-orange-50 text-orange-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-[18px] border border-[#E2E8F0] bg-[#f1f0ee] p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${badgeColors[tone]}`}>
        <Icon size={22} />
      </div>
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
        {title}
      </div>
      <div className="mt-1 text-3xl font-bold text-[#0F172A]">{value}</div>
      <div className="mt-2 text-xs font-normal text-[#64748B]">{detail}</div>
    </motion.article>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
  action,
}: {
  icon: any;
  eyebrow: string;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            {eyebrow}
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#0F172A] sm:text-xl">
            {title}
          </h2>
        </div>
      </div>
      {action && (
        <span className="shrink-0 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#64748B]">
          {action}
        </span>
      )}
    </div>
  );
}

function RadialScore({ score }: { score: number }) {
  return (
    <div className="grid place-items-center">
      <div
        className="relative grid h-48 w-48 place-items-center rounded-full bg-[conic-gradient(from_180deg,#4F46E5_calc(var(--score)*1%),#E2E8F0_0)] p-3"
        style={{ ["--score" as string]: score }}
      >
        <div className="grid h-full w-full place-items-center rounded-full border border-[#E2E8F0] bg-[#f1f0ee] shadow-sm">
          <div className="text-center">
            <div className="text-4xl font-bold text-[#0F172A]">{score}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              AI Score
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-[#64748B]">
        <span>{label}</span>
        <span className="text-[#0F172A]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-bold text-[#0F172A]">{value}</div>
    </div>
  );
}

function HeatmapGrid({ days }: { days: HeatmapDay[] }) {
  const colors: Record<HeatmapDay["status"], string> = {
    present: "bg-[#10B981]",
    late: "bg-[#F59E0B]",
    absent: "bg-[#EF4444]",
    holiday: "bg-[#0EA5E9]",
    none: "bg-[#F1F5F9] border border-[#E2E8F0]",
  };
  return (
    <div className="mt-5 grid grid-cols-15 gap-2">
      {days.map((day) => (
        <span
          key={day.date}
          title={`${day.date}: ${humanize(day.status)}`}
          className={`group relative aspect-square rounded-md ${colors[day.status]} transition-transform duration-200 hover:scale-110 shadow-sm`}
        />
      ))}
    </div>
  );
}

function TaskCommandCard({ task, nowTick, onComplete, ...props }: any) {
  const countdown = getTaskCountdown(task.deadline, nowTick);
  const priority =
    countdown.state === "overdue" ? "High" : countdown.state === "soon" ? "Medium" : "Normal";

  const priorityColors = {
    High: "bg-red-50 text-red-600 border border-red-100",
    Medium: "bg-amber-50 text-amber-700 border border-amber-100",
    Normal: "bg-[#EEF2FF] text-[#6B8AE5] border border-[#C4DAFF]",
  };

  return (
    <motion.article
      whileHover={{ y: -2 }}
      {...props}
      className="cursor-grab rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-5 active:cursor-grabbing shadow-sm hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-[#0F172A] text-sm sm:text-base">{task.title}</h3>
          <p className="mt-1 truncate text-xs font-normal text-[#64748B]">
            {task.project_name || task.project || "Aslenix Workstream"}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${priorityColors[priority]}`}
        >
          {priority}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-normal text-[#64748B]">
        <span>{task.deadline ? format(new Date(task.deadline), "h:mm a") : "No due time"}</span>
        <span>·</span>
        <span>{humanize(task.status || "pending")}</span>
        <span>·</span>
        <span className={countdown.state === "overdue" ? "text-red-500 font-medium" : ""}>
          {countdown.label}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#6366F1]"
          style={{ width: `${task.progress || 0}%` }}
        />
      </div>
      <button
        onClick={onComplete}
        className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#f1f0ee] px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors duration-200"
      >
        Mark complete
      </button>
    </motion.article>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
      <Icon className="mx-auto text-[#64748B]/60" size={24} />
      <div className="mt-3 font-bold text-[#0F172A] text-sm">{title}</div>
      <div className="mt-1 text-xs text-[#64748B]">{text}</div>
    </div>
  );
}

function ChartPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <GlassPanel className="p-5 sm:p-6">
      <SectionTitle icon={Icon} eyebrow="Analytics" title={title} />
      <div className="mt-5">{children}</div>
    </GlassPanel>
  );
}

function ProjectCard({ project }: { project: any }) {
  return (
    <motion.article
      whileHover={{ y: -2 }}
      className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-5 shadow-sm hover:shadow-md transition-all duration-200"
    >
      <h3 className="font-bold text-[#0F172A] text-sm sm:text-base">{project.name}</h3>
      <p className="mt-1 text-xs font-normal text-[#64748B]">
        {project.status} · {project.deadline}
      </p>
      <div className="mt-4 h-1.5 rounded-full bg-[#F1F5F9]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#C4DAFF] to-[#E5CCFF]"
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs font-bold text-[#0F172A]">{project.progress}%</span>
        <div className="flex -space-x-2">
          {project.members.map((m: string) => (
            <span
              key={m}
              className="grid h-7 w-7 place-items-center rounded-full border border-[#E2E8F0] bg-[#f1f0ee] text-[10px] font-bold text-[#64748B]"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

function AchievementBadge({ badge }: { badge: any }) {
  const Icon = badge.icon;
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      className={`rounded-[14px] border p-4 text-center transition-all duration-200 ${
        badge.active
          ? "border-[#C4DAFF]/60 bg-[#EEF2FF] text-[#6B8AE5] shadow-sm"
          : "border-[#E2E8F0] bg-[#f1f0ee] opacity-60 text-[#64748B]"
      }`}
    >
      <Icon
        className={`mx-auto ${badge.active ? "text-[#8CAAF0]" : "text-[#64748B]/70"}`}
        size={22}
      />
      <div className="mt-2 text-xs font-semibold text-[#0F172A]">{badge.label}</div>
    </motion.div>
  );
}

function LeaderboardRow({ member, rank }: { member: TeamLeader; rank: number }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-3 shadow-sm">
      <div className="relative h-10 w-10 shrink-0">
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-xl object-cover ring-2 ring-[#E2E8F0]"
          />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#F1F5F9] text-sm font-bold text-[#6B8AE5]">
            {initials(member.name)}
          </div>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[10px] font-bold text-[#64748B]">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-[#0F172A] text-sm">{member.name}</div>
        <div className="text-xs font-normal text-[#64748B]">{member.department}</div>
      </div>
      <div className="font-bold text-[#6B8AE5] text-sm">{member.score} pts</div>
    </div>
  );
}

function InsightCard({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
      <Sparkles className="mt-0.5 shrink-0 text-[#A7C5FF]" size={16} />
      <span className="text-xs font-medium leading-5 text-[#64748B]">{text}</span>
    </div>
  );
}

function MoodTrackerPanel({
  mood,
  history,
  onSave,
}: {
  mood: string;
  history: MoodLog[];
  onSave: (value: string) => void;
}) {
  const current = getMoodMeta(mood);
  const recent = history.slice(0, 7);
  const average = recent.length
    ? Math.round(recent.reduce((sum, item) => sum + getMoodScore(item.mood), 0) / recent.length)
    : getMoodScore(mood);
  const trend =
    average >= 82
      ? "Healthy"
      : average >= 64
        ? "Steady"
        : average >= 46
          ? "Needs rest"
          : "Needs support";

  return (
    <GlassPanel className="p-5 sm:p-6">
      <SectionTitle icon={Smile} eyebrow="Wellbeing" title="Mood tracker" action={trend} />
      <div className="mt-5 grid grid-cols-5 gap-2">
        {MOODS.map((item) => (
          <button
            key={item.value}
            onClick={() => onSave(item.value)}
            className={`rounded-xl border p-2.5 text-center transition hover:-translate-y-0.5 ${
              mood === item.value
                ? "border-[#C4DAFF] bg-[#EEF2FF] text-[#6B8AE5] shadow-sm"
                : "border-[#E2E8F0] bg-[#f1f0ee] hover:bg-[#F8FAFC]"
            }`}
            aria-label={`Save mood as ${item.label}`}
            type="button"
          >
            <div className="text-xl">{item.emoji}</div>
            <div className="mt-1 text-[9px] font-semibold text-[#64748B]">{item.label}</div>
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#0F172A]">{current.label} today</div>
            <div className="mt-1 text-[10px] font-normal text-[#64748B]">
              {history.length
                ? `${history.length} saved mood logs`
                : "Save today's mood to start the trend"}
            </div>
          </div>
          <div className="text-2xl">{current.emoji}</div>
        </div>
        <div className="mt-4 flex items-end gap-2">
          {recent.length ? (
            recent.map((item) => (
              <span
                key={`${item.log_date}-${item.mood}`}
                title={`${item.log_date}: ${getMoodMeta(item.mood).label}`}
                className="grid h-8 flex-1 place-items-center rounded-lg border border-[#E2E8F0] bg-[#f1f0ee] text-base shadow-sm"
              >
                {getMoodMeta(item.mood).emoji}
              </span>
            ))
          ) : (
            <div className="w-full rounded-lg border border-dashed border-[#E2E8F0] p-3 text-center text-xs font-semibold text-[#64748B]">
              No mood history yet
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

function ActionCard({
  to,
  icon: Icon,
  label,
}: {
  to: "/tasks" | "/standup" | "/my-leaves" | "/my-attendance" | "/meetings";
  icon: any;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-5 font-semibold text-[#0F172A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C4DAFF] hover:bg-[#EEF2FF]/50 hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#6B8AE5] mb-3">
        <Icon size={20} />
      </div>
      <span className="text-sm">{label}</span>
    </Link>
  );
}

function LeaveRing({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = Math.round((value / total) * 100);
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-4 text-center shadow-sm">
      <div
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[conic-gradient(#4F46E5_calc(var(--pct)*1%),#F1F5F9_0)]"
        style={{ ["--pct" as string]: pct }}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#f1f0ee] text-xs font-bold text-[#0F172A] shadow-inner">
          {value}
        </div>
      </div>
      <div className="mt-3 text-xs font-semibold text-[#64748B]">{label}</div>
    </div>
  );
}

function ActivityTimelinePanel({ items }: { items: ActivityItem[] }) {
  const attendanceCount = items.filter((item) => item.kind === "Attendance").length;
  const taskCount = items.filter((item) => item.kind === "Task").length;
  const latest = items[0]?.when ? formatDistanceLabel(items[0].when) : "No activity";

  return (
    <GlassPanel className="p-5 sm:p-6">
      <SectionTitle icon={Activity} eyebrow="Activity" title="Timeline" action={latest} />
      <div className="mt-5 grid grid-cols-3 gap-2">
        <TimelineStat label="Events" value={items.length} />
        <TimelineStat label="Attendance" value={attendanceCount} />
        <TimelineStat label="Tasks" value={taskCount} />
      </div>
      <div className="mt-5">
        {items.length ? (
          <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[22px] before:top-6 before:w-px before:bg-gradient-to-b before:from-[#4F46E5]/40 before:via-slate-200 before:to-transparent">
            {items.map((item, index) => (
              <ModernTimelineItem
                key={`${item.kind}-${item.when}-${index}`}
                item={item}
                isLatest={index === 0}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            text="Attendance, standup, and task events will appear here."
          />
        )}
      </div>
    </GlassPanel>
  );
}

function TimelineStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-3 text-center shadow-sm">
      <div className="text-base font-bold text-[#0F172A]">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
        {label}
      </div>
    </div>
  );
}

function ModernTimelineItem({ item, isLatest }: { item: ActivityItem; isLatest: boolean }) {
  const meta = getActivityMeta(item);
  const Icon = meta.icon;
  return (
    <motion.article
      initial={{ opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className={`relative flex gap-3 rounded-[14px] border p-3 transition hover:-translate-y-0.5 ${
        isLatest
          ? "border-[#C4DAFF] bg-[#EEF2FF]/50"
          : "border-[#E2E8F0] bg-[#f1f0ee] hover:bg-[#f1f0ee]"
      }`}
    >
      <div
        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.badgeClass}`}
      >
        {isLatest && <span className="absolute inset-0 animate-ping rounded-xl bg-[#C4DAFF]/30" />}
        <Icon className="relative" size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#0F172A]">{item.text}</div>
            <div className="mt-0.5 text-xs font-normal text-[#64748B]">
              {formatNepaliDate(item.when, "DD MMM")} BS · {format(new Date(item.when), "h:mm a")}
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${meta.pillClass}`}
          >
            {item.kind}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function NotificationCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[14px] border border-[#E2E8F0] bg-[#f1f0ee] p-4 shadow-sm">
      <div className="font-semibold text-sm text-[#0F172A]">{title}</div>
      <div className="mt-1 text-xs font-normal leading-relaxed text-[#64748B]">{text}</div>
    </div>
  );
}

function CloudLikeIcon(props: React.ComponentProps<typeof Sparkles>) {
  return <Sparkles {...props} />;
}

function makeDashboardChartData(
  rows: any[],
  today: any,
  tasks: any[],
  weeklyHours: number,
  taskStats: any,
) {
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    const row = rows.find((item) => item.date === format(date, "yyyy-MM-dd"));
    const presentScore = row && ["present", "late", "wfh"].includes(row.status) ? 80 : 40;
    return { day: format(date, "EEE"), score: row?.is_late ? 68 : presentScore };
  });
  const monthly = Array.from({ length: 8 }, (_, index) => ({
    day: `W${index + 1}`,
    score: Math.min(100, 58 + index * 4 + Math.round(taskStats.score / 10)),
  }));
  const completed = Number(taskStats.completed || 0);
  const taskTrend = Array.from({ length: 7 }, (_, index) => {
    const dayProgress = Math.max(0, completed - (6 - index));
    return { day: format(subDays(new Date(), 6 - index), "EEE"), completed: dayProgress };
  });
  const focus = [
    { name: "Worked", value: Math.round(weeklyHours) },
    { name: "Remaining", value: Math.max(0, WEEKLY_TARGET_HOURS - Math.round(weeklyHours)) },
    { name: "Task load", value: Math.max(1, tasks.length * 4) },
  ];
  return { weekly, monthly, focus, tasks: taskTrend };
}

function buildTeamLeaderboard({
  profiles,
  roles,
  tasks,
  assignees,
  attendance,
}: {
  profiles: any[];
  roles: any[];
  tasks: any[];
  assignees: any[];
  attendance: any[];
}): TeamLeader[] {
  const adminUserIds = new Set((roles || []).map((row) => row.user_id));
  return (profiles || [])
    .filter((profile) => profile?.user_id && !adminUserIds.has(profile.user_id))
    .map((profile) => {
      const assignedTasks = (tasks || []).filter(
        (task) =>
          task.assigned_to === profile.user_id ||
          (assignees || []).some(
            (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
          ),
      );
      const employeeAttendance = (attendance || []).filter(
        (row) => row.user_id === profile.user_id,
      );
      const presentDays = new Set(
        employeeAttendance
          .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
          .map((row) => row.date),
      ).size;
      const lateDays = employeeAttendance.filter((row) => row.is_late).length;
      const completedTasks = assignedTasks.filter(isDashboardTaskComplete).length;
      const taskCompletion = assignedTasks.length
        ? Math.round((completedTasks / assignedTasks.length) * 100)
        : 55;
      const attendanceScore = employeeAttendance.length
        ? Math.round((presentDays / Math.max(1, employeeAttendance.length)) * 100)
        : 45;
      const punctualityScore = Math.max(45, 100 - lateDays * 8);
      const score = Math.round(
        taskCompletion * 0.48 + attendanceScore * 0.36 + punctualityScore * 0.16,
      );
      return {
        userId: profile.user_id,
        name: profile.full_name || "Employee",
        department: profile.department || "Unassigned",
        avatarUrl: profile.avatar_url || null,
        score: Math.min(100, Math.max(0, score)),
      };
    })
    .filter((employee) => employee.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 4);
}

function NotificationPopup({
  notification,
  meetings,
  blocked,
  onClose,
}: {
  notification: NotificationRow | null;
  meetings: any[];
  blocked: boolean;
  onClose: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const meeting = useMemo(
    () => getNotificationMeeting(notification, meetings),
    [notification, meetings],
  );
  const meetingTime = meeting?.meeting_time
    ? new Date(meeting.meeting_time)
    : new Date(notification?.created_at ?? Date.now());
  const isRescheduled = Boolean(
    notification &&
    /reschedul|postpon|updated|changed|now on/i.test(
      `${notification.title} ${notification.message}`,
    ),
  );
  const countdown = getMeetingPopupCountdown(meetingTime, nowMs);
  const fallbackTitle = getNotificationMeetingTitle(notification);
  const meetingName = meeting?.title || fallbackTitle || "Weekly Review & Team Status Meeting";
  const location =
    meeting?.location || parseNotificationLocation(notification?.message) || "Office Meeting Room";

  useEffect(() => {
    if (!notification || blocked) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [blocked, notification]);

  return (
    <Dialog open={Boolean(notification) && !blocked} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-[28px] border-0 bg-transparent p-0 shadow-[0_30px_100px_rgba(0,0,0,.55)] duration-300 data-[state=open]:slide-in-from-bottom-4 sm:max-w-2xl">
        {notification && (
          <div className="relative rounded-[28px] bg-gradient-to-br from-[#ff3b7f] via-[#7b61ff] to-[#4f9cff] p-[1px] shadow-[0_0_42px_rgba(123,97,255,.34)]">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#ff3b7f]/30 via-[#7b61ff]/25 to-[#4f9cff]/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[27px] border border-border bg-card p-5 text-foreground backdrop-blur-2xl sm:p-7">
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#4f9cff]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-[#ff3b7f]/15 blur-3xl" />

              <DialogHeader className="relative items-center text-center">
                <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                  <span className="h-2 w-2 rounded-full bg-[#4f9cff] shadow-[0_0_14px_rgba(79,156,255,.95)]" />
                  {isRescheduled ? "Meeting Rescheduled" : "Upcoming Meeting"}
                </div>

                <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#ff3b7f] via-[#7b61ff] to-[#4f9cff] shadow-[0_0_46px_rgba(123,97,255,.48)] sm:h-28 sm:w-28">
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#7b61ff]/20" />
                  <div className="relative flex h-[82%] w-[82%] items-center justify-center rounded-full border border-border bg-card backdrop-blur-md">
                    <CalendarClock
                      className="h-11 w-11 animate-pulse text-foreground sm:h-12 sm:w-12"
                      strokeWidth={1.7}
                    />
                  </div>
                </div>

                <DialogTitle className="max-w-xl text-2xl font-black leading-tight text-foreground sm:text-4xl">
                  {isRescheduled ? "Your meeting schedule changed" : "You have an upcoming meeting"}
                </DialogTitle>
                <DialogDescription className="mt-3 max-w-xl text-base font-semibold leading-7 text-muted-foreground sm:text-lg">
                  {meetingName}
                </DialogDescription>
              </DialogHeader>

              <div className="relative mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] sm:grid-cols-2 sm:p-5">
                <MeetingPopupDetail
                  icon={Calendar}
                  label="Date"
                  value={`${format(meetingTime, "EEEE")}, ${formatNepaliDate(meetingTime, "DD MMMM YYYY")} BS`}
                />
                <MeetingPopupDetail
                  icon={Clock}
                  label="Time"
                  value={format(meetingTime, "h:mm a")}
                />
                <MeetingPopupDetail icon={MapPin} label="Location" value={location} />
                <MeetingPopupDetail icon={Users} label="Attendees" value="All Team Members" />
              </div>

              <div className="relative mt-4 rounded-2xl border border-[#7b61ff]/30 bg-card p-4 text-center shadow-[0_0_28px_rgba(123,97,255,.16),inset_0_1px_0_rgba(255,255,255,.08)]">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Starts In
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <CountdownUnit value={countdown.days} label="Days" />
                  <CountdownUnit value={countdown.hours} label="Hours" />
                  <CountdownUnit value={countdown.minutes} label="Minutes" />
                </div>
              </div>

              <div className="relative mt-5 rounded-2xl border border-border bg-card p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Agenda
                </div>
                <p className="mt-2 max-h-[28dvh] overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm leading-6 text-muted-foreground [scrollbar-color:rgba(143,186,255,0.35)_transparent] [scrollbar-width:thin]">
                  {meeting?.agenda?.trim() ||
                    (isRescheduled
                      ? "The meeting schedule has been updated. Please review the meeting details and come prepared."
                      : "No agenda has been added for this meeting yet.")}
                </p>
              </div>

              <DialogFooter className="relative mt-5 flex-col gap-3 sm:flex-row sm:space-x-0">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-border bg-card text-foreground hover:border-border hover:bg-card focus-visible:ring-[#7b61ff]"
                  onClick={onClose}
                >
                  Remind Me Later
                </Button>
                <Button
                  asChild
                  className="h-12 rounded-xl border-0 bg-[linear-gradient(135deg,#ff3b7f,#7b61ff,#4f9cff)] px-6 font-bold text-foreground shadow-[0_0_24px_rgba(123,97,255,.36)] transition-shadow hover:shadow-[0_0_34px_rgba(79,156,255,.55)] focus-visible:ring-[#4f9cff]"
                >
                  <Link to="/meetings" onClick={onClose}>
                    <CheckCheck size={16} className="mr-2" />
                    View Meeting
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MeetingPopupDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-[#8fbaff]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 truncate text-sm font-semibold text-foreground sm:text-base">
          {value}
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-2 py-3">
      <div className="font-mono text-2xl font-black leading-none text-foreground sm:text-3xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function DashboardKpi({
  label,
  value,
  trend,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  trend: string;
  icon: typeof Clock;
  tone: "green" | "blue" | "amber" | "red" | "pink";
}) {
  return (
    <article className={`employee-kpi-card ${tone}`}>
      <div className="employee-kpi-icon">
        <Icon size={20} />
      </div>
      <div className="employee-kpi-copy">
        <span>{label}</span>
        <div className="employee-kpi-value">
          <strong>{value}</strong>
          <small>{trend}</small>
        </div>
      </div>
    </article>
  );
}

function StatusDot({ status }: { status: string }) {
  const active = status === "Working";
  return (
    <div className="employee-status-dot">
      <span className={active ? "active" : ""} />
    </div>
  );
}

function WorkHoursRing({ progress, hours }: { progress: number; hours: number }) {
  return (
    <div
      className="employee-work-ring"
      style={{ ["--work-progress" as string]: `${progress * 3.6}deg` }}
    >
      <div>
        <strong>{hours ? formatWorkHours(hours) : "0h"}</strong>
        <span>{progress}% of 8h</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="employee-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuickActionLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/tasks" | "/standup" | "/my-leaves" | "/my-attendance" | "/meetings" | "/profile";
  icon: typeof Target;
  label: string;
}) {
  return (
    <Link to={to} className="employee-quick-action">
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}

function TaskFocusCard({ task, nowTick }: { task: any; nowTick: number }) {
  const countdown = getTaskCountdown(task.deadline, nowTick);
  const priority =
    countdown.state === "overdue" ? "High" : countdown.state === "soon" ? "Medium" : "Normal";

  return (
    <article className="employee-task-card">
      <div className="employee-task-top">
        <div className="min-w-0">
          <h3>{task.title}</h3>
          <p>{task.project_name || task.project || "Aslenix Workstream"}</p>
        </div>
        <span className={`employee-priority ${priority.toLowerCase()}`}>{priority}</span>
      </div>
      <div className="employee-task-meta">
        <span>
          {task.deadline
            ? `${formatNepaliDate(task.deadline, "DD MMM")} BS, ${format(new Date(task.deadline), "h:mm a")}`
            : "No due date"}
        </span>
        <span>{countdown.label}</span>
      </div>
      <div className="employee-progress-track">
        <div style={{ width: `${task.progress || 0}%` }} />
      </div>
      <Link to="/tasks" className="employee-secondary-button">
        Continue Working
        <ArrowUpRight size={14} />
      </Link>
    </article>
  );
}

function MeetingCard({ meeting }: { meeting: any }) {
  const start = new Date(meeting.meeting_time);

  return (
    <article className="employee-meeting-card">
      <div>
        <h3>{meeting.title}</h3>
        <p>
          {format(start, "h:mm a")} · 30 min · {meeting.location || "Online"}
        </p>
      </div>
      {meeting.meeting_link ? (
        <a
          href={meeting.meeting_link}
          target="_blank"
          rel="noreferrer"
          className="employee-secondary-button"
        >
          Join Meeting
          <Video size={14} />
        </a>
      ) : (
        <span className="employee-muted-pill">No link</span>
      )}
    </article>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
}) {
  return (
    <div className="employee-empty-state">
      <Icon size={22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LegendDot({ tone, label }: { tone: HeatmapDay["status"]; label: string }) {
  return (
    <span>
      <i className={`heatmap-cell ${tone}`} />
      {label}
    </span>
  );
}

function HeatmapSummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: HeatmapDay["status"];
}) {
  return (
    <span className={`employee-heatmap-summary-pill ${tone}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function HeatmapStatPill({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function TimelineItem({ item }: { item: ActivityItem }) {
  return (
    <div className="employee-timeline-item">
      <span />
      <div>
        <strong>{item.text}</strong>
        <small>
          {item.kind} · {formatNepaliDate(item.when, "DD MMM")} BS,{" "}
          {format(new Date(item.when), "HH:mm")}
        </small>
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <div className="employee-insight-item">
      <Icon size={17} />
      <span>{text}</span>
    </div>
  );
}

function isBeforeOfficeEnd(now: Date, officeEndTime?: string | null) {
  const [hour, minute] = (officeEndTime || "18:00:00").split(":").map(Number);
  const boundary = new Date(now);
  boundary.setHours(hour || 18, minute || 0, 0, 0);
  return now < boundary;
}

function liveWorkedHours(today: any, nowMs: number) {
  if (!today?.check_in_time) return 0;
  if (today.work_hours) return Number(today.work_hours);
  const end = today.check_out_time ? new Date(today.check_out_time).getTime() : nowMs;
  return Math.max(
    0,
    Math.round(((end - new Date(today.check_in_time).getTime()) / 3600000) * 100) / 100,
  );
}

function calculateWeeklyWorkedHours(rows: any[], today: any, liveTodayHours: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + WEEKLY_WORKING_DAYS - 1);

  const todayDate = format(now, "yyyy-MM-dd");
  const total = rows.reduce((sum, row) => {
    const rowDate = new Date(`${row.date}T00:00:00`);
    if (rowDate < start || rowDate > end || row.date === todayDate) return sum;
    return sum + Number(row.work_hours || 0);
  }, 0);

  const todayHours = today?.date === todayDate ? liveTodayHours : 0;
  return Math.round((total + todayHours) * 10) / 10;
}

function calculateAttendanceStreak(rows: any[], today: any) {
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const rowByDate = new Map(rows.map((row) => [row.date, row]));
  if (today?.date) rowByDate.set(today.date, today);

  const latestDate = Array.from(rowByDate.keys())
    .filter((date) => date <= todayDate)
    .sort()
    .at(-1);
  if (!latestDate) return 0;

  const latestRow = rowByDate.get(latestDate);
  if (!["present", "late", "wfh"].includes(latestRow?.status)) return 0;

  let streak = 0;
  const start = new Date(`${latestDate}T00:00:00`);
  for (let offset = 0; offset < 90; offset += 1) {
    const date = format(subDays(start, offset), "yyyy-MM-dd");
    if (isWeeklyOffDate(date)) continue;
    const row = rowByDate.get(date);
    if (row && ["present", "late", "wfh"].includes(row.status)) streak += 1;
    else break;
  }
  return streak;
}

function calculateWeeklyProgress(rows: any[], today: any) {
  const now = new Date();
  const start = subDays(now, now.getDay());
  const dates = new Set(
    rows.filter((row) => ["present", "late", "wfh"].includes(row.status)).map((row) => row.date),
  );
  if (today && ["present", "late", "wfh"].includes(today.status)) dates.add(today.date);
  let count = 0;
  for (let index = 0; index < WEEKLY_WORKING_DAYS; index += 1) {
    if (
      dates.has(
        format(
          new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
          "yyyy-MM-dd",
        ),
      )
    ) {
      count += 1;
    }
  }
  return count;
}

function makeHeatmapDays(rows: any[]): HeatmapDay[] {
  const rowByDate = new Map(rows.map((row) => [row.date, row]));
  return Array.from({ length: 15 }, (_, index) => {
    const date = format(subDays(new Date(), 14 - index), "yyyy-MM-dd");
    const row = rowByDate.get(date);
    if (isWeeklyOffDate(date)) {
      return {
        date,
        status: "holiday",
        checkIn: row?.check_in_time,
        checkOut: row?.check_out_time,
      };
    }
    if (!row) return { date, status: "none" };
    if (row.status === "absent")
      return { date, status: "absent", checkIn: row.check_in_time, checkOut: row.check_out_time };
    if (row.is_late || row.status === "late")
      return { date, status: "late", checkIn: row.check_in_time, checkOut: row.check_out_time };
    if (["present", "wfh"].includes(row.status))
      return { date, status: "present", checkIn: row.check_in_time, checkOut: row.check_out_time };
    return { date, status: "none", checkIn: row.check_in_time, checkOut: row.check_out_time };
  });
}

function summarizeHeatmap(days: HeatmapDay[], currentStreak: number, rows: any[], today: any) {
  const present = days.filter((day) => day.status === "present").length;
  const late = days.filter((day) => day.status === "late").length;
  const absent = days.filter((day) => day.status === "absent").length;
  const holiday = days.filter((day) => day.status === "holiday").length;
  const tracked = present + late + absent;
  const rate = tracked ? Math.round(((present + late) / tracked) * 100) : 0;
  return {
    present,
    late,
    absent,
    holiday,
    rate,
    bestStreak: Math.max(currentStreak, calculateBestAttendanceStreak(rows, today)),
  };
}

function calculateBestAttendanceStreak(rows: any[], today: any) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  if (today?.date) byDate.set(today.date, today);
  let best = 0;
  let current = 0;
  const dates = Array.from(byDate.keys()).sort();
  for (const date of dates) {
    const row = byDate.get(date);
    if (row && ["present", "late", "wfh"].includes(row.status)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function formatHeatmapTime(value?: string | null) {
  if (!value) return "--";
  return format(new Date(value), "HH:mm");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function isDashboardTaskComplete(task: { status?: string | null; progress?: number | null }) {
  return task.status === "completed" || Number(task.progress || 0) >= 100;
}

function getMoodMeta(value: string) {
  return MOODS.find((item) => item.value === value) || MOODS[1];
}

function getMoodScore(value: string) {
  return (
    {
      excellent: 100,
      good: 82,
      neutral: 64,
      tired: 46,
      stressed: 28,
    }[value] || 64
  );
}

function getActivityMeta(item: ActivityItem) {
  if (item.kind === "Attendance" && /checked out/i.test(item.text)) {
    return {
      icon: LogOut,
      badgeClass: "border-pink-300/20 bg-pink-300/10 text-foreground",
      pillClass: "border-pink-300/20 bg-pink-300/10 text-foreground",
    };
  }
  if (item.kind === "Attendance") {
    return {
      icon: LogIn,
      badgeClass: "border-emerald-300/20 bg-emerald-300/10 text-foreground",
      pillClass: "border-emerald-300/20 bg-emerald-300/10 text-foreground",
    };
  }
  if (item.kind === "Task") {
    return {
      icon: CheckCircle2,
      badgeClass: "border-cyan-300/20 bg-cyan-300/10 text-foreground",
      pillClass: "border-cyan-300/20 bg-cyan-300/10 text-foreground",
    };
  }
  if (item.kind === "Standup") {
    return {
      icon: MessageSquare,
      badgeClass: "border-violet-300/20 bg-violet-300/10 text-foreground",
      pillClass: "border-violet-300/20 bg-violet-300/10 text-foreground",
    };
  }
  return {
    icon: Activity,
    badgeClass: "border-border bg-card text-muted-foreground",
    pillClass: "border-border bg-card text-muted-foreground",
  };
}

function formatDistanceLabel(value: string) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function improvementDismissalKey(userId: string, reviewId: string) {
  return `weekly-improvement-dismissed:${userId}:${reviewId}`;
}

function isImprovementDismissed(userId: string, reviewId: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(improvementDismissalKey(userId, reviewId)) === "1";
}

function markImprovementDismissed(userId: string, reviewId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(improvementDismissalKey(userId, reviewId), "1");
}

function notificationSeenKey(id: string) {
  return `notification-popup-seen:${id}`;
}

function hasSeenNotification(id: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(notificationSeenKey(id)) === "1";
}

function markNotificationSeen(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(notificationSeenKey(id), "1");
}

function getNotificationMeeting(notification: NotificationRow | null, meetings: any[]) {
  if (!notification) return null;
  const haystack = `${notification.title} ${notification.message}`.toLowerCase();
  return (
    meetings.find((meeting) => {
      const title = String(meeting.title || "").toLowerCase();
      return title.length > 2 && haystack.includes(title);
    }) ??
    meetings
      .filter((meeting) => new Date(meeting.meeting_time).getTime() >= Date.now() - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.meeting_time).getTime() - new Date(b.meeting_time).getTime())[0] ??
    null
  );
}

function isMeetingNotification(notification: NotificationRow) {
  const text = `${(notification as any).type || ""} ${notification.title || ""} ${notification.message || ""}`;
  return /meeting/i.test(text);
}

function getNotificationMeetingTitle(notification: NotificationRow | null) {
  if (!notification) return "";
  const title = String(notification.title || "").trim();
  const message = String(notification.message || "").trim();
  const genericTitle =
    /^(task updated|new task assigned|task moved|task marked|meeting scheduled|new meeting scheduled|meeting postponed|meeting updated|meeting rescheduled)$/i.test(
      title,
    );

  if (
    title &&
    !genericTitle &&
    !/^meeting\s+(scheduled|postponed|updated|rescheduled):?\s*/i.test(title)
  ) {
    return title;
  }

  const messageTitle = message.match(/^(.+?)\s+(?:is now on|on)\s+/i)?.[1]?.trim();
  if (messageTitle) return messageTitle;

  return title
    .replace(/^(new\s+)?meeting\s+(scheduled|postponed|updated|rescheduled):?\s*/i, "")
    .trim();
}

function parseNotificationLocation(message?: string) {
  if (!message) return null;
  const match = message.match(/\s+at\s+(.+?)(?:\.|$)/i);
  return match?.[1]?.trim() || null;
}

function getMeetingPopupCountdown(time: Date, nowMs: number) {
  const diffMs = Math.max(0, time.getTime() - nowMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  return {
    days: Math.floor(diffMs / dayMs),
    hours: Math.floor((diffMs % dayMs) / hourMs),
    minutes: Math.floor((diffMs % hourMs) / minuteMs),
  };
}

function getTaskCountdown(deadline: string | null, nowMs: number) {
  if (!deadline) return { label: "No deadline", state: "none" as const };

  const dueMs = new Date(deadline).getTime();
  const diffMs = dueMs - nowMs;
  const absMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  const formatParts = (ms: number) => {
    const days = Math.floor(ms / dayMs);
    const hours = Math.floor((ms % dayMs) / hourMs);
    const minutes = Math.max(1, Math.ceil((ms % hourMs) / minuteMs));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (diffMs < 0) {
    return { label: `${formatParts(absMs)} overdue`, state: "overdue" as const };
  }

  if (diffMs <= 24 * hourMs) {
    return { label: `${formatParts(diffMs)} left`, state: "soon" as const };
  }

  return { label: `${formatParts(diffMs)} left`, state: "ok" as const };
}
