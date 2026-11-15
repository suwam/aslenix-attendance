import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAppResume } from "@/lib/use-app-resume";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LiveClock } from "@/components/LiveClock";
import { Button } from "@/components/ui/button";
import { getVerifiedAttendanceLocation } from "@/lib/attendance-location";
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
};

type CalendarHoliday = {
  id: string;
  title: string;
  bsDate: string;
  adDate?: string;
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
  const [meetings, setMeetings] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeActivityTab, setActiveActivityTab] = useState<"meetings" | "holidays" | "announcements">("meetings");
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

    // Load attendance, shifts, leave balances, meetings, holidays, and notifications in parallel
    const [
      { data: todayAttendance },
      { data: monthAttendanceRows },
      userShift,
      { data: leaveBalances },
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
      fetchEmployeeAssignedShift(user.id, todayDate),
      supabase
        .from("leave_balances")
        .select("*")
        .eq("user_id", user.id),
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
        .select("id, title, message, created_at, is_read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("tasks").select("*").eq("assigned_to", user.id),
      supabase.from("task_assignees").select("task_id").eq("user_id", user.id),
      supabase.from("task_team_leads").select("task_id").eq("user_id", user.id),
    ]);

    // Set today attendance and shift
    setToday(todayAttendance);
    setAssignedShift(userShift.shift);

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

  const statusText = useMemo(() => {
    if (isWeeklyOff) return WEEKLY_OFF_LABEL;
    if (!today) {
      return isCutoffPassed && !isAdmin ? "Check-in closed (after 2:00 PM)" : "Not checked in";
    }
    if (today.check_out_time) return "Day completed";
    if (today.is_late) return "Working · Late Arrival";
    return "Working · On Time";
  }, [isWeeklyOff, today, isCutoffPassed, isAdmin]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* A. Welcome Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {greeting}, {firstName} 👋
            </h1>
          </div>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            {profile?.position ? `${profile.position} · ` : ""}
            {profile?.department || "ASLENIX"} · {nepaliToday} BS ({format(new Date(), "EEE, MMM d")})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 backdrop-blur-sm shadow-xs">
            <LiveClock className="text-xs sm:text-sm font-semibold tabular-nums text-foreground" />
          </div>
          <Link
            to="/my-attendance"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            My Attendance <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* B. Today's Attendance Card */}
      <section className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Shift info and current status */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Today's Attendance
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {assignedShift.name} ({formatTime12Hour(assignedShift.start_time)} – {formatTime12Hour(assignedShift.end_time)})
                </span>
                {today?.is_late && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    Late ({today.late_minutes ?? 0}m)
                  </span>
                )}
                {today?.is_early_checkout && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
                    Early Departure
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-foreground">{statusText}</span>
                <span className="text-xs text-muted-foreground">· Grace: {assignedShift.grace_period_mins}m</span>
              </div>
            </div>
          </div>

          {/* Times and hours overview */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl border border-border/50 bg-background/50 p-2.5 sm:px-4 sm:py-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Check In</div>
              <div className="mt-0.5 text-xs sm:text-sm font-bold text-foreground tabular-nums">
                {today?.check_in_time ? formatTime12Hour(today.check_in_time) : "--:--"}
              </div>
            </div>
            <div className="border-x border-border/40 px-2 sm:px-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Check Out</div>
              <div className="mt-0.5 text-xs sm:text-sm font-bold text-foreground tabular-nums">
                {today?.check_out_time ? formatTime12Hour(today.check_out_time) : today ? "Working" : "--:--"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Working Hours</div>
              <div className="mt-0.5 text-xs sm:text-sm font-bold text-foreground tabular-nums">
                {workedHours ? formatWorkHours(workedHours) : "0h"}
                <span className="text-[10px] sm:text-[11px] font-normal text-muted-foreground"> / {expectedDailyHours}h</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isAdmin && (
              <span className="hidden xl:inline text-xs font-medium text-muted-foreground italic mr-1">
                Admin mode
              </span>
            )}
            <Button
              onClick={checkIn}
              disabled={busy || isWeeklyOff || Boolean(today) || (isCutoffPassed && !isAdmin)}
              size="sm"
              className="h-9 sm:h-10 rounded-xl px-4 font-semibold shadow-xs"
            >
              <LogIn size={15} className="mr-1.5" /> Check In
            </Button>
            <Button
              onClick={checkOut}
              disabled={busy || !today || Boolean(today?.check_out_time)}
              variant="outline"
              size="sm"
              className="h-9 sm:h-10 rounded-xl px-4 font-semibold"
            >
              <LogOut size={15} className="mr-1.5" /> Check Out
            </Button>
          </div>
        </div>
      </section>

      {/* C. Quick Statistics (4 compact cards) */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Present Days */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Present Days</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {monthStats.present} <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{nepaliMonth.label} BS</div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <UserCheck size={20} />
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Pending Tasks</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {taskStats.pending}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {taskStats.overdue > 0 ? (
                <span className="text-destructive font-medium">{taskStats.overdue} overdue</span>
              ) : (
                "In progress / review"
              )}
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Clock size={20} />
          </div>
        </div>

        {/* Completed Tasks */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Completed Tasks</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {taskStats.completed} <span className="text-xs font-normal text-muted-foreground">/ {taskStats.total}</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {taskStats.total ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}% completion
            </div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <CheckCheck size={20} />
          </div>
        </div>

        {/* Available Leave Balance */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Available Leave</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {availableLeaveDays} <span className="text-xs font-normal text-muted-foreground">days</span>
            </div>
            <Link to="/my-leaves" className="text-[11px] text-primary hover:underline mt-0.5 inline-block">
              Apply leave →
            </Link>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
            <Calendar size={20} />
          </div>
        </div>
      </section>

      {/* D & E. Two-column Grid: My Tasks & Upcoming Activities */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* D. My Tasks Card */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">My Tasks</h2>
                <p className="text-xs text-muted-foreground">Latest active tasks assigned to you</p>
              </div>
              <Link
                to="/tasks"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                View All <ArrowRight size={13} />
              </Link>
            </div>

            <div className="space-y-2">
              {focusTasks.length > 0 ? (
                focusTasks.map((task) => {
                  const isOverdue = task.deadline && new Date(task.deadline).getTime() < Date.now();
                  return (
                    <div
                      key={task.id}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 sm:p-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {task.title}
                          </h3>
                          {task.priority && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                                task.priority === "high"
                                  ? "bg-destructive/15 text-destructive"
                                  : task.priority === "medium"
                                    ? "bg-amber-500/15 text-amber-500"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {task.priority}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          {task.deadline ? (
                            <span className={cn("flex items-center gap-1", isOverdue ? "text-destructive font-medium" : "")}>
                              <Clock size={11} />
                              {isOverdue ? "Overdue: " : "Deadline: "}
                              {format(new Date(task.deadline), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span>No deadline set</span>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize shrink-0",
                          task.status === "in_progress"
                            ? "bg-blue-500/15 text-blue-500"
                            : task.status === "review"
                              ? "bg-purple-500/15 text-purple-500"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {task.status ? task.status.replace("_", " ") : "Pending"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                  <CheckCircle2 size={24} className="text-emerald-500 mb-1.5 opacity-80" />
                  <p className="text-xs font-medium text-foreground">All caught up!</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">No pending tasks currently in your queue.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* E. Upcoming Activities Card */}
        <div className="rounded-2xl border border-border/70 bg-card/60 p-4 sm:p-5 backdrop-blur-sm shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3.5">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground">Upcoming Activities</h2>
                <p className="text-xs text-muted-foreground">Meetings, holidays, and updates</p>
              </div>

              {/* Activity tabs */}
              <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveActivityTab("meetings")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-medium transition-colors",
                    activeActivityTab === "meetings"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Meetings ({meetings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActivityTab("holidays")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-medium transition-colors",
                    activeActivityTab === "holidays"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Holidays ({holidays.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActivityTab("announcements")}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-medium transition-colors",
                    activeActivityTab === "announcements"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Updates ({notifications.length})
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {activeActivityTab === "meetings" && (
                meetings.length > 0 ? (
                  meetings.slice(0, 3).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 sm:p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Video size={13} className="text-primary shrink-0" />
                          <h3 className="truncate text-xs sm:text-sm font-semibold text-foreground">{meeting.title}</h3>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Clock size={11} />
                          <span>{format(new Date(meeting.meeting_time), "EEE, MMM d · hh:mm a")}</span>
                          {meeting.location && <span>· {meeting.location}</span>}
                        </div>
                      </div>
                      {meeting.meeting_link && (
                        <a
                          href={meeting.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0"
                        >
                          Join
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                    <Video size={22} className="mb-1.5 opacity-40" />
                    <p className="text-xs">No upcoming meetings scheduled.</p>
                  </div>
                )
              )}

              {activeActivityTab === "holidays" && (
                holidays.length > 0 ? (
                  holidays.slice(0, 3).map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 sm:p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-purple-500 shrink-0" />
                          <h3 className="truncate text-xs sm:text-sm font-semibold text-foreground">{holiday.title}</h3>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          <span>{holiday.bsDate} BS</span>
                        </div>
                      </div>
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-500 shrink-0">
                        Holiday
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                    <Calendar size={22} className="mb-1.5 opacity-40" />
                    <p className="text-xs">No upcoming company holidays.</p>
                  </div>
                )
              )}

              {activeActivityTab === "announcements" && (
                notifications.length > 0 ? (
                  notifications.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/50 p-2.5 sm:p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Bell size={13} className="text-amber-500 shrink-0" />
                          <h3 className="truncate text-xs sm:text-sm font-semibold text-foreground">{n.title}</h3>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                        {format(new Date(n.created_at), "MMM d")}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-7 text-center text-muted-foreground">
                    <Bell size={22} className="mb-1.5 opacity-40" />
                    <p className="text-xs">No recent announcements.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
