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
  CalendarPlus,
  CheckCheck,
  CheckSquare,
  Clock,
  ExternalLink,
  FileEdit,
  FileText,
  LogIn,
  LogOut,
  ShieldCheck,
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
  const [availableLeaveDays, setAvailableLeaveDays] = useState<number>(0);
  const [recentLeaves, setRecentLeaves] = useState<LeaveRequestItem[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<"all" | "meetings" | "holidays">("all");
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);

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
        .limit(5),
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

    // Compute leave balance
    if (leaveBalances && leaveBalances.length > 0) {
      const remaining = leaveBalances.reduce((sum, row) => {
        const balance = Number(row.balance ?? 0);
        const used = Number(row.used ?? 0);
        return sum + Math.max(0, balance - used);
      }, 0);
      setAvailableLeaveDays(remaining);
    } else {
      setAvailableLeaveDays(16);
    }

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
    if (!isAdmin && isAttendanceCutoffPassed()) {
      return toast.error("Attendance after 2:00 PM Nepal time is prohibited. Check-in is closed for today.");
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
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
      };
    }
    if (!today) {
      if (isCutoffPassed && !isAdmin) {
        return {
          label: "Closed (Past 2:00 PM)",
          dotClass: "bg-rose-500",
          badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
        };
      }
      return {
        label: "Not Checked In",
        dotClass: "bg-slate-400",
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      };
    }
    if (today.check_out_time) {
      return {
        label: today.is_early_checkout ? "Completed · Early Left" : "Day Completed",
        dotClass: "bg-blue-500",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      };
    }
    if (today.is_late) {
      return {
        label: "Working · Late Arrival",
        dotClass: "bg-amber-500 animate-pulse",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      };
    }
    return {
      label: "Working · On Time",
      dotClass: "bg-emerald-500 animate-pulse",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    };
  }, [isWeeklyOff, today, isCutoffPassed, isAdmin]);

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
    <div className="space-y-4 sm:space-y-4 max-w-[1440px] mx-auto text-[#172033] dark:text-foreground">
      {/* ========================================================================= */}
      {/* ROW 1: Welcome Header with Integrated Compact Employee Profile Summary   */}
      {/* ========================================================================= */}
      <header className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            {/* Employee Avatar */}
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || "Employee"}
                className="h-12 w-12 rounded-full object-cover border border-[#E2E8F0] dark:border-border/70 shrink-0 shadow-xs"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5] font-bold text-sm border border-[#C7D2FE] dark:bg-primary/10 dark:text-primary dark:border-primary/20 shadow-xs">
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#172033] dark:text-foreground truncate">
                  {greeting}, {profile?.full_name || firstName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {profile?.approval_status === "approved" ? "Active Staff" : "Staff"}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-muted-foreground">
                <span className="font-medium text-[#172033] dark:text-foreground">
                  {profile?.position || "Team Member"}
                </span>
                <span>·</span>
                <span>{profile?.department || "ASLENIX"}</span>
                {profile?.employee_code && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[11px] bg-[#F1F5F9] dark:bg-muted px-1.5 py-0.5 rounded text-[#475569] dark:text-muted-foreground">
                      ID: {profile.employee_code}
                    </span>
                  </>
                )}
                {profile?.joining_date && (
                  <>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline">
                      Joined {format(new Date(profile.joining_date), "MMM yyyy")}
                    </span>
                  </>
                )}
              </div>

              <div className="mt-1 text-[11px] text-[#94A3B8] dark:text-muted-foreground">
                {format(new Date(), "EEEE, MMMM d, yyyy")} · {nepaliToday} BS
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] dark:border-border/70 bg-white dark:bg-card px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-foreground shadow-xs hover:bg-[#F8FAFC] dark:hover:bg-muted hover:border-[#CBD5E1] transition-colors"
            >
              <User size={13} className="text-[#64748B] dark:text-muted-foreground" />
              <span>My Profile</span>
            </Link>
            <Link
              to="/my-attendance"
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#E2E8F0] dark:border-border/70 bg-white dark:bg-card px-3 py-1.5 text-xs font-semibold text-[#172033] dark:text-foreground shadow-xs hover:bg-[#F8FAFC] dark:hover:bg-muted hover:border-[#CBD5E1] transition-colors"
            >
              <Clock size={13} className="text-[#64748B] dark:text-muted-foreground" />
              <span>Attendance History</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* ROW 2: Full-width Today's Attendance Panel                                */}
      {/* ========================================================================= */}
      <section className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Status & Shift Information */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-[270px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF2FF] text-[#4F46E5] dark:bg-primary/10 dark:text-primary">
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border", statusConfig.badgeClass)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig.dotClass)} />
                  {statusConfig.label}
                </span>
                {today?.late_minutes > 0 && today?.is_late && (
                  <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    +{today.late_minutes}m
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-[#64748B] dark:text-muted-foreground truncate">
                <strong className="text-[#172033] dark:text-foreground font-semibold">{assignedShift.name}</strong> ·{" "}
                {formatTime12Hour(assignedShift.start_time)} – {formatTime12Hour(assignedShift.end_time)} (Grace: {assignedShift.grace_period_mins}m)
              </div>
            </div>
          </div>

          {/* Attendance Times & Hours */}
          <div className="grid grid-cols-3 gap-3 sm:gap-6 border-y xl:border-y-0 xl:border-x border-[#E2E8F0] dark:border-border/60 py-3 xl:py-0 xl:px-6">
            <div>
              <div className="text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">Check In</div>
              <div className="mt-0.5 text-sm sm:text-base font-semibold text-[#172033] dark:text-foreground tabular-nums">
                {today?.check_in_time ? formatTime12Hour(today.check_in_time) : "—"}
              </div>
              <div className="text-[10px] text-[#94A3B8] dark:text-muted-foreground">
                Sched: {formatTime12Hour(assignedShift.start_time)}
              </div>
            </div>

            <div className="border-x xl:border-x-0 border-[#E2E8F0] dark:border-border/60 px-3 xl:px-0">
              <div className="text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">Check Out</div>
              <div className="mt-0.5 text-sm sm:text-base font-semibold text-[#172033] dark:text-foreground tabular-nums">
                {today?.check_out_time ? formatTime12Hour(today.check_out_time) : today ? (
                  <span className="text-[#4F46E5] dark:text-primary font-medium">Working</span>
                ) : "—"}
              </div>
              <div className="text-[10px] text-[#94A3B8] dark:text-muted-foreground">
                Sched: {formatTime12Hour(assignedShift.end_time)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">Working Hours</div>
              <div className="mt-0.5 text-sm sm:text-base font-semibold text-[#172033] dark:text-foreground tabular-nums">
                {workedHours ? formatWorkHours(workedHours) : "0h 0m"}
              </div>
              <div className="text-[10px] text-[#94A3B8] dark:text-muted-foreground">
                {expectedDailyHours}h expected
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isAdmin && (
              <span className="hidden 2xl:inline text-xs font-medium text-[#64748B] dark:text-muted-foreground italic mr-1">
                Admin mode
              </span>
            )}
            <Button
              onClick={checkIn}
              disabled={busy || isWeeklyOff || Boolean(today) || (isCutoffPassed && !isAdmin)}
              className="h-9 sm:h-10 rounded-[10px] bg-[#172554] hover:bg-[#1E293B] text-white font-medium px-4 text-xs sm:text-sm shadow-xs transition-colors"
            >
              <LogIn size={15} className="mr-1.5" /> Check In
            </Button>
            <Button
              onClick={checkOut}
              disabled={busy || !today || Boolean(today?.check_out_time)}
              variant="outline"
              className="h-9 sm:h-10 rounded-[10px] border-[#E2E8F0] dark:border-border/70 bg-white dark:bg-card text-[#172033] dark:text-foreground hover:bg-[#F8FAFC] dark:hover:bg-muted font-medium px-4 text-xs sm:text-sm shadow-xs transition-colors"
            >
              <LogOut size={15} className="mr-1.5" /> Check Out
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 3: Four Statistics Cards (Clean Enterprise Format)                     */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Present Days */}
        <Link
          to="/my-attendance"
          className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 shadow-xs flex flex-col justify-between h-[102px] hover:border-primary/40 transition-colors group"
        >
          <div className="flex items-center justify-between text-[#64748B] dark:text-muted-foreground">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Present Days</span>
            <CalendarCheck size={16} className="text-[#64748B] dark:text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] dark:text-foreground tracking-tight tabular-nums">
              {monthStats.present} <span className="text-xs font-normal text-[#64748B] dark:text-muted-foreground">days</span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-muted-foreground truncate mt-0.5">
              {nepaliMonth.label} BS · {monthStats.late > 0 ? `${monthStats.late} late arrival${monthStats.late > 1 ? "s" : ""}` : "On-time record"}
            </p>
          </div>
        </Link>

        {/* Pending Tasks */}
        <Link
          to="/tasks"
          className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 shadow-xs flex flex-col justify-between h-[102px] hover:border-primary/40 transition-colors group"
        >
          <div className="flex items-center justify-between text-[#64748B] dark:text-muted-foreground">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Pending Tasks</span>
            <Clock size={16} className="text-[#64748B] dark:text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] dark:text-foreground tracking-tight tabular-nums">
              {taskStats.pending}
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-muted-foreground truncate mt-0.5">
              {taskStats.overdue > 0 ? (
                <span className="text-[#DC2626] font-medium">{taskStats.overdue} overdue</span>
              ) : (
                "All tasks on schedule"
              )}
            </p>
          </div>
        </Link>

        {/* Completed Tasks */}
        <Link
          to="/tasks"
          className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 shadow-xs flex flex-col justify-between h-[102px] hover:border-primary/40 transition-colors group"
        >
          <div className="flex items-center justify-between text-[#64748B] dark:text-muted-foreground">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Completed Tasks</span>
            <CheckCheck size={16} className="text-[#64748B] dark:text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] dark:text-foreground tracking-tight tabular-nums">
              {taskStats.completed} <span className="text-xs font-normal text-[#64748B] dark:text-muted-foreground">/ {taskStats.total}</span>
            </div>
            <p className="text-[11px] text-[#64748B] dark:text-muted-foreground truncate mt-0.5">
              {taskStats.total ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% completion rate
            </p>
          </div>
        </Link>

        {/* Available Leave Balance */}
        <Link
          to="/my-leaves"
          className="bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 shadow-xs flex flex-col justify-between h-[102px] hover:border-primary/40 transition-colors group"
        >
          <div className="flex items-center justify-between text-[#64748B] dark:text-muted-foreground">
            <span className="text-xs font-medium group-hover:text-primary transition-colors">Available Leave</span>
            <FileText size={16} className="text-[#64748B] dark:text-muted-foreground" />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#172033] dark:text-foreground tracking-tight tabular-nums">
              {availableLeaveDays} <span className="text-xs font-normal text-[#64748B] dark:text-muted-foreground">days</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[11px] text-[#64748B] dark:text-muted-foreground">Annual quota balance</span>
              <span className="text-[11px] font-semibold text-[#4F46E5] group-hover:underline">
                Apply →
              </span>
            </div>
          </div>
        </Link>
      </section>

      {/* ========================================================================= */}
      {/* ROW 4: Two-column Layout: My Tasks (Left) & Upcoming Activities (Right)   */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (60%): My Tasks */}
        <div className="lg:col-span-7 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">My Tasks</h2>
                <span className="rounded-md bg-[#F1F5F9] dark:bg-muted px-2 py-0.5 text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">
                  {focusTasks.length} active
                </span>
              </div>
              <Link
                to="/tasks"
                className="text-xs font-semibold text-[#4F46E5] dark:text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>View all tasks</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="divide-y divide-[#F1F5F9] dark:divide-border/40">
              {focusTasks.length > 0 ? (
                focusTasks.map((task) => {
                  const isOverdue = task.deadline && new Date(task.deadline).getTime() < Date.now();
                  const progressPct = Math.min(100, Math.max(0, Number(task.progress || 0)));
                  return (
                    <div
                      key={task.id}
                      className="py-3 first:pt-1 last:pb-1 flex flex-col gap-2 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs sm:text-sm font-semibold text-[#172033] dark:text-foreground group-hover:text-[#4F46E5] transition-colors truncate">
                              {task.title}
                            </h3>
                            {task.priority && (
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0 border",
                                  task.priority === "high"
                                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                    : task.priority === "medium"
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                      : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                                )}
                              >
                                {task.priority}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-[#64748B] dark:text-muted-foreground">
                            {task.deadline ? (
                              <span className={cn("inline-flex items-center gap-1", isOverdue ? "text-rose-600 dark:text-rose-400 font-medium" : "")}>
                                <Clock size={12} />
                                {isOverdue ? "Overdue: " : "Deadline: "}
                                {format(new Date(task.deadline), "MMM d, yyyy")}
                              </span>
                            ) : (
                              <span>No deadline set</span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span
                            className={cn(
                              "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border",
                              task.status === "in_progress"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                : task.status === "review"
                                  ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                  : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                            )}
                          >
                            {task.status ? task.status.replace("_", " ") : "Pending"}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#F1F5F9] dark:bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4F46E5] rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#94A3B8] tabular-nums font-mono">
                          {progressPct}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-[#64748B] dark:text-muted-foreground">
                  No active pending tasks assigned to you right now.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (40%): Today's Schedule and Upcoming Activities */}
        <div className="lg:col-span-5 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-2">
              <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">Schedule & Activities</h2>
              <div className="flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setActivityFilter("all")}
                  className={cn(
                    "px-2 py-0.5 rounded transition-colors",
                    activityFilter === "all" ? "bg-[#F1F5F9] dark:bg-muted text-[#172033] dark:text-foreground font-semibold" : "hover:text-[#172033]",
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter("meetings")}
                  className={cn(
                    "px-2 py-0.5 rounded transition-colors",
                    activityFilter === "meetings" ? "bg-[#F1F5F9] dark:bg-muted text-[#172033] dark:text-foreground font-semibold" : "hover:text-[#172033]",
                  )}
                >
                  Meetings
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter("holidays")}
                  className={cn(
                    "px-2 py-0.5 rounded transition-colors",
                    activityFilter === "holidays" ? "bg-[#F1F5F9] dark:bg-muted text-[#172033] dark:text-foreground font-semibold" : "hover:text-[#172033]",
                  )}
                >
                  Holidays
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#F1F5F9] dark:divide-border/40">
              {upcomingActivities.length > 0 ? (
                upcomingActivities.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider shrink-0 border",
                            item.type === "meeting"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : item.type === "holiday"
                                ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                          )}
                        >
                          {item.type}
                        </span>
                        {item.isToday && (
                          <span className="rounded bg-emerald-100 text-emerald-800 px-1 py-0.2 text-[9px] font-bold uppercase shrink-0">
                            Today
                          </span>
                        )}
                        <h3 className="truncate text-xs sm:text-sm font-medium text-[#172033] dark:text-foreground">
                          {item.title}
                        </h3>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-muted-foreground flex items-center gap-1.5">
                        <Clock size={11} className="shrink-0" />
                        <span>{item.timeLabel}</span>
                        {item.subLabel && <span className="truncate">· {item.subLabel}</span>}
                      </div>
                    </div>
                    {item.actionUrl && (
                      <a
                        href={item.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-[8px] bg-[#EEF2FF] dark:bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5] dark:text-primary hover:bg-[#E0E7FF] transition-colors shrink-0"
                      >
                        <span>Join</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#64748B] dark:text-muted-foreground">
                  No upcoming activities scheduled.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 5: Two-column Layout: Leave Request Status (Left) & Notifications     */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (60%): Leave Request Status */}
        <div className="lg:col-span-7 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">Leave Requests Status</h2>
                <span className="rounded-md bg-[#F1F5F9] dark:bg-muted px-2 py-0.5 text-[11px] font-medium text-[#64748B] dark:text-muted-foreground">
                  {recentLeaves.filter((r) => r.status === "pending").length} pending
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/my-leaves"
                  className="text-xs font-semibold text-[#4F46E5] dark:text-primary hover:underline inline-flex items-center gap-1"
                >
                  <span>Apply Leave</span>
                  <CalendarPlus size={13} />
                </Link>
                <Link
                  to="/my-leaves"
                  className="text-xs font-medium text-[#64748B] dark:text-muted-foreground hover:underline hidden sm:inline"
                >
                  View all
                </Link>
              </div>
            </div>

            <div className="divide-y divide-[#F1F5F9] dark:divide-border/40">
              {recentLeaves.length > 0 ? (
                recentLeaves.slice(0, 4).map((request) => (
                  <div
                    key={request.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold capitalize text-[#172033] dark:text-foreground truncate">
                          {request.leave_type.replace("_", " ")} Leave
                        </span>
                        <span className="text-[11px] text-[#94A3B8]">·</span>
                        <span className="text-xs text-[#64748B] dark:text-muted-foreground tabular-nums">
                          {format(new Date(request.start_date), "MMM d")} –{" "}
                          {format(new Date(request.end_date), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-muted-foreground truncate">
                        {request.reason ? `Reason: ${request.reason}` : "No specific reason provided"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize border",
                          request.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : request.status === "rejected"
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              : request.status === "cancelled"
                                ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                        )}
                      >
                        {request.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#64748B] dark:text-muted-foreground">
                  No leave requests submitted recently.{" "}
                  <Link to="/my-leaves" className="text-[#4F46E5] font-semibold hover:underline">
                    Submit a request
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (40%): Recent Notifications */}
        <div className="lg:col-span-5 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">Recent Notifications</h2>
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.2 text-[10px] font-bold">
                    {notifications.filter((n) => !n.is_read).length} new
                  </span>
                )}
              </div>
              <Link
                to="/notifications"
                className="text-xs font-semibold text-[#4F46E5] dark:text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="divide-y divide-[#F1F5F9] dark:divide-border/40">
              {notifications.length > 0 ? (
                notifications.slice(0, 4).map((n) => (
                  <div
                    key={n.id}
                    className="py-2.5 first:pt-1 last:pb-1 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#4F46E5] shrink-0" />
                        )}
                        <h3 className="truncate text-xs sm:text-sm font-semibold text-[#172033] dark:text-foreground">
                          {n.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-[#64748B] dark:text-muted-foreground">
                        {n.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] shrink-0 tabular-nums whitespace-nowrap">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#64748B] dark:text-muted-foreground">
                  No notifications yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ROW 6: Two-column Layout: Recent Attendance History & Quick Actions       */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (60%): Recent Attendance History */}
        <div className="lg:col-span-7 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">Recent Attendance History</h2>
                <span className="text-[11px] text-[#64748B] dark:text-muted-foreground hidden sm:inline">
                  (Past 5 days)
                </span>
              </div>
              <Link
                to="/my-attendance"
                className="text-xs font-semibold text-[#4F46E5] dark:text-primary hover:underline inline-flex items-center gap-1"
              >
                <span>View full log</span>
                <ArrowRight size={12} />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#F1F5F9] dark:border-border/40 text-[#64748B] dark:text-muted-foreground text-[11px]">
                    <th className="py-2 font-medium">Date</th>
                    <th className="py-2 font-medium">In</th>
                    <th className="py-2 font-medium">Out</th>
                    <th className="py-2 font-medium">Hours</th>
                    <th className="py-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-border/40">
                  {recentAttendance.length > 0 ? (
                    recentAttendance.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F8FAFC] dark:hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 font-medium text-[#172033] dark:text-foreground tabular-nums whitespace-nowrap">
                          {format(new Date(row.date), "MMM d, yyyy")}
                        </td>
                        <td className="py-2.5 text-[#64748B] dark:text-muted-foreground tabular-nums whitespace-nowrap">
                          {row.check_in_time ? formatTime12Hour(row.check_in_time) : "—"}
                        </td>
                        <td className="py-2.5 text-[#64748B] dark:text-muted-foreground tabular-nums whitespace-nowrap">
                          {row.check_out_time ? formatTime12Hour(row.check_out_time) : "—"}
                        </td>
                        <td className="py-2.5 text-[#172033] dark:text-foreground font-semibold tabular-nums whitespace-nowrap">
                          {row.work_hours ? formatWorkHours(row.work_hours) : "—"}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-block rounded px-2 py-0.5 text-[10px] font-semibold capitalize border",
                              row.status === "present" && !row.is_late
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : row.is_late || row.status === "late"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : row.status === "leave"
                                    ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                            )}
                          >
                            {row.is_late ? "Late" : row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-[#64748B] dark:text-muted-foreground">
                        No recent attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (40%): Employee Quick Actions */}
        <div className="lg:col-span-5 bg-white dark:bg-card rounded-xl border border-[#E2E8F0] dark:border-border/70 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-border/60 pb-3 mb-3">
              <h2 className="text-sm font-bold text-[#172033] dark:text-foreground">Quick Actions</h2>
              <span className="text-xs text-[#64748B] dark:text-muted-foreground">Self-service</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/my-leaves"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300">
                  <CalendarPlus size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    Apply Leave
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Vacation & sick leave
                  </div>
                </div>
              </Link>

              <Link
                to="/my-attendance"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CalendarCheck size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    My Attendance
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Logs & time report
                  </div>
                </div>
              </Link>

              <Link
                to="/my-attendance"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300">
                  <FileEdit size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    Correction
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Request time adjustment
                  </div>
                </div>
              </Link>

              <Link
                to="/tasks"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300">
                  <CheckSquare size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    My Tasks
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Kanban & sprint work
                  </div>
                </div>
              </Link>

              <Link
                to="/meetings"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Video size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    Meetings
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Team calls & standups
                  </div>
                </div>
              </Link>

              <Link
                to="/profile"
                className="flex items-center gap-2.5 rounded-lg border border-[#E2E8F0] dark:border-border/60 bg-[#F8FAFC] dark:bg-muted/40 p-2.5 hover:border-primary/50 hover:bg-white dark:hover:bg-muted transition-all group shadow-2xs"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                  <UserCheck size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#172033] dark:text-foreground group-hover:text-primary transition-colors truncate">
                    Account Details
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-muted-foreground truncate">
                    Profile & emergency
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
