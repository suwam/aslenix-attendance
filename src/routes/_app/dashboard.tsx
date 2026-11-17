import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAppResume } from "@/lib/use-app-resume";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { getVerifiedAttendanceLocation } from "@/lib/attendance-location";
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCheck,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Clock,
  Coffee,
  ExternalLink,
  FileEdit,
  FileText,
  FolderKanban,
  HeartPulse,
  LogIn,
  LogOut,
  Palmtree,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { formatWorkHours } from "@/lib/work-hours";
import { formatNepaliDate, getCurrentNepaliMonthRange } from "@/lib/nepali-calendar";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import {
  Shift,
  DEFAULT_MORNING_SHIFT,
  fetchEmployeeAssignedShift,
  evaluateCheckIn,
  evaluateCheckOut,
  formatTime12Hour,
  getShiftExpectedHours,
  isAttendanceCutoffPassed,
} from "@/lib/attendance-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({ component: EmployeeDashboard });

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  type?: string;
};

type CalendarHoliday = {
  id: string;
  title: string;
  bsDate: string;
  adDate?: string;
};

type LeaveRequestItem = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  work_hours: number | null;
  status: string;
  is_late: boolean;
  is_early_checkout: boolean;
};

const DEFAULT_HOLIDAYS: CalendarHoliday[] = [
  { id: "event-bakra-eid-2083", bsDate: "2083-02-14", title: "Bakra Eid / Eid al-Adha" },
  { id: "event-republic-day-2083", bsDate: "2083-02-15", title: "Ganatantra Diwas" },
  { id: "event-no-tobacco-2083", bsDate: "2083-02-17", title: "World No Tobacco Day" },
  { id: "event-children-2083", bsDate: "2083-02-19", title: "International Children's Day" },
  { id: "event-victims-2083", bsDate: "2083-02-21", title: "Children Victims of Aggression Day" },
  { id: "event-environment-2083", bsDate: "2083-02-22", title: "World Environment Day" },
];

function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function isDashboardTaskComplete(task: { status?: string | null; progress?: number | null }) {
  return task.status === "completed" || Number(task.progress || 0) >= 100;
}

function liveWorkedHours(today: any, nowMs: number) {
  if (!today?.check_in_time) return 0;
  if (today.check_out_time) return Number(today.work_hours || 0);
  const start = new Date(today.check_in_time).getTime();
  const diffMs = Math.max(0, nowMs - start);
  return Math.round((diffMs / 3600000) * 10) / 10;
}

function LiveTimeCount() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-initial inline-flex items-center gap-2 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs">
      <Clock size={13} className="text-primary animate-pulse" />
      <span className="font-mono text-xs sm:text-[13px] font-bold tabular-nums text-foreground tracking-tight">
        {time}
      </span>
    </div>
  );
}

function getLeaveDurationDays(start: string, end: string): number {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, isNaN(diff) ? 1 : diff);
  } catch {
    return 1;
  }
}

function getLeaveIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("vacation") || t.includes("annual")) {
    return <Palmtree size={15} className="text-amber-500" />;
  }
  if (t.includes("sick") || t.includes("medical")) {
    return <HeartPulse size={15} className="text-rose-500" />;
  }
  if (t.includes("casual")) {
    return <Coffee size={15} className="text-blue-500" />;
  }
  return <Calendar size={15} className="text-purple-500" />;
}

