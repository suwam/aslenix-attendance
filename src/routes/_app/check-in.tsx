import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { LiveClock } from "@/components/LiveClock";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/check-in")({ component: CheckInPage });

function CheckInPage() {
  const { user } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const todayDate = new Date().toISOString().slice(0, 10);

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
    setBusy(true);
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
    const now = new Date();
    const hours =
      Math.round(((now.getTime() - new Date(today.check_in_time).getTime()) / 3600000) * 100) / 100;
    const { error } = await supabase
      .from("attendance")
      .update({ check_out_time: now.toISOString(), work_hours: hours })
      .eq("id", today.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Checked out — ${hours}h`);
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
                {Number(today.work_hours).toFixed(2)}h)
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
