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
import { CalendarDays, LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";

export const Route = createFileRoute("/_app/check-in")({ component: CheckInPage });

function CheckInPage() {
  const { user } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isWeeklyOff = isWeeklyOffDate(todayDate);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", todayDate)
      .maybeSingle();
    setToday(data);
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
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      date: todayDate,
      check_in_time: now.toISOString(),
      check_in_latitude: location.latitude,
      check_in_longitude: location.longitude,
      check_in_accuracy_meters: location.accuracy,
      status: isLate ? "late" : "present",
      is_late: isLate,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Checked in");
    load();
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
    const { error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: location.latitude,
        check_out_longitude: location.longitude,
        check_out_accuracy_meters: location.accuracy,
        is_early_checkout: isEarlyCheckout,
        work_hours: hours,
      })
      .eq("id", today.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Checked out — ${formatWorkHours(hours)}`);
    load();
  };

  return (
    <>
      <PageHeader title="Check-in" subtitle="Daily attendance" />
      <div className="max-w-2xl">
        <GlassCard glow="red" className="text-center py-10">
          <LiveClock className="mb-6" />
          {loading ? (
            <Loader2 className="animate-spin mx-auto text-primary" />
          ) : isWeeklyOff ? (
            <div className="mx-auto max-w-sm space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                <CalendarDays size={22} />
              </div>
              <div className="text-2xl font-bold text-accent">{WEEKLY_OFF_LABEL}</div>
              <div className="text-sm text-muted-foreground">
                Saturday is weekly off for everyone. No attendance is required today.
              </div>
            </div>
          ) : !today ? (
            <Button
              onClick={checkIn}
              disabled={busy}
              className="neon-button rounded-xl h-12 px-8 text-base"
            >
              <LogIn size={18} className="mr-2" />
              Check in now
            </Button>
          ) : !today.check_out_time ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Checked in at{" "}
                <span className="font-semibold text-foreground">
                  {format(new Date(today.check_in_time), "HH:mm")}
                </span>
              </div>
              <Button
                onClick={checkOut}
                disabled={busy}
                variant="outline"
                className="rounded-xl h-12 px-8 text-base"
              >
                <LogOut size={18} className="mr-2" />
                Check out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl font-bold text-success">Day completed</div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(today.check_in_time), "HH:mm")} →{" "}
                {format(new Date(today.check_out_time), "HH:mm")} (
                {formatWorkHours(today.work_hours)})
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}

function isBeforeOfficeEnd(now: Date, officeEndTime?: string | null) {
  const [hour, minute] = (officeEndTime || "18:00:00").split(":").map(Number);
  const boundary = new Date(now);
  boundary.setHours(hour || 18, minute || 0, 0, 0);
  return now < boundary;
}
