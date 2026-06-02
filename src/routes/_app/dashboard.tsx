import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
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
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Calendar,
  CalendarClock,
  TrendingUp,
  LogIn,
  LogOut,
  ListTodo,
  Activity,
  Zap,
  AlertCircle,
  Crown,
  Sparkles,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { productivityScore } from "@/lib/tasks-utils";
import { formatWorkHours } from "@/lib/work-hours";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";

export const Route = createFileRoute("/_app/dashboard")({ component: EmployeeDashboard });

function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [monthStats, setMonthStats] = useState({ present: 0, late: 0, leave: 0, hours: 0 });
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    score: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [deadlineTasks, setDeadlineTasks] = useState<any[]>([]);
  const [monthAward, setMonthAward] = useState<any>(null);
  const [latestImprovement, setLatestImprovement] = useState<any>(null);
  const [improvementOpen, setImprovementOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);

  const load = async () => {
    if (!user) return;
    const { data: t } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayDate)
      .maybeSingle();
    setToday(t);
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
    const [{ data: m }, awardResult, improvementResult] = await Promise.all([
      supabase.from("attendance").select("*").eq("user_id", user.id).gte("date", monthStart),
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
    setMonthAward(awardResult.error ? null : awardResult.data);
    const improvement = improvementResult.error ? null : improvementResult.data;
    setLatestImprovement(improvement);
    if (improvement?.id && !isImprovementDismissed(user.id, improvement.id)) {
      setImprovementOpen(true);
    }
    setMonthStats({
      present:
        m?.filter((x) => x.status === "present" || x.status === "late" || x.status === "wfh")
          .length ?? 0,
      late: m?.filter((x) => x.is_late).length ?? 0,
      leave: m?.filter((x) => x.status === "leave").length ?? 0,
      hours: Math.round((m?.reduce((a, x) => a + Number(x.work_hours || 0), 0) ?? 0) * 10) / 10,
    });

    // Tasks + productivity
    const { data: tasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", user.id)
      .order("deadline", { ascending: true, nullsFirst: false });
    const total = tasks?.length || 0;
    const completed = tasks?.filter((t) => t.status === "completed").length || 0;
    const active =
      tasks?.filter((t) => t.status === "in_progress" || t.status === "review").length || 0;
    const now = Date.now();
    const overdue =
      tasks?.filter(
        (t) => t.deadline && new Date(t.deadline).getTime() < now && t.status !== "completed",
      ).length || 0;
    const onTime =
      tasks?.filter(
        (t) =>
          t.status === "completed" &&
          (!t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline)),
      ).length || 0;
    const score = productivityScore({
      completed,
      total,
      onTimeRate: completed ? onTime / completed : 0,
      hours: monthStats.hours,
      targetHours: 160,
    });
    setTaskStats({ total, completed, active, overdue, score });
    setDeadlineTasks(
      (tasks || [])
        .filter((t) => t.status !== "completed")
        .sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        })
        .slice(0, 6),
    );

    // Recent activity = recent task updates + own standups
    const [{ data: rt }, { data: rs }] = await Promise.all([
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
      ...(rt || []).map((t: any) => ({
        kind: "Task",
        when: t.updated_at,
        text: `${t.title} → ${t.status}`,
      })),
      ...(rs || []).map((s: any) => ({
        kind: "Standup",
        when: s.updated_at,
        text: `Logged standup for ${s.date}`,
      })),
    ]
      .sort((a, b) => +new Date(b.when) - +new Date(a.when))
      .slice(0, 6);
    setRecent(items);
  };
  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const checkIn = async () => {
    if (!user) return;
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
    toast.success(isLate ? "Checked in (late)" : "Checked in");
  };

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
    toast.success(`Checked out — ${formatWorkHours(hours)} worked`);
  };

  const status = isWeeklyOff
    ? WEEKLY_OFF_LABEL
    : !today
      ? "Not checked in"
      : today.check_out_time
        ? "Day completed"
        : "Working";
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  const dismissImprovement = () => {
    if (user && latestImprovement?.id) {
      markImprovementDismissed(user.id, latestImprovement.id);
    }
    setImprovementOpen(false);
  };

  return (
    <>
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
                ? `Your HR review for the week of ${format(new Date(latestImprovement.week_start), "MMM d, yyyy")}`
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

      <PageHeader
        title={`Hello, ${firstName}`}
        subtitle="Your attendance, delivery focus, and productivity snapshot"
        actions={
          <>
            <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {format(new Date(), "EEE, MMM d")}
            </div>
            <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              {status}
            </div>
          </>
        }
      />

      {monthAward && (
        <GlassCard className="mb-6 overflow-hidden border-amber-200/20 bg-white/[0.035]">
          <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-200">
                <Crown size={28} />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-200">
                  <Sparkles size={14} />
                  Employee of the Month
                </div>
                <h2 className="text-2xl font-bold">Congratulations, {firstName}!</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {monthAward.public_message ||
                    `You earned the official ASLENIX monthly badge with a ${monthAward.score}/100 score.`}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
              <div className="text-3xl font-bold gradient-text tabular-nums">{monthAward.score}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Award score</div>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <GlassCard className="relative overflow-hidden border-white/10 bg-white/[0.025] p-0">
          <div className="relative z-10 grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:p-7">
            <div>
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck size={15} className="text-primary" />
                Daily operations
              </div>
              <LiveClock className="mb-7" />
              <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                <TodayMetric
                  label="Check-in"
                  value={today?.check_in_time ? format(new Date(today.check_in_time), "HH:mm") : "—"}
                />
                <TodayMetric
                  label="Check-out"
                  value={today?.check_out_time ? format(new Date(today.check_out_time), "HH:mm") : "—"}
                />
                <TodayMetric
                  label="Hours"
                  value={today?.work_hours ? formatWorkHours(today.work_hours) : "—"}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="mt-2 text-2xl font-bold text-white">{status}</div>
                </div>
                <StatusDot status={status} />
              </div>
              {isWeeklyOff ? (
                <div className="rounded-xl border border-accent/20 bg-accent/10 p-3 text-sm leading-6 text-accent">
                  Saturday is weekly off for everyone. No attendance is required today.
                </div>
              ) : !today ? (
                <Button
                  onClick={checkIn}
                  disabled={busy}
                  className="neon-button h-12 w-full rounded-xl text-base"
                >
                  <LogIn size={17} className="mr-2" />
                  Check in
                </Button>
              ) : !today.check_out_time ? (
                <Button
                  onClick={checkOut}
                  disabled={busy}
                  variant="outline"
                  className="h-12 w-full rounded-xl text-base"
                >
                  <LogOut size={17} className="mr-2" />
                  Check out
                </Button>
              ) : (
                <div className="rounded-xl border border-success/20 bg-success/10 p-3 text-sm font-medium text-success">
                  Worked {formatWorkHours(today.work_hours)} today
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-white/[0.025]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Quick actions</h3>
              <p className="text-xs text-muted-foreground">Common employee workflows</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-primary">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="grid gap-2">
            <QuickActionLink to="/tasks" icon={ListTodo} label="My tasks" />
            <QuickActionLink to="/standup" icon={Activity} label="Daily standup" />
            <QuickActionLink to="/my-leaves" icon={Calendar} label="Request leave" />
            <QuickActionLink to="/profile" icon={CheckCircle2} label="Update profile" />
          </div>
        </GlassCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetric label="Present this month" value={monthStats.present} icon={CheckCircle2} tone="green" />
        <ExecutiveMetric label="Late arrivals" value={monthStats.late} icon={Clock} tone="amber" />
        <ExecutiveMetric label="Leave days" value={monthStats.leave} icon={CalendarClock} tone="blue" />
        <ExecutiveMetric label="Hours worked" value={formatWorkHours(monthStats.hours)} icon={TrendingUp} tone="red" />
      </div>

      <GlassCard className="mb-6 border-white/10 bg-white/[0.025]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Clock size={16} className="text-primary" />
              Task deadlines
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Countdown for active tasks assigned to you
            </p>
          </div>
          <Link to="/tasks" className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15">
            Open tasks
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deadlineTasks.map((task) => {
            const countdown = getTaskCountdown(task.deadline, nowTick);
            const isOverdue = countdown.state === "overdue";
            const isDueSoon = countdown.state === "soon";

            return (
              <Link
                key={task.id}
                to="/tasks"
                className="group rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-primary/30 hover:bg-white/[0.045]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{task.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {task.deadline ? format(new Date(task.deadline), "MMM d, h:mm a") : "No deadline"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                      isOverdue
                        ? "bg-destructive/15 text-destructive"
                        : isDueSoon
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-primary/15 text-primary"
                    }`}
                  >
                    {countdown.label}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="capitalize">{task.status.replaceAll("_", " ")}</span>
                    <span>{task.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${task.progress}%`, background: "var(--gradient-brand)" }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
          {deadlineTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
              <AlertCircle size={18} className="mx-auto mb-2 text-primary" />
              No active task deadlines right now.
            </div>
          )}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="border-white/10 bg-white/[0.025]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <Zap size={16} className="text-primary" /> Productivity score
            </h3>
            <span
              className="text-3xl font-bold tabular-nums"
              style={{
                background: "var(--gradient-brand)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {taskStats.score}
            </span>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${taskStats.score}%`, background: "var(--gradient-brand)" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <ScoreTile label="Total" value={taskStats.total} />
            <ScoreTile label="Completed" value={taskStats.completed} />
            <ScoreTile label="Active" value={taskStats.active} />
            <ScoreTile label="Overdue" value={taskStats.overdue} danger />
          </div>
        </GlassCard>

        <GlassCard className="border-white/10 bg-white/[0.025] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Recent activity</h3>
              <p className="text-xs text-muted-foreground">Latest task and standup updates</p>
            </div>
            <Link to="/tasks" className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-white/[0.06]">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-white/10">
            {recent.map((r, i) => (
              <li key={i} className="flex items-start gap-3 py-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--gradient-brand-soft)" }}
                >
                  <Activity size={12} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{r.kind}</div>
                  <div className="truncate text-sm font-medium text-white">{r.text}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.when), "MMM d HH:mm")}
                </div>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No activity yet — create your first task.
              </li>
            )}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

function TodayMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone =
    status === "Working"
      ? "bg-success shadow-[0_0_24px_rgba(34,197,94,.35)]"
      : status === "Day completed"
        ? "bg-primary shadow-[0_0_24px_rgba(255,45,111,.3)]"
        : "bg-muted-foreground";

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
      <span className={`h-3 w-3 rounded-full ${tone}`} />
    </div>
  );
}

function QuickActionLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/tasks" | "/standup" | "/my-leaves" | "/profile";
  icon: typeof ListTodo;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white transition hover:border-primary/30 hover:bg-white/[0.05]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground transition group-hover:text-primary">
          <Icon size={16} />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <ArrowUpRight size={15} className="shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function ExecutiveMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Clock;
  tone: "green" | "amber" | "blue" | "red";
}) {
  const colors = {
    green: "text-success bg-success/10 border-success/20",
    amber: "text-warning bg-warning/10 border-warning/20",
    blue: "text-blue-300 bg-blue-500/10 border-blue-400/20",
    red: "text-primary bg-primary/10 border-primary/20",
  };

  return (
    <GlassCard className="border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 truncate text-3xl font-bold tabular-nums text-white">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function ScoreTile({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${danger ? "text-destructive" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function isBeforeOfficeEnd(now: Date, officeEndTime?: string | null) {
  const [hour, minute] = (officeEndTime || "18:00:00").split(":").map(Number);
  const boundary = new Date(now);
  boundary.setHours(hour || 18, minute || 0, 0, 0);
  return now < boundary;
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
