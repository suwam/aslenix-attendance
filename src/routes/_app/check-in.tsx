import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatNepaliDate, getNepaliDate } from "@/lib/nepali-calendar";
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
import { CheckoutGreetingModal } from "@/components/CheckoutGreetingModal";

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
  const { user, profile, isAdmin, isHR, signOut } = useAuth();
  const nav = useNavigate();
  const [today, setToday] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [assignedShift, setAssignedShift] = useState<Shift>(DEFAULT_MORNING_SHIFT);
  const [busy, setBusy] = useState(false);
  const checkInInFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);

  // Administrators and HR Managers do not need to check in
  useEffect(() => {
    if (isAdmin || isHR) {
      nav({ to: "/admin" });
    }
  }, [isAdmin, isHR, nav]);

  // Attendance closes at 2:00 PM Nepal time.
  const [isPastCutoff, setIsPastCutoff] = useState(() => isAttendanceCutoffPassed());
  const [showProhibitedDialog, setShowProhibitedDialog] = useState(false);
  const [checkoutGreetingOpen, setCheckoutGreetingOpen] = useState(false);
  const [checkoutModalData, setCheckoutModalData] = useState<{
    checkInTime?: string | null;
    checkOutTime?: string | null;
    workHours?: number | string | null;
    isEarly?: boolean;
    earlyMinutes?: number;
    overtimeMinutes?: number;
  } | null>(null);

  useEffect(() => {
    const updateTime = () => setIsPastCutoff(isAttendanceCutoffPassed());
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // The Nepali calendar below presents one month plus 15 days (45 days total).
    const historyStart = format(new Date(Date.now() - 44 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
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
    setAssignedShift(shift.shift);
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
    if (busy || checkInInFlight.current) return;

    // A resumed or stale screen can briefly show the check-in action after an
    // attendance row already exists. Refresh instead of creating a duplicate.
    if (today?.check_in_time) {
      await load();
      return toast.info("You are already checked in for today.");
    }

    if (isAttendanceCutoffPassed()) {
      return;
    }

    checkInInFlight.current = true;
    setBusy(true);

    let location: Awaited<ReturnType<typeof getVerifiedAttendanceLocation>>;
    try {
      location = await getVerifiedAttendanceLocation();
    } catch (error) {
      checkInInFlight.current = false;
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
        is_late: evalResult.is_late,
        shift_id: assignedShift.id,
        shift_name_snapshot: assignedShift.name,
        scheduled_check_in: assignedShift.start_time,
        scheduled_check_out: assignedShift.end_time,
        late_minutes: evalResult.late_minutes,
      })
      .select()
      .maybeSingle();

    checkInInFlight.current = false;
    setBusy(false);
    if (error || !insertedToday) {
      if (error?.code === "23505") {
        await load();
        return toast.info("Today's attendance already exists. Your check-in status has been refreshed.");
      }
      return toast.error(error?.message ?? "Unable to check in");
    }
    setToday(insertedToday as AttendanceRow);
    await load();
    if (evalResult.is_late) {
      toast.warning(`Checked in (${evalResult.late_minutes}m late for ${assignedShift.name})\nWhatsApp notification: Queued`);
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
    setToday(updatedToday as AttendanceRow);
    await load();
    if (evalResult.is_early_checkout) {
      toast.warning(`Checked out early (${evalResult.early_checkout_minutes}m before scheduled ${formatTime12Hour(assignedShift.end_time)})\nWhatsApp notification: Queued`);
    } else if (evalResult.overtime_minutes > 0) {
      toast.success(`Checked out (${evalResult.overtime_minutes}m overtime) · ${formatWorkHours(evalResult.work_hours)} worked\nWhatsApp notification: Queued`);
    } else {
      toast.success(`Checked out · ${formatWorkHours(evalResult.work_hours)} worked\nWhatsApp notification: Queued`);
    }

    // Pop the checkout farewell / day completion message once immediately after checkout
    setCheckoutModalData({
      checkInTime: (updatedToday as any).check_in_time ? format(new Date((updatedToday as any).check_in_time), "hh:mm a") : null,
      checkOutTime: format(now, "hh:mm a"),
      workHours: evalResult.work_hours,
      isEarly: evalResult.is_early_checkout,
      earlyMinutes: evalResult.early_checkout_minutes,
      overtimeMinutes: evalResult.overtime_minutes,
    });
    setCheckoutGreetingOpen(true);
    if (user) {
      localStorage.setItem(`aslenix_checkout_greeting_${user.id}_${todayDate}`, "true");
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
          <GlassCard tone="blue" className="overflow-hidden border-border p-0 shadow-sm">
            <div className="relative p-6 sm:p-8">
              <div className="relative">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin size={15} className="text-primary" />
                      Office location verified on action
                    </div>
                    <LiveClock />
                  </div>
                  <div className="rounded-xl border border-border bg-white px-4 py-3 text-right shadow-xs">
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
                    <div className="rounded-xl border border-border bg-white/80 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
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
                          <div className="rounded-lg border border-border bg-white px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reporting</div>
                            <div className="font-semibold text-foreground">{formatTime12Hour(assignedShift.start_time)}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-white px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closing</div>
                            <div className="font-semibold text-foreground">{formatTime12Hour(assignedShift.end_time)}</div>
                          </div>
                          <div className="rounded-lg border border-border bg-white px-3 py-1.5">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grace</div>
                            <div className="font-semibold text-foreground">{assignedShift.grace_period_mins}m</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Attendance Timeline */}
                    <div className="rounded-xl border border-border bg-white/80 p-4 sm:p-5">
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
                        <div className="relative flex flex-col items-center rounded-xl border border-border bg-white p-3 text-center">
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
                            ? "border-border bg-white opacity-70"
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
                        <div className="relative flex flex-col items-center rounded-xl border border-border bg-white p-3 text-center">
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
                            ? "border-border bg-white opacity-70"
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
                      false && isPastCutoff ? (
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
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
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
                            disabled={busy || isPastCutoff}
                            className="h-12 rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
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
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-sm">
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
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-sm">
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => nav({ to: "/my-attendance" })}
                            className="mt-2 rounded-xl text-xs font-semibold"
                          >
                            <FileText size={13} className="mr-1.5" />
                            Request Check-out Correction
                          </Button>
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

        <GlassCard tone="mint" className="h-fit border-border shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">Past 7 days</h2>
              <p className="text-sm text-muted-foreground">Check-in, checkout, and worked hours</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
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

      <AttendanceHistoryCalendar history={history} />

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

      {/* Shift Checkout Farewell & Day Completion Modal */}
      <CheckoutGreetingModal
        open={checkoutGreetingOpen}
        onOpenChange={setCheckoutGreetingOpen}
        userName={profile?.full_name || user?.user_metadata?.full_name || "Team Member"}
        employeeId={user?.id}
        checkInTime={
          checkoutModalData?.checkInTime ??
          (today?.check_in_time ? format(new Date(today.check_in_time), "hh:mm a") : null)
        }
        checkOutTime={
          checkoutModalData?.checkOutTime ??
          (today?.check_out_time ? format(new Date(today.check_out_time), "hh:mm a") : null)
        }
        workHours={checkoutModalData?.workHours ?? today?.work_hours}
        isEarly={checkoutModalData?.isEarly ?? today?.is_early_checkout}
        earlyMinutes={checkoutModalData?.earlyMinutes ?? today?.early_checkout_minutes ?? 0}
        overtimeMinutes={checkoutModalData?.overtimeMinutes ?? today?.overtime_minutes ?? 0}
        shiftName={assignedShift?.name || "Standard Shift"}
        gregorianDate={format(new Date(), "EEEE, MMM d, yyyy")}
        nepaliDate={formatNepaliDate(new Date(), "MMMM DD, YYYY")}
      />
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
    <GlassCard tone="blue" className="flex items-center gap-3 border-border p-4 shadow-xs">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
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

const ATTENDANCE_CALENDAR_DAYS = 45;

function AttendanceHistoryCalendar({ history }: { history: AttendanceRow[] }) {
  const calendar = useMemo(() => {
    const byDate = new Map(history.map((record) => [record.date, record]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - (ATTENDANCE_CALENDAR_DAYS - 1));

    const cells: Array<{ date: Date; key: string; attendance: AttendanceRow | null; weeklyOff: boolean } | null> = [];
    for (let blank = 0; blank < rangeStart.getDay(); blank += 1) cells.push(null);

    for (let offset = 0; offset < ATTENDANCE_CALENDAR_DAYS; offset += 1) {
      const date = new Date(rangeStart);
      date.setDate(rangeStart.getDate() + offset);
      const key = format(date, "yyyy-MM-dd");
      cells.push({ date, key, attendance: byDate.get(key) ?? null, weeklyOff: isWeeklyOffDate(key) });
    }

    const recorded = history.filter((record) => record.check_in_time).length;
    const completed = history.filter((record) => record.check_out_time).length;
    return { cells, rangeStart, today, recorded, completed };
  }, [history]);

  return (
    <GlassCard tone="blue" className="mt-6 overflow-hidden border-border p-0 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-card text-primary shadow-xs">
            <CalendarDays size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground sm:text-lg">Nepali Attendance Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Last 1 month and 15 days · {formatNepaliDate(calendar.rangeStart, "DD MMMM YYYY")} – {formatNepaliDate(calendar.today, "DD MMMM YYYY")} BS
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <CalendarSummary label="Checked in" value={calendar.recorded} tone="text-primary" />
          <CalendarSummary label="Completed" value={calendar.completed} tone="text-success" />
        </div>
      </div>

      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <CalendarLegend className="bg-success" label="Completed" />
          <CalendarLegend className="bg-primary" label="Checked in" />
          <CalendarLegend className="bg-warning" label="Working / pending checkout" />
          <CalendarLegend className="bg-muted-foreground/50" label="No record" />
          <CalendarLegend className="bg-accent" label={WEEKLY_OFF_LABEL} />
        </div>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1.5 pb-1.5">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {calendar.cells.map((cell, index) =>
              cell ? <AttendanceCalendarDay key={cell.key} cell={cell} todayKey={format(calendar.today, "yyyy-MM-dd")} /> : <div key={`blank-${index}`} aria-hidden="true" className="min-h-[108px] rounded-xl bg-muted/20" />,
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function AttendanceCalendarDay({
  cell,
  todayKey,
}: {
  cell: { date: Date; key: string; attendance: AttendanceRow | null; weeklyOff: boolean };
  todayKey: string;
}) {
  const bsDate = getNepaliDate(cell.date);
  const isToday = cell.key === todayKey;
  const status = getCalendarStatus(cell.attendance, cell.weeklyOff);
  const showMonth = bsDate.getDate() === 1 || cell.date.getDate() === 1;

  return (
    <div
      className={`min-h-[108px] rounded-xl border p-2 transition-colors ${isToday ? "border-primary/50 bg-primary/5 shadow-xs" : "border-border/70 bg-card/70"}`}
      title={`${formatNepaliDate(cell.key, "dddd, DD MMMM YYYY")} BS · ${status.label}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="text-sm font-bold tabular-nums text-foreground">{bsDate.getDate()}</div>
          {showMonth && <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{bsDate.format("MMM")}</div>}
        </div>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${status.dotClass}`} aria-label={status.label} />
      </div>
      <div className={`mt-1.5 line-clamp-1 text-[10px] font-semibold ${status.textClass}`}>{status.label}</div>
      {cell.attendance?.check_in_time ? (
        <div className="mt-1.5 space-y-0.5 text-[10px] tabular-nums text-muted-foreground">
          <div>In {format(new Date(cell.attendance.check_in_time), "HH:mm")}</div>
          <div>Out {cell.attendance.check_out_time ? format(new Date(cell.attendance.check_out_time), "HH:mm") : "—"}</div>
        </div>
      ) : (
        <div className="mt-1.5 text-[10px] text-muted-foreground">{format(cell.date, "EEE")}</div>
      )}
    </div>
  );
}

function getCalendarStatus(attendance: AttendanceRow | null, weeklyOff: boolean) {
  if (attendance?.check_out_time) return { label: "Completed", dotClass: "bg-success", textClass: "text-success" };
  if (attendance?.check_in_time) return { label: "Working", dotClass: "bg-warning", textClass: "text-warning" };
  if (weeklyOff) return { label: WEEKLY_OFF_LABEL, dotClass: "bg-accent", textClass: "text-accent" };
  return { label: "No record", dotClass: "bg-muted-foreground/50", textClass: "text-muted-foreground" };
}

function CalendarLegend({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><i className={`h-2 w-2 rounded-full ${className}`} />{label}</span>;
}

function CalendarSummary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-muted-foreground">
      <strong className={`mr-1 tabular-nums ${tone}`}>{value}</strong>{label}
    </span>
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
