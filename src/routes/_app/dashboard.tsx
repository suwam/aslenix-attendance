import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { LiveClock } from "@/components/LiveClock";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, Calendar, TrendingUp, LogIn, LogOut, ListTodo, Activity, Zap } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";
import { productivityScore } from "@/lib/tasks-utils";

export const Route = createFileRoute("/_app/dashboard")({ component: EmployeeDashboard });

function EmployeeDashboard() {
  const { user, profile } = useAuth();
  const [today, setToday] = useState<any>(null);
  const [monthStats, setMonthStats] = useState({ present: 0, late: 0, leave: 0, hours: 0 });
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, active: 0, overdue: 0, score: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const todayDate = new Date().toISOString().slice(0, 10);

  const load = async () => {
    if (!user) return;
    const { data: t } = await supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", todayDate).maybeSingle();
    setToday(t);
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
    const { data: m } = await supabase.from("attendance").select("*").eq("user_id", user.id).gte("date", monthStart);
    setMonthStats({
      present: m?.filter((x) => x.status === "present" || x.status === "late" || x.status === "wfh").length ?? 0,
      late: m?.filter((x) => x.is_late).length ?? 0,
      leave: m?.filter((x) => x.status === "leave").length ?? 0,
      hours: Math.round((m?.reduce((a, x) => a + Number(x.work_hours || 0), 0) ?? 0) * 10) / 10,
    });
  };
  useEffect(() => { load(); }, [user]);

  const checkIn = async () => {
    if (!user) return;
    setBusy(true);
    const { data: settings } = await supabase.from("settings").select("late_after_time").limit(1).maybeSingle();
    const now = new Date();
    const lateTime = settings?.late_after_time || "09:15:00";
    const [lh, lm] = lateTime.split(":").map(Number);
    const lateBoundary = new Date(); lateBoundary.setHours(lh, lm, 0, 0);
    const isLate = now > lateBoundary;
    const { error } = await supabase.from("attendance").insert({
      user_id: user.id, date: todayDate, check_in_time: now.toISOString(),
      status: isLate ? "late" : "present", is_late: isLate,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(isLate ? "Checked in (late)" : "Checked in"); load();
  };

  const checkOut = async () => {
    if (!user || !today) return;
    setBusy(true);
    const now = new Date();
    const inT = new Date(today.check_in_time);
    const hours = Math.round(((now.getTime() - inT.getTime()) / 3600000) * 100) / 100;
    const { error } = await supabase.from("attendance").update({ check_out_time: now.toISOString(), work_hours: hours }).eq("id", today.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Checked out — ${hours}h worked`); load();
  };

  const status = !today ? "Not checked in" : today.check_out_time ? "Day completed" : "Working";

  return (
    <>
      <PageHeader title={`Hello, ${profile?.full_name?.split(" ")[0]}`} subtitle="Here's your day at a glance" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <GlassCard className="lg:col-span-2 relative overflow-hidden" glow="red">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <LiveClock className="flex-1" />
            <div className="flex flex-col items-end gap-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: status === "Working" ? "var(--gradient-brand)" : status === "Day completed" ? "color-mix(in oklab, var(--success) 25%, transparent)" : "color-mix(in oklab, var(--muted) 50%, transparent)", color: status === "Working" ? "white" : undefined }}>{status}</div>
              {!today ? (
                <Button onClick={checkIn} disabled={busy} className="neon-button rounded-xl h-11 px-6"><LogIn size={16} className="mr-2" />Check in</Button>
              ) : !today.check_out_time ? (
                <Button onClick={checkOut} disabled={busy} variant="outline" className="rounded-xl h-11 px-6"><LogOut size={16} className="mr-2" />Check out</Button>
              ) : (
                <div className="text-xs text-muted-foreground">Worked {Number(today.work_hours).toFixed(2)}h today</div>
              )}
            </div>
          </div>
          {today && (
            <div className="mt-5 pt-5 border-t border-border grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Check-in</div><div className="font-medium tabular-nums">{format(new Date(today.check_in_time), "HH:mm")}</div></div>
              <div><div className="text-xs text-muted-foreground">Check-out</div><div className="font-medium tabular-nums">{today.check_out_time ? format(new Date(today.check_out_time), "HH:mm") : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Hours</div><div className="font-medium tabular-nums">{today.work_hours ? `${Number(today.work_hours).toFixed(2)}h` : "—"}</div></div>
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Quick actions</h3>
          <div className="space-y-2">
            <Link to="/check-in"><Button variant="outline" className="w-full justify-start rounded-xl"><Clock size={14} className="mr-2" />Mark attendance</Button></Link>
            <Link to="/my-leaves"><Button variant="outline" className="w-full justify-start rounded-xl"><Calendar size={14} className="mr-2" />Request leave</Button></Link>
            <Link to="/my-attendance"><Button variant="outline" className="w-full justify-start rounded-xl"><TrendingUp size={14} className="mr-2" />View report</Button></Link>
            <Link to="/profile"><Button variant="outline" className="w-full justify-start rounded-xl"><CheckCircle2 size={14} className="mr-2" />Update profile</Button></Link>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Present this month" value={monthStats.present} icon={CheckCircle2} accent="green" />
        <StatCard label="Late arrivals" value={monthStats.late} icon={Clock} accent="amber" />
        <StatCard label="Leave days" value={monthStats.leave} icon={Calendar} accent="blue" />
        <StatCard label="Hours worked" value={`${monthStats.hours}h`} icon={TrendingUp} accent="red" />
      </div>
    </>
  );
}