function EmployeeDashboard() {
  const { user, profile, isAdmin } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [assignedShift, setAssignedShift] = useState<Shift>(DEFAULT_MORNING_SHIFT);
  const [monthStats, setMonthStats] = useState({ present: 0, late: 0, leave: 0, hours: 0 });
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
  });
  const [focusTasks, setFocusTasks] = useState<any[]>([]);
  const [availableLeaveDays, setAvailableLeaveDays] = useState<number>(24);
  const [leaveQuotaSummary, setLeaveQuotaSummary] = useState({ total: 24, used: 0, available: 24 });
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequestItem[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "meetings" | "holidays">("all");
  const [taskScheduleTab, setTaskScheduleTab] = useState<"tasks" | "schedule">("tasks");
  const [leavesNoticesTab, setLeavesNoticesTab] = useState<"leaves" | "notices">("leaves");
  const [attendanceViewMode, setAttendanceViewMode] = useState<"visual" | "table">("visual");
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const attendanceSummary = useMemo(() => {
    if (!recentAttendance || recentAttendance.length === 0) {
      return { avgHours: "9h 14m", onTimeRate: "100%" };
    }
    const withHours = recentAttendance.filter((r) => r.work_hours && Number(r.work_hours) > 0);
    const totalH = withHours.reduce((sum, r) => sum + Number(r.work_hours || 0), 0);
    const avg = withHours.length > 0 ? totalH / withHours.length : 9;
    const onTimeCount = recentAttendance.filter((r) => !r.is_late && r.status === "present").length;
    const rate = Math.round((onTimeCount / recentAttendance.length) * 100);
    return {
      avgHours: formatWorkHours(avg),
      onTimeRate: `${rate}%`,
    };
  }, [recentAttendance]);

  const uniqueNotifications = useMemo(() => {
    const seen = new Set<string>();
    const list: NotificationItem[] = [];
    for (const n of notifications) {
      const key = `${n.title}:${n.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(n);
      }
    }
    return list.slice(0, 4);
  }, [notifications]);

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);
  const isCutoffPassed = isAttendanceCutoffPassed(new Date(nowTick));
  const firstName = profile?.full_name?.split(" ")[0] || "Team Member";
  const nepaliMonth = getCurrentNepaliMonthRange();
  const nepaliToday = formatNepaliDate(new Date(), "MMMM DD, YYYY");
  const greeting = getGreeting(new Date(nowTick));

  const load = async () => {
    if (!user) return;

    const monthStart = nepaliMonth.startAd;
    const monthEnd = nepaliMonth.endAd;

    // Load attendance, shifts, leave balances, leave requests, history, meetings, holidays, notifications, and tasks in parallel
    const [
      { data: todayAttendance },
      { data: monthAttendanceRows },
      { data: historyAttendanceRows },
      userShift,
      { data: leaveBalances },
      { data: leaveRequestRows },
      { data: meetingRows },
      { data: holidayRows },
      { data: notificationRows },
      directTaskResult,
      assigneeResult,
      teamLeadResult,
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
        .order("date", { ascending: false })
        .limit(7),
      fetchEmployeeAssignedShift(user.id, todayDate),
      supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("meetings")
        .select("*")
        .gte("meeting_time", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
        .order("meeting_time", { ascending: true })
        .limit(6),
      supabase
        .from("calendar_events")
        .select("id, title, bs_date, ad_date")
        .eq("is_active", true)
        .order("bs_date", { ascending: true })
        .limit(6),
      supabase
        .from("notifications")
        .select("id, title, message, created_at, is_read, type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("tasks").select("*").eq("assigned_to", user.id),
      supabase.from("task_assignees").select("task_id").eq("user_id", user.id),
      supabase.from("task_team_leads").select("task_id").eq("user_id", user.id),
    ]);

    // Set today attendance and shift
    setToday(todayAttendance);
    setAssignedShift(userShift.shift);
    setRecentAttendance((historyAttendanceRows as AttendanceRecord[]) || []);

    // Compute month attendance statistics
    const monthRows = monthAttendanceRows || [];
    const hours =
      Math.round(monthRows.reduce((sum, row) => sum + Number(row.work_hours || 0), 0) * 10) / 10;
    setMonthStats({
      present: monthRows.filter((row) => ["present", "late", "wfh"].includes(row.status)).length,
      late: monthRows.filter((row) => row.is_late).length,
      leave: monthRows.filter((row) => row.status === "leave").length,
      hours,
    });

    // Compute leave quota: 2 days per month = 24 days per year
    const ANNUAL_LEAVE_QUOTA = 24;
    const currentYear = new Date().getFullYear();
    const approvedThisYear = (leaveRequestRows || []).filter(
      (r: any) => r.status === "approved" && new Date(r.start_date).getFullYear() === currentYear,
    );
    const usedDays = approvedThisYear.reduce((sum: number, r: any) => {
      const s = new Date(r.start_date);
      const e = new Date(r.end_date);
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return sum + (r.is_half_day ? 0.5 : Math.max(1, isNaN(diff) ? 1 : diff));
    }, 0);
    const availableDays = Math.max(0, ANNUAL_LEAVE_QUOTA - usedDays);
    setAvailableLeaveDays(availableDays);
    setLeaveQuotaSummary({
      total: ANNUAL_LEAVE_QUOTA,
      used: usedDays,
      available: availableDays,
    });

    // Set leave requests
    setRecentLeaves((leaveRequestRows as LeaveRequestItem[]) || []);

    // Set upcoming meetings
    setMeetings(meetingRows || []);

    // Set holidays (with fallback)
    if (holidayRows && holidayRows.length > 0) {
      setHolidays(
        holidayRows.map((h) => ({
          id: h.id,
          title: h.title,
          bsDate: h.bs_date,
          adDate: h.ad_date,
        })),
      );
    } else {
      setHolidays(DEFAULT_HOLIDAYS);
    }

    // Set notifications
    setNotifications((notificationRows as NotificationItem[]) || []);

    // Process tasks
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
    const pending = taskRows.filter((task) => !isDashboardTaskComplete(task)).length;
    const overdue = taskRows.filter(
      (task) =>
        task.deadline &&
        new Date(task.deadline).getTime() < Date.now() &&
        !isDashboardTaskComplete(task),
    ).length;

    setTaskStats({ total, completed, pending, overdue });

    // Latest 3 pending tasks for the employee
    const latestPending = taskRows
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
      .slice(0, 3);

    setFocusTasks(latestPending);
  };

  useEffect(() => {
    load();
  }, [user]);

  // Keep dashboard fresh when tab/app is resumed
  useAppResume(load, { pollIntervalMs: 30000 });

  // Update live clock every minute
  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  // Functional Check-in
  const checkIn = async () => {
    if (!user) return;
    if (isWeeklyOff) return toast.info("Saturday is a weekly off. Attendance is not required.");
    if (isAttendanceCutoffPassed()) {
      return;
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
    const evalResult = evaluateCheckIn(now, todayDate, assignedShift);

    const { data: insertedToday, error } = await supabase
      .from("attendance")
      .insert({
        user_id: user.id,
        date: todayDate,
        check_in_time: now.toISOString(),
        check_in_latitude: location.latitude,
        check_in_longitude: location.longitude,
        check_in_accuracy_meters: location.accuracy,
        status: evalResult.status,
        is_late: evalResult.is_late,
        shift_id: assignedShift.id,
        shift_name_snapshot: assignedShift.name,
        scheduled_check_in: assignedShift.start_time,
        scheduled_check_out: assignedShift.end_time,
        late_minutes: evalResult.late_minutes,
      })
      .select()
      .maybeSingle();

    setBusy(false);
    if (error || !insertedToday) return toast.error(error?.message ?? "Unable to check in");
    setToday(insertedToday);
    load();
    toast.success(
      evalResult.is_late
        ? `Checked in (${evalResult.late_minutes}m late for ${assignedShift.name})`
        : `Checked in on time for ${assignedShift.name}`,
    );
  };

  // Functional Check-out
  const checkOut = async () => {
    if (!user || !today) return;
    setBusy(true);
    let location: Awaited<ReturnType<typeof getVerifiedAttendanceLocation>>;
    try {
      location = await getVerifiedAttendanceLocation();
    } catch (error) {
      setBusy(false);
      return toast.error(error instanceof Error ? error.message : "Unable to verify location");
    }

    const now = new Date();
    const evalResult = evaluateCheckOut(today.check_in_time, now, todayDate, assignedShift);

    const { data: updatedToday, error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_accuracy_meters: location.accuracy,
        is_early_checkout: evalResult.is_early_checkout,
        early_checkout_minutes: evalResult.early_checkout_minutes,
        work_hours: evalResult.work_hours,
        total_working_minutes: evalResult.total_working_minutes,
        overtime_minutes: evalResult.overtime_minutes,
      })
      .eq("id", today.id)
      .select()
      .maybeSingle();

    setBusy(false);
    if (error || !updatedToday) return toast.error(error?.message ?? "Unable to check out");
    setToday(updatedToday);
    load();
    toast.success(
      evalResult.is_early_checkout
        ? `Checked out early (${evalResult.early_checkout_minutes}m before scheduled closing)`
        : `Checked out (${formatWorkHours(evalResult.work_hours)} worked)`,
    );
  };

  const workedHours = liveWorkedHours(today, nowTick);
  const expectedDailyHours = getShiftExpectedHours(assignedShift);

  const statusConfig = useMemo(() => {
    if (isWeeklyOff) {
      return {
        label: WEEKLY_OFF_LABEL,
        dotClass: "bg-purple-500",
        badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      };
    }
    if (!today) {
      if (isCutoffPassed) {
        return {
          label: "Closed (Past 2:00 PM)",
          dotClass: "bg-destructive",
          badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
        };
      }
      return {
        label: "Not Checked In",
        dotClass: "bg-muted-foreground",
        badgeClass: "bg-muted text-muted-foreground border-border",
      };
    }
    if (today.check_out_time) {
      return {
        label: today.is_early_checkout ? "Completed · Early Left" : "Day Completed",
        dotClass: "bg-primary",
        badgeClass: "bg-primary/10 text-primary border-primary/20",
      };
    }
    if (today.is_late) {
      return {
        label: "Working · Late Arrival",
        dotClass: "bg-amber-500 animate-pulse",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      };
    }
    return {
      label: "Working · On Time",
      dotClass: "bg-emerald-500 animate-pulse",
      badgeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };
  }, [isWeeklyOff, today, isCutoffPassed]);

  // Combined upcoming activities prioritized by today and urgency
  const upcomingActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: "meeting" | "holiday" | "announcement";
      title: string;
      timeLabel: string;
      subLabel?: string;
      actionUrl?: string;
      isToday?: boolean;
    }> = [];

    // Meetings
    if (activityFilter === "all" || activityFilter === "meetings") {
      meetings.slice(0, 3).forEach((m) => {
        const meetingDate = new Date(m.meeting_time);
        const isMeetingToday = format(meetingDate, "yyyy-MM-dd") === todayDate;
        list.push({
          id: `meeting-${m.id}`,
          type: "meeting",
          title: m.title,
          timeLabel: isMeetingToday
            ? `Today at ${format(meetingDate, "h:mm a")}`
            : format(meetingDate, "EEE, MMM d · h:mm a"),
          subLabel: m.location || undefined,
          actionUrl: m.meeting_link || undefined,
          isToday: isMeetingToday,
        });
      });
    }

    // Holidays
    if (activityFilter === "all" || activityFilter === "holidays") {
      holidays.slice(0, 2).forEach((h) => {
        list.push({
          id: `holiday-${h.id}`,
          type: "holiday",
          title: h.title,
          timeLabel: `${h.bsDate} BS`,
        });
      });
    }

    // Notifications fallback in All
    if (activityFilter === "all" && list.length < 3) {
      notifications.slice(0, 3 - list.length).forEach((n) => {
        list.push({
          id: `notif-${n.id}`,
          type: "announcement",
          title: n.title,
          timeLabel: format(new Date(n.created_at), "MMM d, yyyy"),
          subLabel: n.message,
        });
      });
    }

    return list;
  }, [meetings, holidays, notifications, activityFilter, todayDate]);

  return (
    <div className="aslenix-dashboard space-y-4 max-w-[1440px] mx-auto text-foreground pb-12 sm:pb-6">
      {/* ========================================================================= */}
      {/* ROW 1: Welcome Header with Integrated Compact Employee Profile Summary   */}
      {/* ========================================================================= */}
      <header className="glass glass-strong aslenix-dashboard-card card-tone-blue rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            {/* Employee Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || "Employee"}
                className="h-12 w-12 rounded-full object-cover border border-border shrink-0 shadow-xs"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold text-sm text-[#0F172A] border border-border/80 shadow-xs"
                style={{ background: "var(--gradient-brand)" }}
              >
                {profile?.full_name
                  ? profile.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                  : "AS"}
              </div>
            )}

            {/* Profile Information & Greetings */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                  {greeting}, {profile?.full_name || firstName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {profile?.approval_status === "approved" ? "Active Staff" : "Staff"}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {profile?.position || "Team Member"}
                </span>
                <span>·</span>
                <span>{profile?.department || "ASLENIX"}</span>
                {profile?.employee_code && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[11px] bg-muted/80 px-1.5 py-0.5 rounded text-foreground font-medium border border-border/60">
                      ID: {profile.employee_code}
                    </span>
                  </>
                )}
                {profile?.joining_date && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline text-muted-foreground">
                      Joined {format(new Date(profile.joining_date), "MMM yyyy")}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1 text-[11px] text-muted-foreground/80">
                {format(new Date(), "EEEE, MMMM d, yyyy")} · {nepaliToday} BS
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center shrink-0 w-full sm:w-auto">
            {/* Live Time Count: Placed to the left side of the profile */}
            <LiveTimeCount />

            <Link
              to="/profile"
              className="flex-1 sm:flex-initial inline-flex justify-center items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 hover:bg-white px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-all"
            >
              <User size={13} className="text-primary" />
              <span>My Profile</span>
            </Link>
            <Link
              to="/my-attendance"
              className="flex-1 sm:flex-initial inline-flex justify-center items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 hover:bg-white px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-all"
            >
              <Clock size={13} className="text-primary" />
              <span>Attendance History</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ROW 2: Full-width Today's Attendance Panel                                */}
      {/* ========================================================================= */}
      <section className="glass aslenix-dashboard-card card-tone-mint rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Status & Shift Information */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-[270px]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border", statusConfig.badgeClass)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)} />
                  {statusConfig.label}
                </span>
                {today?.late_minutes > 0 && today?.is_late && (
                  <span className="text-[11px] font-semibold text-amber-600">
                    +{today.late_minutes}m
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                <strong className="text-foreground font-semibold">{assignedShift.name}</strong> ·{" "}
                {formatTime12Hour(assignedShift.start_time)} – {formatTime12Hour(assignedShift.end_time)} (Grace: {assignedShift.grace_period_mins}m)
              </div>
            </div>
          </div>

          {/* Attendance Times & Hours */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 border-y xl:border-y-0 xl:border-x border-border/70 py-3 xl:py-0 xl:px-6">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Check In</div>
              <div className="mt-0.5 text-sm sm:text-base font-bold text-foreground tabular-nums">
                {today?.check_in_time ? formatTime12Hour(today.check_in_time) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                Sched: {formatTime12Hour(assignedShift.start_time)}
              </div>
            </div>

            <div className="border-x xl:border-x-0 border-border/70 px-3 xl:px-0">
              <div className="text-[11px] font-medium text-muted-foreground">Check Out</div>
              <div className="mt-0.5 text-sm sm:text-base font-bold text-foreground tabular-nums">
                {today?.check_out_time ? formatTime12Hour(today.check_out_time) : today ? (
                  <span className="text-primary font-semibold">Working</span>
                ) : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                Sched: {formatTime12Hour(assignedShift.end_time)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Working Hours</div>
              <div className="mt-0.5 text-sm sm:text-base font-bold text-foreground tabular-nums">
                {workedHours ? formatWorkHours(workedHours) : "0h 0m"}
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                {expectedDailyHours}h expected
              </div>
            </div>
          </div>

          {/* Visual Shift Progress Bar */}
          <div className="hidden lg:flex flex-col justify-center min-w-[180px] max-w-[240px] flex-1 px-4 border-l border-border/70">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
              <span>Shift Progress</span>
              <span className="text-foreground font-bold tabular-nums">
                {workedHours ? Math.min(100, Math.round((workedHours / expectedDailyHours) * 100)) : 0}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((workedHours || 0) / (expectedDailyHours || 9)) * 100))}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 tabular-nums truncate">
              {workedHours ? formatWorkHours(workedHours) : "0h 0m"} of {expectedDailyHours}h target
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 w-full xl:w-auto">
            {isAdmin && (
              <span className="hidden 2xl:inline text-xs font-medium text-muted-foreground italic mr-1">
                Admin mode
              </span>
            )}
            <Button
              onClick={checkIn}
              disabled={busy || isWeeklyOff || Boolean(today) || isCutoffPassed}
              className="neon-button flex-1 xl:flex-initial h-9 sm:h-10 rounded-xl px-5 font-bold text-xs sm:text-sm shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <LogIn size={15} className="mr-1.5" /> Check In
            </Button>
            <Button
              onClick={checkOut}
              disabled={busy || !today || Boolean(today?.check_out_time)}
              variant="outline"
              className="flex-1 xl:flex-initial h-9 sm:h-10 rounded-xl border-border/80 bg-white/80 hover:bg-white text-foreground font-semibold px-4 text-xs sm:text-sm shadow-xs transition-colors"
            >
              <LogOut size={15} className="mr-1.5" /> Check Out
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 3: Key Metrics (Present Days, Pending Tasks, Completed, Available Leave) */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Present Days */}
        <Link
          to="/my-attendance"
          className="glass metric-card-green rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-md group"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                Present Days
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums mt-1">
                {monthStats.present} <span className="text-xs font-normal text-muted-foreground">days</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-xs text-emerald-600 transition-transform group-hover:scale-105">
              <CalendarCheck size={20} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-2">
            {nepaliMonth.label} BS · {monthStats.late > 0 ? `${monthStats.late} late arrival${monthStats.late > 1 ? "s" : ""}` : "On-time record"}
          </p>
        </Link>

        {/* Pending Tasks */}
        <Link
          to="/tasks"
          className="glass metric-card-amber rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-md group"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                Pending Tasks
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums mt-1">
                {taskStats.pending} <span className="text-xs font-normal text-muted-foreground">tasks</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-xs text-amber-600 transition-transform group-hover:scale-105">
              <Clock size={20} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-2">
            {taskStats.overdue > 0 ? (
              <span className="text-destructive font-semibold">{taskStats.overdue} overdue</span>
            ) : (
              "All tasks on schedule"
            )}
          </p>
        </Link>

        {/* Completed Tasks */}
        <Link
          to="/tasks"
          className="glass metric-card-blue rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-md group"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                Completed Tasks
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums mt-1">
                {taskStats.completed} <span className="text-xs font-normal text-muted-foreground">/ {taskStats.total}</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-xs text-primary transition-transform group-hover:scale-105">
              <CheckCheck size={20} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-2">
            {taskStats.total ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% completion rate
          </p>
        </Link>

        {/* Available Leave Balance */}
        <Link
          to="/my-leaves"
          className="glass card-tone-lavender rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all hover:scale-[1.01] hover:shadow-md group"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
                Available Leave
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight tabular-nums mt-1">
                {availableLeaveDays} <span className="text-xs font-normal text-muted-foreground">days</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-xs text-purple-600 transition-transform group-hover:scale-105">
              <FileText size={20} />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2">
            <span className="text-muted-foreground">2 days/mo · 24 days/yr quota</span>
            <span className="font-semibold text-primary group-hover:underline">
              Apply →
            </span>
          </div>
        </Link>
      </section>

      {/* ========================================================================= */}
      {/* ROW 4: Attendance Tracker (Visual 5-day strip / Table toggle)             */}
      {/* ========================================================================= */}
      <section className="glass aslenix-dashboard-card card-tone-lavender rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs">
        <div>
          {/* Tracker Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-indigo-500/5 text-primary border border-primary/25 shadow-2xs">
                <Clock size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground tracking-tight">Attendance Tracker</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    5-Day Recent Strip
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Avg: <span className="font-bold text-foreground">{attendanceSummary.avgHours}</span> / day ·{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{attendanceSummary.onTimeRate}</span> on-time record
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Visual vs Table View Switcher */}
              <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/60 p-0.5 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode("visual")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    attendanceViewMode === "visual"
                      ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarDays size={12} />
                  <span>Visual Strip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceViewMode("table")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    attendanceViewMode === "table"
                      ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ClipboardList size={12} />
                  <span>Table</span>
                </button>
              </div>

              <Link
                to="/my-attendance"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-primary/5 transition-colors group"
              >
                <span>Full log</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* MODE 1: VISUAL 5-DAY ATTENDANCE STRIP */}
          {attendanceViewMode === "visual" ? (
            <div>
              {recentAttendance.length > 0 ? (
                <div className="flex lg:grid lg:grid-cols-5 gap-3 overflow-x-auto pb-2 lg:pb-0 scrollbar-none snap-x snap-mandatory">
                  {recentAttendance.slice(0, 5).map((row) => {
                    const isRowToday = row.date === todayDate;
                    const hours = row.work_hours
                      ? Number(row.work_hours)
                      : isRowToday && workedHours
                        ? workedHours
                        : 0;
                    const expectedHours = expectedDailyHours || 9;
                    const pct = Math.min(
                      100,
                      Math.round((hours / expectedHours) * 100),
                    );
                    const isLate = row.is_late || row.status === "late";
                    const dayShort = format(new Date(row.date), "EEE");
                    const dateFormatted = format(new Date(row.date), "MMM d");

                    if (isRowToday) {
                      return (
                        <div
                          key={row.id}
                          className="min-w-[210px] lg:min-w-0 flex-1 snap-start rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between p-3.5 sm:p-4 group shadow-sm border-indigo-400/60 dark:border-indigo-500/50 bg-gradient-to-b from-indigo-50/80 via-white to-purple-50/30 dark:from-indigo-950/30 dark:via-card dark:to-purple-950/20 ring-2 ring-indigo-500/15 hover:shadow-md"
                        >
                          {/* Card Top */}
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="rounded-md bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shadow-2xs">
                                  Today
                                </span>
                                <span className="text-xs sm:text-sm font-extrabold text-foreground">
                                  {dayShort}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {row.status === "present" && !isLate ? "Working" : isLate ? "Late" : "Active"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground font-medium">
                              {dateFormatted} · Active Shift
                            </div>
                          </div>

                          {/* Hours & Visual Progress */}
                          <div className="my-3">
                            <div className="flex items-baseline justify-between mb-1">
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg sm:text-xl font-black text-foreground tabular-nums tracking-tight">
                                  {hours ? formatWorkHours(hours) : "0h 0m"}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  / {expectedHours}h
                                </span>
                              </div>
                              <span className="text-[10px] font-extrabold text-primary tabular-nums">
                                {pct}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden shadow-inner p-0.5">
                              <div
                                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-[#818cf8] via-[#a78bfa] to-[#c084fc] shadow-xs"
                                style={{ width: `${Math.max(6, pct)}%` }}
                              />
                            </div>
                          </div>

                          {/* Card Bottom / Punch Time */}
                          <div className="pt-2.5 border-t border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <LogIn size={12} className="text-emerald-500 shrink-0 stroke-[2.5]" />
                              <span className="text-[10px] font-medium">In:</span>
                              <strong className="text-foreground font-mono font-bold text-[11px]">
                                {row.check_in_time ? formatTime12Hour(row.check_in_time) : "—"}
                              </strong>
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                              Live
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={row.id}
                        className="min-w-[190px] lg:min-w-0 flex-1 snap-start rounded-2xl border border-border/80 bg-white/80 dark:bg-card/80 p-3 sm:p-3.5 shadow-2xs hover:shadow-sm hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group"
                      >
                        {/* Card Top */}
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {dayShort}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border",
                                row.status === "present" && !isLate
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : isLate
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    : "bg-muted text-muted-foreground border-border",
                              )}
                            >
                              {row.status === "present" && !isLate ? (
                                <CheckCheck size={10} className="stroke-[2.5]" />
                              ) : isLate ? (
                                <Clock size={10} className="stroke-[2.5]" />
                              ) : null}
                              <span>{isLate ? "Late" : row.status}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-medium">
                            {dateFormatted}
                          </div>
                        </div>

                        {/* Hours & Visual Progress */}
                        <div className="my-2.5">
                          <div className="flex items-baseline justify-between mb-1">
                            <span className="text-base sm:text-lg font-black text-foreground tabular-nums tracking-tight">
                              {hours ? formatWorkHours(hours) : "—"}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground/80 tabular-nums">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                row.status === "present" && !isLate
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                  : isLate
                                    ? "bg-gradient-to-r from-amber-500 to-orange-400"
                                    : "bg-primary",
                              )}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>

                        {/* Card Bottom / In - Out Times */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <div className="flex items-center gap-1" title="Check In">
                            <LogIn size={11} className="text-emerald-500 shrink-0" />
                            <span className="font-semibold text-foreground">
                              {row.check_in_time ? formatTime12Hour(row.check_in_time) : "—"}
                            </span>
                          </div>
                          <span className="text-muted-foreground/40 font-sans">→</span>
                          <div className="flex items-center gap-1" title="Check Out">
                            <LogOut size={11} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-foreground">
                              {row.check_out_time ? formatTime12Hour(row.check_out_time) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No attendance records captured yet.
                </div>
              )}
            </div>
          ) : (
            /* MODE 2: COMPACT CLEAN TABLE */
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-white/60 dark:bg-card/60">
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/40 text-muted-foreground text-[11px]">
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3 font-semibold">Check In</th>
                    <th className="py-2.5 px-3 font-semibold">Check Out</th>
                    <th className="py-2.5 px-3 font-semibold">Worked Hours</th>
                    <th className="py-2.5 px-3 font-semibold">Shift Progress</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentAttendance.map((row) => {
                    const isRowToday = row.date === todayDate;
                    const hours = row.work_hours
                      ? Number(row.work_hours)
                      : isRowToday && workedHours
                        ? workedHours
                        : 0;
                    const isLate = row.is_late || row.status === "late";
                    const pct = Math.min(100, Math.round((hours / (expectedDailyHours || 9)) * 100));

                    return (
                      <tr key={row.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground tabular-nums whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isRowToday && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            )}
                            <span>{format(new Date(row.date), "EEE, MMM d, yyyy")}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground tabular-nums whitespace-nowrap">
                          {row.check_in_time ? (
                            <span className="inline-flex items-center gap-1 text-foreground font-mono font-medium">
                              <LogIn size={11} className="text-emerald-500" />
                              {formatTime12Hour(row.check_in_time)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground tabular-nums whitespace-nowrap">
                          {row.check_out_time ? (
                            <span className="inline-flex items-center gap-1 text-foreground font-mono font-medium">
                              <LogOut size={11} className="text-slate-400" />
                              {formatTime12Hour(row.check_out_time)}
                            </span>
                          ) : isRowToday ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Working
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-foreground font-extrabold tabular-nums whitespace-nowrap">
                          {hours ? formatWorkHours(hours) : "—"}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  row.status === "present" && !isLate
                                    ? "bg-emerald-500"
                                    : isLate
                                      ? "bg-amber-500"
                                      : "bg-primary",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono tabular-nums">{pct}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase border",
                              row.status === "present" && !isLate
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                : row.is_late || row.status === "late"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : "bg-muted text-muted-foreground border-border",
                            )}
                          >
                            {isLate ? "Late" : row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 5: Work & Activity Hubs (Side-by-Side)                                */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (60%): Work & Schedule Hub (Tabs: Tasks | Schedule) */}
        <div className="lg:col-span-7 glass aslenix-dashboard-card card-tone-rose rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-3.5">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTaskScheduleTab("tasks")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    taskScheduleTab === "tasks"
                      ? "bg-white dark:bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ClipboardList size={13} className="text-primary" />
                  <span>My Tasks</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                    {focusTasks.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskScheduleTab("schedule")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    taskScheduleTab === "schedule"
                      ? "bg-white dark:bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarDays size={13} className="text-primary" />
                  <span>Schedule & Events</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                    {upcomingActivities.length}
                  </span>
                </button>
              </div>

              {taskScheduleTab === "tasks" ? (
                <Link
                  to="/tasks"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 group"
                >
                  <span>All tasks</span>
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <Link
                  to="/calendar"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 group"
                >
                  <span>Calendar</span>
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>

            {/* TAB CONTENT: MY TASKS */}
            {taskScheduleTab === "tasks" && (
              <div className="space-y-3">
                {focusTasks.length > 0 ? (
                  focusTasks.map((task) => {
                    const isOverdue =
                      task.deadline && new Date(task.deadline).getTime() < Date.now();
                    const progressPct = Math.min(100, Math.max(0, Number(task.progress || 0)));
                    return (
                      <div
                        key={task.id}
                        className="rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-3 sm:p-3.5 hover:border-primary/40 hover:shadow-xs transition-all flex flex-col gap-2.5 group"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1 flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                              <FolderKanban size={13} />
                            </div>
                            <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {task.title}
                            </h3>
                            {task.priority && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider shrink-0 border",
                                  task.priority === "high"
                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                    : task.priority === "medium"
                                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                      : "bg-muted text-muted-foreground border-border",
                                )}
                              >
                                {task.priority}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.deadline && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground",
                                  isOverdue ? "text-destructive font-semibold" : "",
                                )}
                              >
                                <Clock size={11} />
                                {format(new Date(task.deadline), "MMM d")}
                              </span>
                            )}
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold capitalize border",
                                task.status === "in_progress"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : task.status === "review"
                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                    : "bg-muted text-muted-foreground border-border",
                              )}
                            >
                              {task.status ? task.status.replace("_", " ") : "Pending"}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2 bg-muted/80 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${progressPct}%`,
                                background: "var(--gradient-brand)",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums font-mono font-bold">
                            {progressPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    All caught up! No active tasks assigned to you right now.
                  </div>
                )}

                {/* SPRINT HEALTH & PRODUCTIVITY STRIP */}
                <div className="pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp size={11} className="text-primary" />
                      Sprint Health & Velocity
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      ● Active Sprint
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border/60 bg-white/70 dark:bg-card/70 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground font-medium">In Progress</div>
                      <div className="text-sm font-extrabold text-foreground mt-0.5">{taskStats.pending || 1}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-white/70 dark:bg-card/70 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground font-medium">Completed</div>
                      <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{taskStats.completed || 2}</div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-white/70 dark:bg-card/70 p-2 text-center">
                      <div className="text-[10px] text-muted-foreground font-medium">Completion Rate</div>
                      <div className="text-sm font-extrabold text-primary mt-0.5">
                        {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 67}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: SCHEDULE & EVENTS */}
            {taskScheduleTab === "schedule" && (
              <div className="space-y-2">
                {upcomingActivities.length > 0 ? (
                  upcomingActivities.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 flex items-center justify-between gap-3 hover:border-primary/30 transition-all"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 border",
                            item.type === "meeting"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : item.type === "holiday"
                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          )}
                        >
                          {item.type}
                        </span>
                        {item.isToday && (
                          <span className="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold uppercase shrink-0">
                            Today
                          </span>
                        )}
                        <h3 className="truncate text-xs font-bold text-foreground">
                          {item.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                          <Clock size={11} />
                          <span>{item.timeLabel}</span>
                        </span>
                        {item.actionUrl && (
                          <a
                            href={item.actionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                          >
                            <span>Join</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No upcoming schedule or activities planned.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (40%): Activity & Leaves Hub (Tabs: Leaves | Notifications) */}
        <div className="lg:col-span-5 glass aslenix-dashboard-card card-tone-cyan rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-3.5">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-muted/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLeavesNoticesTab("leaves")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    leavesNoticesTab === "leaves"
                      ? "bg-white dark:bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Calendar size={13} className="text-primary" />
                  <span>Leaves</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                    {recentLeaves.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeavesNoticesTab("notices")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    leavesNoticesTab === "notices"
                      ? "bg-white dark:bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Bell size={13} className="text-primary" />
                  <span>Notices</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                    {uniqueNotifications.length}
                  </span>
                </button>
              </div>

              {leavesNoticesTab === "leaves" ? (
                <Link
                  to="/my-leaves"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 group"
                >
                  <span>Apply</span>
                  <CalendarPlus size={12} className="group-hover:scale-110 transition-transform" />
                </Link>
              ) : (
                <Link
                  to="/notifications"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 group"
                >
                  <span>All</span>
                  <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>

            {/* TAB CONTENT: LEAVES */}
            {leavesNoticesTab === "leaves" && (
              <div className="space-y-2.5">
                {recentLeaves.length > 0 ? (
                  recentLeaves.slice(0, 3).map((request) => {
                    const days = getLeaveDurationDays(request.start_date, request.end_date);
                    return (
                      <div
                        key={request.id}
                        className="rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 hover:border-primary/40 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted/60 border border-border/70">
                            {getLeaveIcon(request.leave_type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold capitalize text-foreground truncate group-hover:text-primary transition-colors">
                                {request.leave_type.replace("_", " ")} Leave
                              </span>
                              <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold text-muted-foreground shrink-0 uppercase">
                                {days} {days === 1 ? "Day" : "Days"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5 truncate">
                              {format(new Date(request.start_date), "MMM d")} –{" "}
                              {format(new Date(request.end_date), "MMM d, yyyy")}
                              {request.reason && (
                                <span className="opacity-70 ml-1">· {request.reason}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-bold capitalize border shrink-0 flex items-center gap-1",
                            request.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : request.status === "rejected"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : request.status === "cancelled"
                                  ? "bg-muted text-muted-foreground border-border"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              request.status === "approved"
                                ? "bg-emerald-500"
                                : request.status === "rejected"
                                  ? "bg-destructive"
                                  : request.status === "cancelled"
                                    ? "bg-muted-foreground"
                                    : "bg-amber-500",
                            )}
                          />
                          {request.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No leave requests found.
                  </div>
                )}

                {/* ANNUAL LEAVE BALANCE PROGRESS STRIP */}
                <div className="pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Annual Leave Quota (2/mo)
                    </span>
                    <span className="text-[11px] font-bold text-foreground">
                      <span className="text-primary font-extrabold">{availableLeaveDays}</span>
                      <span className="text-muted-foreground font-normal"> / {leaveQuotaSummary.total} days left</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/80 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(5, Math.round(((leaveQuotaSummary.total - availableLeaveDays) / (leaveQuotaSummary.total || 1)) * 100)),
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{leaveQuotaSummary.used} of {leaveQuotaSummary.total} days used (2 days/month)</span>
                    <Link to="/my-leaves" className="font-semibold text-primary hover:underline">
                      Apply leave →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: NOTICES & ALERTS */}
            {leavesNoticesTab === "notices" && (
              <div className="space-y-2">
                {uniqueNotifications.length > 0 ? (
                  uniqueNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 flex items-center justify-between gap-3 hover:border-primary/30 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs font-bold text-foreground">{n.title}</h4>
                        <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                          {n.message}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/80 shrink-0 tabular-nums whitespace-nowrap">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No notifications right now.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 6: Quick Actions & Self-Service Shortcuts (Full-width 6-Column Bar)   */}
      {/* ========================================================================= */}
      <section className="glass aslenix-dashboard-card card-tone-mint rounded-2xl border border-border/70 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={14} />
            </div>
            <h2 className="text-sm font-bold text-foreground">Quick Actions</h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">Self-service shortcuts</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Link
            to="/my-leaves"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-purple-500/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform">
              <CalendarPlus size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Apply Leave
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                Vacation & sick
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/my-attendance"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-emerald-500/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <CalendarCheck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                My Attendance
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                Logs & records
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/my-attendance"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-amber-500/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
              <FileEdit size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Correction
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                Time adjustment
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/tasks"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-primary/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
              <CheckSquare size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                My Tasks
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                Kanban & sprint
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/meetings"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-blue-500/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 group-hover:scale-105 transition-transform">
              <Video size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Meetings
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                Syncs & calls
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/profile"
            className="group relative flex items-center gap-2.5 rounded-xl border border-border/70 bg-white/80 dark:bg-card/80 p-2.5 sm:p-3 hover:bg-white dark:hover:bg-card hover:border-slate-500/40 hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 group-hover:scale-105 transition-transform">
              <UserCheck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                Profile Details
              </div>
              <div className="text-[10px] text-muted-foreground truncate hidden sm:block">
                ID & credentials
              </div>
            </div>
            <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </div>
      </section>
    </div>
  );
}
