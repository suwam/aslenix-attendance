import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { LiveClock } from "@/components/LiveClock";
import { Button } from "@/components/ui/button";
import { getVerifiedAttendanceLocation } from "@/lib/attendance-location";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";

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
};

function CheckInPage() {
  const { user } = useAuth();
  const [today, setToday] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startDate = format(start, "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", todayDate)
      .order("date", { ascending: false });
    const rows = (data || []) as AttendanceRow[];
    setHistory(rows);
    setToday(rows.find((row) => row.date === todayDate) || null);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [user]);

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
    const { data: s } = await supabase
      .from("settings")
      .select("late_after_time")
      .limit(1)
      .maybeSingle();
    const now = new Date();
    const [lh, lm] = (s?.late_after_time || "09:15:00").split(":").map(Number);
    const boundary = new Date();
    boundary.setHours(lh, lm, 0, 0);
    const isLate = now > boundary;
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
    const nextToday = insertedToday as AttendanceRow;
    setToday(nextToday);
    setHistory((current) => [nextToday, ...current.filter((row) => row.date !== todayDate)]);
    toast.success(isLate ? "Checked in (late)" : "Checked in");
  };
  const checkOut = async () => {
    if (!today) return;
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
    const hours =
      Math.round(((now.getTime() - new Date(today.check_in_time).getTime()) / 3600000) * 100) / 100;
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
    const nextToday = updatedToday as AttendanceRow;
    setToday(nextToday);
    setHistory((current) => current.map((row) => (row.date === todayDate ? nextToday : row)));
    toast.success(`Checked out — ${formatWorkHours(hours)}`);
  };

  const lastSevenDays = buildLastSevenDays(history);
  const completedDays = lastSevenDays.filter((day) => day.attendance?.check_out_time).length;
  const checkedInDays = lastSevenDays.filter((day) => day.attendance?.check_in_time).length;
  const totalHours = lastSevenDays.reduce((sum, day) => sum + Number(day.attendance?.work_hours || 0), 0);

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
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Today</div>
                    <div className="mt-1 font-semibold text-white">{format(new Date(), "EEE, MMM d")}</div>
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
                ) : !today ? (
                  <div className="space-y-5 py-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_34px_rgba(125,92,255,.38)]">
                      <LogIn size={28} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">Ready to start?</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Mark your attendance when you arrive at the office.
                      </div>
                    </div>
                    <Button
                      onClick={checkIn}
                      disabled={busy}
                      className="neon-button h-12 rounded-xl px-8 text-base"
                    >
                      {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <LogIn size={18} className="mr-2" />}
                      Check in now
                    </Button>
                  </div>
                ) : !today.check_out_time ? (
                  <div className="space-y-6 py-4 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-[0_0_34px_rgba(34,197,94,.18)]">
                      <ShieldCheck size={28} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">You are checked in</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Started at{" "}
                        <span className="font-semibold text-foreground">
                          {formatTime(today.check_in_time)}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={checkOut}
                      disabled={busy}
                      variant="outline"
                      className="h-12 rounded-xl px-8 text-base"
                    >
                      {busy ? <Loader2 size={18} className="mr-2 animate-spin" /> : <LogOut size={18} className="mr-2" />}
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
                        {formatWorkHours(today.work_hours)}
                      </div>
                    </div>
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
              <h2 className="text-xl font-bold text-white">Past 7 days</h2>
              <p className="text-sm text-muted-foreground">Check-in, checkout, and worked hours</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-primary">
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_22px_rgba(125,92,255,.3)]">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-xl font-bold text-white">{value}</div>
      </div>
    </GlassCard>
  );
}

function AttendanceHistoryRow({ day }: { day: ReturnType<typeof buildLastSevenDays>[number] }) {
  const attendance = day.attendance;
  const status = getDayStatus(day);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.055]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${status.iconClass}`}>
            <status.icon size={18} />
          </div>
          <div>
            <div className="font-semibold text-white">{day.label}</div>
            <div className="text-xs text-muted-foreground">{format(new Date(`${day.date}T00:00:00`), "MMM d, yyyy")}</div>
          </div>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${status.pillClass}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <HistoryTime label="In" value={formatTime(attendance?.check_in_time)} />
        <HistoryTime label="Out" value={formatTime(attendance?.check_out_time)} />
        <HistoryTime label="Hours" value={attendance?.work_hours ? formatWorkHours(attendance.work_hours) : "—"} />
      </div>
    </div>
  );
}

function HistoryTime({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold tabular-nums text-white">{value}</div>
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
      iconClass: "border border-white/10 bg-white/[0.04] text-muted-foreground",
      pillClass: "border-white/10 bg-white/[0.04] text-muted-foreground",
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
