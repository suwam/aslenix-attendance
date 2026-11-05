import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import {
  getVerifiedAttendanceLocation,
  preloadAttendanceLocationSettings,
} from "@/lib/attendance-location";
import { formatWorkHours } from "@/lib/work-hours";
import {
  CalendarCheck2,
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  Loader2,
  MapPin,
  ShieldCheck,
  TimerReset,
  ShieldX,
  ShieldAlert,
  Lock,
  FileText,
  AlertTriangle,
  Fingerprint,
  Timer,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";
import { useAppResume } from "@/lib/use-app-resume";
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

export const Route = createFileRoute("/_app/check-in")({ component: CheckInPage });

type AttendanceRow = {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  work_hours: number | null;
  is_late: boolean;
  is_early_checkout: boolean;
  shift_id?: string | null;
  shift_name_snapshot?: string | null;
  scheduled_check_in?: string | null;
  scheduled_check_out?: string | null;
  late_minutes?: number | null;
  early_checkout_minutes?: number | null;
  total_working_minutes?: number | null;
  overtime_minutes?: number | null;
};

function CheckInPage() {
  const { user, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [today, setToday] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [assignedShift, setAssignedShift] = useState<Shift>(DEFAULT_MORNING_SHIFT);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);

  // Attendance closes at 2:00 PM Nepal time.
  const [isPastCutoff, setIsPastCutoff] = useState(() => isAttendanceCutoffPassed());
  const [showProhibitedDialog, setShowProhibitedDialog] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    const updateTime = () => setIsPastCutoff(isAttendanceCutoffPassed());
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Automatically pop up the prohibited/lockout modal when viewing after 2:00 PM without check-in
  useEffect(() => {
    if (!loading && !today && !isWeeklyOff && isPastCutoff && !isAdmin && !hasAutoOpened) {
      setShowProhibitedDialog(true);
      setHasAutoOpened(true);
    }
  }, [loading, today, isWeeklyOff, isPastCutoff, isAdmin, hasAutoOpened]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const historyStart = format(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const [
      { data: todayRow, error: todayError },
      { data: historyRows, error: historyError },
      shift,
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
        .gte("date", historyStart)
        .lte("date", todayDate)
        .order("date", { ascending: false }),
      fetchEmployeeAssignedShift(user.id, todayDate),
    ]);

    if (todayError) toast.error(todayError.message);
    if (historyError) toast.error(historyError.message);
    setToday((todayRow as AttendanceRow | null) ?? null);
    setHistory((historyRows ?? []) as AttendanceRow[]);
    setAssignedShift(shift);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  // Auto-reload check-in state when device resumes or app is opened
  useAppResume(load, { pollIntervalMs: 20000 });

  const checkIn = async () => {
    if (!user) return;
    if (isWeeklyOff) return toast.info("Saturday is a weekly off. Attendance is not required.");

    if (!isAdmin && isAttendanceCutoffPassed()) {
      setShowProhibitedDialog(true);
      return toast.error("Attendance after 2:00 PM is prohibited. Check-in is closed for today.");
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
    // Evaluate check-in against the employee's individually assigned shift
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
        is_late: evalResult.isLate,
        shift_id: assignedShift.id,
        shift_name_snapshot: assignedShift.name,
        scheduled_check_in: assignedShift.start_time,
        scheduled_check_out: assignedShift.end_time,
        late_minutes: evalResult.lateMinutes,
      })
      .select()
      .maybeSingle();

    setBusy(false);
    if (error || !insertedToday) return toast.error(error?.message ?? "Unable to check in");
    setToday(insertedToday as AttendanceRow);
    await load();
    if (evalResult.isLate) {
      toast.warning(`Checked in (${evalResult.lateMinutes}m late for ${assignedShift.name})\nWhatsApp notification: Queued`);
    } else {
      toast.success(`Checked in on time for ${assignedShift.name}!\nWhatsApp notification: Queued`);
    }
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
    // Evaluate check-out against the employee's individually assigned shift
    const evalResult = evaluateCheckOut(today.check_in_time, now, todayDate, assignedShift);

    const { data: updatedToday, error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_accuracy_meters: location.accuracy,
        is_early_checkout: evalResult.isEarlyCheckout,
        early_checkout_minutes: evalResult.earlyCheckoutMinutes,
        work_hours: evalResult.workHours,
        total_working_minutes: evalResult.totalWorkingMinutes,
        overtime_minutes: evalResult.overtimeMinutes,
      })
      .eq("id", today.id)
      .select()
      .maybeSingle();

    setBusy(false);
    if (error || !updatedToday) return toast.error(error?.message ?? "Unable to check out");
    setToday(updatedToday as AttendanceRow);
    await load();
    if (evalResult.isEarlyCheckout) {
      toast.warning(`Checked out early (${evalResult.earlyCheckoutMinutes}m before scheduled ${formatTime12Hour(assignedShift.end_time)})\nWhatsApp notification: Queued`);
    } else if (evalResult.overtimeMinutes > 0) {
      toast.success(`Checked out (${evalResult.overtimeMinutes}m overtime) · ${formatWorkHours(evalResult.workHours)} worked\nWhatsApp notification: Queued`);
    } else {
      toast.success(`Checked out · ${formatWorkHours(evalResult.workHours)} worked\nWhatsApp notification: Queued`);
    }
  };

  const lastSevenDays = buildLastSevenDays(history);
  const checkedInDays = lastSevenDays.filter((day) => day.attendance?.check_in_time).length;
  const completedDays = lastSevenDays.filter((day) => day.attendance?.check_out_time).length;
  const totalHours = lastSevenDays.reduce(
    (sum, day) => sum + Number(day.attendance?.work_hours ?? 0),
    0,
  );

  if (loading && !today) {
    return (
      <>
        <PageHeader title="Check-in" subtitle="Daily attendance" />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Check-in" subtitle="Daily attendance" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,.95fr)]">
        <div className="space-y-6">
          <GlassCard glow="red" className="overflow-hidden p-0">
            <div className="relative p-6 sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_10%,rgba(255,45,111,.16),transparent_30%),radial-gradient(circle_at_78%_15%,rgba(33,212,253,.12),transparent_30%)]" />
              <div className="relative">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin size={15} className="text-primary" />
                      Office location verified on action
                    </div>
                    <LiveClock />
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Today
                    </div>
                    <div className="mt-1 font-semibold text-foreground">
                      {formatNepaliDate(new Date(), "ddd DD, MMMM YYYY")} BS
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : isWeeklyOff ? (
                  <div className="mx-auto max-w-md py-8 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
                      <CalendarDays size={24} />
                    </div>
                    <div className="mt-4 text-2xl font-bold text-accent">{WEEKLY_OFF_LABEL}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Saturday is weekly off for everyone. No attendance is required today.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Shift & Schedule Header Pill */}
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 backdrop-blur-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <Timer size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Shift</span>
                              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {assignedShift.id}
                              </span>
                            </div>
                            <div className="text-base font-bold text-foreground">{assignedShift.name}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-xl border border-border bg-card/60 px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reporting</div>
                            <div className="font-semibold text-foreground">{formatTime12Hour(assignedShift.start_time)}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-card/60 px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closing</div>
                            <div className="font-semibold text-foreground">{formatTime12Hour(assignedShift.end_time)}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-card/60 px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grace</div>
                            <div className="font-semibold text-foreground">{assignedShift.grace_period_mins}m</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Attendance Timeline */}
                    <div className="rounded-2xl border border-border/80 bg-card/50 p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between text-xs">
                        <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                          Attendance Timeline
                        </span>
                        <span className="text-muted-foreground">
                          Target: {getShiftExpectedHours(assignedShift)}h duration
                        </span>
                      </div>

                      <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {/* Timeline Step 1: Scheduled In */}
                        <div className="relative flex flex-col items-center rounded-xl border border-border/60 bg-card/80 p-3 text-center">
                          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock3 size={15} />
                          </div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scheduled In</div>
                          <div className="mt-0.5 text-sm font-bold text-foreground">{formatTime12Hour(assignedShift.start_time)}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">Reporting time</div>
                        </div>

                        {/* Timeline Step 2: Actual In */}
                        <div className={`relative flex flex-col items-center rounded-xl border p-3 text-center ${
                          !today?.check_in_time
                            ? "border-border/60 bg-card/40 opacity-70"
                            : today.is_late
                              ? "border-warning/40 bg-warning/10"
                              : "border-success/40 bg-success/10"
                        }`}>
                          <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                            !today?.check_in_time
                              ? "bg-muted text-muted-foreground"
                              : today.is_late
                                ? "bg-warning/20 text-warning"
                                : "bg-success/20 text-success"
                          }`}>
                            <LogIn size={15} />
                          </div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Actual In</div>
                          <div className="mt-0.5 text-sm font-bold text-foreground">
                            {today?.check_in_time ? format(new Date(today.check_in_time), "hh:mm a") : "—"}
                          </div>
                          <div className="mt-1 text-[11px]">
                            {!today?.check_in_time ? (
                              <span className="text-muted-foreground">Pending</span>
                            ) : today.is_late ? (
                              <span className="font-semibold text-warning">+{today.late_minutes ?? "Late"}m Late</span>
                            ) : (
                              <span className="font-semibold text-success">On Time</span>
                            )}
                          </div>
                        </div>

                        {/* Timeline Step 3: Scheduled Out */}
                        <div className="relative flex flex-col items-center rounded-xl border border-border/60 bg-card/80 p-3 text-center">
                          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Clock3 size={15} />
                          </div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Scheduled Out</div>
                          <div className="mt-0.5 text-sm font-bold text-foreground">{formatTime12Hour(assignedShift.end_time)}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">Office closing</div>
                        </div>

                        {/* Timeline Step 4: Actual Out */}
                        <div className={`relative flex flex-col items-center rounded-xl border p-3 text-center ${
                          !today?.check_out_time
                            ? "border-border/60 bg-card/40 opacity-70"
                            : today.is_early_checkout
                              ? "border-warning/40 bg-warning/10"
                              : "border-success/40 bg-success/10"
                        }`}>
                          <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                            !today?.check_out_time
                              ? "bg-muted text-muted-foreground"
                              : today.is_early_checkout
                                ? "bg-warning/20 text-warning"
                                : "bg-success/20 text-success"
                          }`}>
                            <LogOut size={15} />
                          </div>
                          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Actual Out</div>
                          <div className="mt-0.5 text-sm font-bold text-foreground">
                            {today?.check_out_time ? format(new Date(today.check_out_time), "hh:mm a") : "—"}
                          </div>
                          <div className="mt-1 text-[11px]">
                            {!today?.check_out_time ? (
                              <span className="text-muted-foreground">Pending</span>
                            ) : today.is_early_checkout ? (
                              <span className="font-semibold text-warning">-{today.early_checkout_minutes ?? "Early"}m Early</span>
                            ) : (
                              <span className="font-semibold text-success">Completed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    {!today ? (
                      isPastCutoff && !isAdmin ? (
                        <div className="space-y-5 py-4 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/15 text-destructive shadow-[0_0_34px_rgba(239,68,68,.3)]">
                            <ShieldAlert size={30} />
                          </div>
                          <div>
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-destructive mb-2">
                              <Lock size={12} /> Cutoff 02:00 PM · Attendance Prohibited
                            </div>
                            <div className="text-2xl font-bold text-foreground">Attendance Closed</div>
                            <div className="mt-1.5 max-w-md mx-auto text-sm text-muted-foreground leading-relaxed">
                              Daily attendance check-in after <span className="font-semibold text-foreground">02:00 PM</span> is strictly prohibited by company policy. New check-ins are not permitted for today.
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Button
                              variant="destructive"
                              onClick={async () => {
                                await signOut();
                                nav({ to: "/login" });
                              }}
                              className="h-11 rounded-xl px-6 text-sm font-semibold gap-1.5 shadow-md shadow-destructive/20"
                            >
                              <LogOut size={16} /> Log out
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowProhibitedDialog(true)}
                              className="h-11 rounded-xl px-5 text-sm font-semibold border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <ShieldAlert size={16} className="mr-1.5 text-destructive" /> View Policy Notice
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => nav({ to: "/my-attendance" })}
                              className="h-11 rounded-xl px-4 text-sm text-muted-foreground hover:text-foreground"
                            >
                              <FileText size={16} className="mr-1.5" /> Request Correction
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-5 py-4 text-center">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-foreground shadow-[0_0_34px_rgba(125,92,255,.38)]">
                            <LogIn size={28} />
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-foreground">Ready to start?</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              Mark your attendance for <span className="font-semibold text-foreground">{assignedShift.name}</span> (Reporting: {formatTime12Hour(assignedShift.start_time)}).
                            </div>
                          </div>
                          <Button
                            onClick={checkIn}
                            disabled={busy}
                            className="neon-button h-12 rounded-xl px-8 text-base"
                          >
                            {busy ? (
                              <Loader2 size={18} className="mr-2 animate-spin" />
                            ) : (
                              <LogIn size={18} className="mr-2" />
                            )}
                            Check in now
                          </Button>
                        </div>
                      )
                    ) : !today.check_out_time ? (
                      <div className="space-y-6 py-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-[0_0_34px_rgba(34,197,94,.18)]">
                          <ShieldCheck size={28} />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-foreground">You are checked in</div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            Started at{" "}
                            <span className="font-semibold text-foreground">
                              {formatTime(today.check_in_time)}
                            </span>
                            {today.is_late && (
                              <span className="ml-2 font-semibold text-warning">
                                ({today.late_minutes ?? "Late"}m late for {assignedShift.name})
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={checkOut}
                          disabled={busy}
                          variant="outline"
                          className="h-12 rounded-xl px-8 text-base"
                        >
                          {busy ? (
                            <Loader2 size={18} className="mr-2 animate-spin" />
                          ) : (
                            <LogOut size={18} className="mr-2" />
                          )}
                          Check out
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-5 py-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-[0_0_34px_rgba(34,197,94,.18)]">
                          <CalendarCheck2 size={28} />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-success">Day completed</div>
                          <div className="mt-2 text-sm text-muted-foreground">
                            {formatTime(today.check_in_time)} to {formatTime(today.check_out_time)} ·{" "}
                            <span className="font-semibold text-foreground">{formatWorkHours(today.work_hours)}</span>
                          </div>
                          {today.is_early_checkout && (
                            <div className="mt-1 text-xs text-warning">
                              Early checkout: {today.early_checkout_minutes ?? "Early"} mins before scheduled {formatTime12Hour(assignedShift.end_time)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CheckInMetric label="Checked in" value={`${checkedInDays}/7`} icon={CalendarCheck2} />
            <CheckInMetric label="Completed" value={`${completedDays}/7`} icon={LogOut} />
            <CheckInMetric label="Hours" value={formatWorkHours(totalHours)} icon={Clock3} />
          </section>
        </div>

        <GlassCard className="h-fit">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">Past 7 days</h2>
              <p className="text-sm text-muted-foreground">Check-in, checkout, and worked hours</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-primary">
              <TimerReset size={20} />
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {lastSevenDays.map((day) => (
                <AttendanceHistoryRow key={day.date} day={day} />
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Pop-up dialog notifying employees that attendance after 2:00 PM is prohibited */}
      <Dialog open={showProhibitedDialog} onOpenChange={setShowProhibitedDialog}>
        <DialogContent className="max-w-md border-destructive/30 bg-background/95 backdrop-blur-xl sm:rounded-2xl">
          <DialogHeader className="text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/15 text-destructive shadow-[0_0_24px_rgba(239,68,68,0.25)]">
                <ShieldAlert size={26} />
              </div>
              <div>
                <span className="inline-block rounded-full bg-destructive/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-destructive border border-destructive/25 mb-1">
                  Access Prohibited
                </span>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  Attendance Closed After 2:00 PM
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Daily office attendance check-in after <span className="font-bold text-foreground">02:00 PM (14:00)</span> is strictly prohibited by company policy. The check-in window for today has closed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4 text-xs text-muted-foreground">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="font-medium text-foreground">Official Cutoff Time</span>
              <span className="font-bold text-destructive">02:00 PM (14:00)</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="font-medium text-foreground">Today's Check-in Status</span>
              <span className="font-bold text-destructive">Prohibited / Closed</span>
            </div>
            <div className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
              If you worked today or had an unavoidable delay, please submit an <span className="font-semibold text-foreground">Attendance Correction</span> request for Admin/HR review and approval.
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={async () => {
                await signOut();
                nav({ to: "/login" });
              }}
              className="w-full sm:w-auto font-semibold gap-1.5 shadow-md shadow-destructive/20"
            >
              <LogOut size={15} /> Log out
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowProhibitedDialog(false);
                nav({ to: "/my-attendance" });
              }}
              className="w-full sm:w-auto gap-1.5"
            >
              <FileText size={15} /> Request Correction
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowProhibitedDialog(false)}
              className="w-full sm:w-auto"
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CheckInMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CalendarCheck2;
}) {
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-foreground shadow-[0_0_22px_rgba(125,92,255,.3)]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-xl font-bold text-foreground">{value}</div>
      </div>
    </GlassCard>
  );
}

function AttendanceHistoryRow({ day }: { day: ReturnType<typeof buildLastSevenDays>[number] }) {
  const attendance = day.attendance;
  const status = getDayStatus(day);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 transition hover:bg-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${status.iconClass}`}
          >
            <status.icon size={18} />
          </div>
          <div>
            <div className="font-semibold text-foreground">{day.label}</div>
            <div className="text-xs text-muted-foreground">
              {formatNepaliDate(day.date, "DD MMMM YYYY")} BS
            </div>
          </div>
        </div>
        <span
          className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.pillClass}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <HistoryTime label="In" value={formatTime(attendance?.check_in_time)} />
        <HistoryTime label="Out" value={formatTime(attendance?.check_out_time)} />
        <HistoryTime
          label="Hours"
          value={attendance?.work_hours ? formatWorkHours(attendance.work_hours) : "—"}
        />
      </div>
    </div>
  );
}

function HistoryTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function buildLastSevenDays(history: AttendanceRow[]) {
  const byDate = new Map(history.map((row) => [row.date, row]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const key = format(date, "yyyy-MM-dd");
    return {
      date: key,
      label: index === 0 ? "Today" : format(date, "EEEE"),
      attendance: byDate.get(key) || null,
      isWeeklyOff: isWeeklyOffDate(key),
    };
  });
}

function getDayStatus(day: ReturnType<typeof buildLastSevenDays>[number]) {
  if (day.isWeeklyOff && !day.attendance) {
    return {
      label: WEEKLY_OFF_LABEL,
      icon: CalendarDays,
      iconClass: "border border-accent/25 bg-accent/10 text-accent",
      pillClass: "border-accent/20 bg-accent/10 text-accent",
    };
  }

  if (!day.attendance) {
    return {
      label: "No record",
      icon: Clock3,
      iconClass: "border border-border bg-card text-muted-foreground",
      pillClass: "border-border bg-card text-muted-foreground",
    };
  }

  if (day.attendance.is_late) {
    return {
      label: "Late",
      icon: Clock3,
      iconClass: "border border-warning/25 bg-warning/10 text-warning",
      pillClass: "border-warning/20 bg-warning/10 text-warning",
    };
  }

  if (day.attendance.is_early_checkout) {
    return {
      label: "Early checkout",
      icon: LogOut,
      iconClass: "border border-warning/25 bg-warning/10 text-warning",
      pillClass: "border-warning/20 bg-warning/10 text-warning",
    };
  }

  if (day.attendance.check_out_time) {
    return {
      label: "Completed",
      icon: CalendarCheck2,
      iconClass: "border border-success/25 bg-success/10 text-success",
      pillClass: "border-success/20 bg-success/10 text-success",
    };
  }

  return {
    label: "Checked in",
    icon: LogIn,
    iconClass: "border border-primary/25 bg-primary/10 text-primary",
    pillClass: "border-primary/20 bg-primary/10 text-primary",
  };
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return format(new Date(value), "HH:mm");
}

function isBeforeOfficeEnd(now: Date, officeEndTime?: string | null) {
  const [hour, minute] = (officeEndTime || "18:00:00").split(":").map(Number);
  const boundary = new Date(now);
  boundary.setHours(hour || 18, minute || 0, 0, 0);
  return now < boundary;
}
