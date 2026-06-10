import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
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
  BadgeCheck,
  BellDot,
  Calendar,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  CircleUserRound,
  Clock,
  Crown,
  Flame,
  Gauge,
  History,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  UserRoundCog,
  Video,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format, isSameDay, subDays } from "date-fns";
import { productivityScore } from "@/lib/tasks-utils";
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

const WEEKLY_TARGET_HOURS = 42;
const WEEKLY_WORKING_DAYS = 6;

function EmployeeDashboard() {
  const { user, profile, isAdmin } = useAuth();
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
  const [monthAward, setMonthAward] = useState<any>(null);
  const [latestImprovement, setLatestImprovement] = useState<any>(null);
  const [improvementOpen, setImprovementOpen] = useState(false);
  const [notificationPopup, setNotificationPopup] = useState<NotificationRow | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);

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

    const [{ data: t }, { data: monthAttendance }, { data: historyRows }, awardResult, improvementResult] =
      await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", todayDate)
          .maybeSingle(),
        supabase.from("attendance").select("*").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
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
      ]);

    setToday(t);
    setAttendanceHistory(historyRows ?? []);
    setMonthAward(awardResult.error ? null : awardResult.data);
    const improvement = improvementResult.error ? null : improvementResult.data;
    setLatestImprovement(improvement);
    if (improvement?.id && !isImprovementDismissed(user.id, improvement.id)) {
      setImprovementOpen(true);
    }

    const monthRows = monthAttendance ?? [];
    const hours = Math.round(monthRows.reduce((sum, row) => sum + Number(row.work_hours || 0), 0) * 10) / 10;
    setMonthStats({
      present: monthRows.filter((row) => ["present", "late", "wfh"].includes(row.status)).length,
      late: monthRows.filter((row) => row.is_late).length,
      leave: monthRows.filter((row) => row.status === "leave").length,
      hours,
    });

    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", user.id)
      .order("deadline", { ascending: true, nullsFirst: false });
    const taskRows = tasks ?? [];
    const total = taskRows.length;
    const completed = taskRows.filter((task) => task.status === "completed").length;
    const active = taskRows.filter((task) => task.status === "in_progress" || task.status === "review").length;
    const pending = taskRows.filter((task) => task.status !== "completed").length;
    const overdue = taskRows.filter(
      (task) => task.deadline && new Date(task.deadline).getTime() < Date.now() && task.status !== "completed",
    ).length;
    const onTime = taskRows.filter(
      (task) =>
        task.status === "completed" &&
        (!task.deadline || !task.completed_at || new Date(task.completed_at) <= new Date(task.deadline)),
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
        .filter((task) => task.status !== "completed")
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

    const [{ data: recentTasks }, { data: standups }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,updated_at")
        .eq("assigned_to", user.id)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("standups")
        .select("id,date,today,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5),
    ]);
    const items = [
      ...(t?.check_in_time
        ? [{ kind: "Attendance", when: t.check_in_time, text: `Checked in at ${format(new Date(t.check_in_time), "HH:mm")}` }]
        : []),
      ...(t?.check_out_time
        ? [{ kind: "Attendance", when: t.check_out_time, text: `Checked out at ${format(new Date(t.check_out_time), "HH:mm")}` }]
        : []),
      ...(recentTasks || []).map((task: any) => ({
        kind: "Task",
        when: task.updated_at,
        text: `${task.title} moved to ${humanize(task.status)}`,
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
    if (isAdmin) return toast.info("Admin accounts do not need attendance check-in.");
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
    if (isAdmin) return toast.info("Admin accounts do not need attendance checkout.");
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
  const todayMeetings = meetings.filter((meeting) => isSameDay(new Date(meeting.meeting_time), new Date())).slice(0, 3);
  const heatmapDays = useMemo(() => makeHeatmapDays(attendanceHistory), [attendanceHistory]);
  const heatmapSummary = useMemo(() => summarizeHeatmap(heatmapDays, attendanceStreak, attendanceHistory, today), [
    heatmapDays,
    attendanceStreak,
    attendanceHistory,
    today,
  ]);
  const pendingLeaveRequests = monthStats.leave;

  const dismissImprovement = () => {
    if (user && latestImprovement?.id) {
      markImprovementDismissed(user.id, latestImprovement.id);
    }
    setImprovementOpen(false);
  };

  const showNotificationOnce = (notification: NotificationRow) => {
    if (notification.is_read || hasSeenNotification(notification.id)) return;
    markNotificationSeen(notification.id);
    setNotificationPopup(notification);
  };

  const closeNotificationPopup = () => {
    setNotificationPopup(null);
  };

  const markNotificationRead = async () => {
    if (!notificationPopup) return;
    const notification = notificationPopup;
    markNotificationSeen(notification.id);
    setNotificationPopup(null);
    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
  };

  return (
    <>
      <NotificationPopup
        notification={notificationPopup}
        meetings={meetings}
        blocked={improvementOpen}
        onClose={closeNotificationPopup}
        onRead={markNotificationRead}
      />

      <Dialog
        open={improvementOpen}
        onOpenChange={(open) => {
          if (!open) dismissImprovement();
          else setImprovementOpen(true);
        }}
      >
        <DialogContent className="grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border-white/10 bg-background/95 sm:max-w-xl">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_28px_rgba(125,92,255,.35)]">
              <MessageSquare size={22} />
            </div>
            <DialogTitle>Weekly improvement note</DialogTitle>
            <DialogDescription>
              {latestImprovement?.week_start
                ? `Your HR review for the week of ${formatNepaliDate(latestImprovement.week_start, "DD MMM YYYY")} BS`
                : "Your latest HR weekly review"}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Improvement section
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/90">
              {latestImprovement?.improvements}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={dismissImprovement} className="neon-button rounded-xl">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-muted-foreground">
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
                <MiniMetric label="Check In" value={today?.check_in_time ? format(new Date(today.check_in_time), "HH:mm") : "--"} />
                <MiniMetric label="Check Out" value={today?.check_out_time ? format(new Date(today.check_out_time), "HH:mm") : "--"} />
                <MiniMetric label="Working Hours" value={workedHours ? formatWorkHours(workedHours) : "--"} />
                <MiniMetric label="Attendance Streak" value={`${attendanceStreak} days`} />
              </div>
            </div>
            <div className="employee-week-progress">
              <div>
                <span>Weekly Attendance Progress</span>
                <strong>{weeklyProgress}/{WEEKLY_WORKING_DAYS} days</strong>
              </div>
              <div className="employee-progress-track">
                <div style={{ width: `${Math.min(100, (weeklyProgress / WEEKLY_WORKING_DAYS) * 100)}%` }} />
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
              <Link to="/tasks" className="employee-pill-link">Open Tasks</Link>
            </div>
            <div className="employee-task-list">
              {focusTasks.length ? (
                focusTasks.map((task) => <TaskFocusCard key={task.id} task={task} nowTick={nowTick} />)
              ) : (
                <EmptyPanel icon={CheckCircle2} title="No urgent tasks" text="Your active work queue is clear." />
              )}
            </div>
          </article>

          <article className="employee-panel">
            <div className="employee-panel-heading compact">
              <div>
                <span>Schedule</span>
                <h2>Today's Meetings</h2>
              </div>
              <Link to="/meetings" className="employee-pill-link">All Meetings</Link>
            </div>
            <div className="employee-meeting-list">
              {todayMeetings.length ? (
                todayMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)
              ) : (
                <EmptyPanel icon={CalendarClock} title="No meetings scheduled today" text="Your calendar is clear for focused work." />
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
                <HeatmapSummaryPill label="Present" value={heatmapSummary.present} tone="present" />
                <HeatmapSummaryPill label="Late" value={heatmapSummary.late} tone="late" />
                <HeatmapSummaryPill label="Absent" value={heatmapSummary.absent} tone="absent" />
                <HeatmapSummaryPill label="Holiday" value={heatmapSummary.holiday} tone="holiday" />
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
                recent.map((item, index) => <TimelineItem key={`${item.kind}-${item.when}-${index}`} item={item} />)
              ) : (
                <EmptyPanel icon={Activity} title="No recent activity" text="Task, attendance, and standup events will appear here." />
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
            <InsightItem icon={TrendingUp} text={`Productivity score is ${taskStats.score}% this month`} />
            <InsightItem icon={Target} text={taskStats.overdue ? `${taskStats.overdue} task requires immediate attention` : "No overdue tasks right now"} />
            <InsightItem icon={Calendar} text={pendingLeaveRequests ? `${pendingLeaveRequests} leave day this month` : "No pending leave requests"} />
          </div>
        </section>
      </main>
    </>
  );
}

function NotificationPopup({
  notification,
  meetings,
  blocked,
  onClose,
  onRead,
}: {
  notification: NotificationRow | null;
  meetings: any[];
  blocked: boolean;
  onClose: () => void;
  onRead: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const meeting = useMemo(() => getNotificationMeeting(notification, meetings), [notification, meetings]);
  const meetingTime = meeting?.meeting_time ? new Date(meeting.meeting_time) : new Date(notification?.created_at ?? Date.now());
  const isRescheduled = Boolean(
    notification && /reschedul|postpon|updated|changed|now on/i.test(`${notification.title} ${notification.message}`),
  );
  const countdown = getMeetingPopupCountdown(meetingTime, nowMs);
  const fallbackTitle = notification?.title.replace(/^(new\s+)?meeting\s+(scheduled|postponed|updated|rescheduled):?\s*/i, "");
  const meetingName = meeting?.title || fallbackTitle || "Weekly Review & Team Status Meeting";
  const location = meeting?.location || parseNotificationLocation(notification?.message) || "Office Meeting Room";

  useEffect(() => {
    if (!notification || blocked) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [blocked, notification]);

  return (
    <Dialog open={Boolean(notification) && !blocked} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden rounded-[28px] border-0 bg-transparent p-0 shadow-[0_30px_100px_rgba(0,0,0,.55)] duration-300 data-[state=open]:slide-in-from-bottom-4 sm:max-w-2xl">
        {notification && (
          <div className="relative rounded-[28px] bg-gradient-to-br from-[#ff3b7f] via-[#7b61ff] to-[#4f9cff] p-[1px] shadow-[0_0_42px_rgba(123,97,255,.34)]">
            <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#ff3b7f]/30 via-[#7b61ff]/25 to-[#4f9cff]/30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[27px] border border-white/10 bg-[#080a14]/90 p-5 text-white backdrop-blur-2xl sm:p-7">
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#4f9cff]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -left-20 h-56 w-56 rounded-full bg-[#ff3b7f]/15 blur-3xl" />

              <DialogHeader className="relative items-center text-center">
                <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
                  <span className="h-2 w-2 rounded-full bg-[#4f9cff] shadow-[0_0_14px_rgba(79,156,255,.95)]" />
                  {isRescheduled ? "Meeting Rescheduled" : "Upcoming Meeting"}
                </div>

                <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#ff3b7f] via-[#7b61ff] to-[#4f9cff] shadow-[0_0_46px_rgba(123,97,255,.48)] sm:h-28 sm:w-28">
                  <div className="absolute inset-0 animate-ping rounded-full bg-[#7b61ff]/20" />
                  <div className="relative flex h-[82%] w-[82%] items-center justify-center rounded-full border border-white/20 bg-black/20 backdrop-blur-md">
                    <CalendarClock className="h-11 w-11 animate-pulse text-white sm:h-12 sm:w-12" strokeWidth={1.7} />
                  </div>
                </div>

                <DialogTitle className="max-w-xl text-2xl font-black leading-tight text-white sm:text-4xl">
                  {isRescheduled ? "Your meeting schedule changed" : "You have an upcoming meeting"}
                </DialogTitle>
                <DialogDescription className="mt-3 max-w-xl text-base font-semibold leading-7 text-white/85 sm:text-lg">
                  {meetingName}
                </DialogDescription>
              </DialogHeader>

              <div className="relative mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] sm:grid-cols-2 sm:p-5">
                <MeetingPopupDetail icon={Calendar} label="Date" value={`${format(meetingTime, "EEEE")}, ${formatNepaliDate(meetingTime, "DD MMMM YYYY")} BS`} />
                <MeetingPopupDetail icon={Clock} label="Time" value={format(meetingTime, "h:mm a")} />
                <MeetingPopupDetail icon={MapPin} label="Location" value={location} />
                <MeetingPopupDetail icon={Users} label="Attendees" value="All Team Members" />
              </div>

              <div className="relative mt-4 rounded-2xl border border-[#7b61ff]/30 bg-white/[0.065] p-4 text-center shadow-[0_0_28px_rgba(123,97,255,.16),inset_0_1px_0_rgba(255,255,255,.08)]">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Starts In</div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <CountdownUnit value={countdown.days} label="Days" />
                  <CountdownUnit value={countdown.hours} label="Hours" />
                  <CountdownUnit value={countdown.minutes} label="Minutes" />
                </div>
              </div>

              <p className="relative mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/72">
                The meeting schedule has been updated. Please be prepared with your weekly progress updates and
                discussion points.
              </p>

              <DialogFooter className="relative mt-5 flex-col gap-3 sm:flex-row sm:space-x-0">
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-white/15 bg-white/[0.045] text-white hover:border-white/30 hover:bg-white/[0.09] focus-visible:ring-[#7b61ff]"
                  onClick={onClose}
                >
                  Remind Me Later
                </Button>
                <Button
                  asChild
                  className="h-12 rounded-xl border-0 bg-[linear-gradient(135deg,#ff3b7f,#7b61ff,#4f9cff)] px-6 font-bold text-white shadow-[0_0_24px_rgba(123,97,255,.36)] transition-shadow hover:shadow-[0_0_34px_rgba(79,156,255,.55)] focus-visible:ring-[#4f9cff]"
                >
                  <Link to="/meetings" onClick={onRead}>
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
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-[#8fbaff]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</div>
        <div className="mt-1 truncate text-sm font-semibold text-white sm:text-base">{value}</div>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-3">
      <div className="font-mono text-2xl font-black leading-none text-white sm:text-3xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</div>
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
    <div className="employee-work-ring" style={{ ["--work-progress" as string]: `${progress * 3.6}deg` }}>
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
  const priority = countdown.state === "overdue" ? "High" : countdown.state === "soon" ? "Medium" : "Normal";

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
        <p>{format(start, "h:mm a")} · 30 min · {meeting.location || "Online"}</p>
      </div>
      {meeting.meeting_link ? (
        <a href={meeting.meeting_link} target="_blank" rel="noreferrer" className="employee-secondary-button">
          Join Meeting
          <Video size={14} />
        </a>
      ) : (
        <span className="employee-muted-pill">No link</span>
      )}
    </article>
  );
}

function EmptyPanel({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
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
        <small>{item.kind} · {formatNepaliDate(item.when, "DD MMM")} BS, {format(new Date(item.when), "HH:mm")}</small>
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
  return Math.max(0, Math.round(((end - new Date(today.check_in_time).getTime()) / 3600000) * 100) / 100);
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
  const dates = new Set(rows.filter((row) => ["present", "late", "wfh"].includes(row.status)).map((row) => row.date));
  if (today && ["present", "late", "wfh"].includes(today.status)) dates.add(today.date);
  let count = 0;
  for (let index = 0; index < WEEKLY_WORKING_DAYS; index += 1) {
    if (dates.has(format(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index), "yyyy-MM-dd"))) {
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
      return { date, status: "holiday", checkIn: row?.check_in_time, checkOut: row?.check_out_time };
    }
    if (!row) return { date, status: "none" };
    if (row.status === "absent") return { date, status: "absent", checkIn: row.check_in_time, checkOut: row.check_out_time };
    if (row.is_late || row.status === "late") return { date, status: "late", checkIn: row.check_in_time, checkOut: row.check_out_time };
    if (["present", "wfh"].includes(row.status)) return { date, status: "present", checkIn: row.check_in_time, checkOut: row.check_out_time };
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
    }) ?? null
  );
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
