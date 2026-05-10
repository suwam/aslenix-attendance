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

    // Tasks + productivity
    const { data: tasks } = await supabase.from("tasks").select("*").eq("assigned_to", user.id);
    const total = tasks?.length || 0;
    const completed = tasks?.filter((t) => t.status === "completed").length || 0;
    const active = tasks?.filter((t) => t.status === "in_progress" || t.status === "review").length || 0;
    const now = Date.now();
    const overdue = tasks?.filter((t) => t.deadline && new Date(t.deadline).getTime() < now && t.status !== "completed").length || 0;
    const onTime = tasks?.filter((t) => t.status === "completed" && (!t.deadline || !t.completed_at || new Date(t.completed_at) <= new Date(t.deadline))).length || 0;
    const score = productivityScore({
      completed, total, onTimeRate: completed ? onTime / completed : 0,
      hours: monthStats.hours, targetHours: 160,
    });
    setTaskStats({ total, completed, active, overdue, score });

    // Recent activity = recent task updates + own standups
    const [{ data: rt }, { data: rs }] = await Promise.all([
      supabase.from("tasks").select("id,title,status,updated_at").eq("assigned_to", user.id).order("updated_at", { ascending: false }).limit(5),
      supabase.from("standups").select("id,date,today,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5),
    ]);
    const items = [
      ...(rt || []).map((t: any) => ({ kind: "Task", when: t.updated_at, text: `${t.title} → ${t.status}` })),
      ...(rs || []).map((s: any) => ({ kind: "Standup", when: s.updated_at, text: `Logged standup for ${s.date}` })),
    ].sort((a, b) => +new Date(b.when) - +new Date(a.when)).slice(0, 6);
    setRecent(items);
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
            <Link to="/tasks"><Button variant="outline" className="w-full justify-start rounded-xl"><ListTodo size={14} className="mr-2" />My tasks</Button></Link>
            <Link to="/standup"><Button variant="outline" className="w-full justify-start rounded-xl"><Activity size={14} className="mr-2" />Daily standup</Button></Link>
            <Link to="/my-leaves"><Button variant="outline" className="w-full justify-start rounded-xl"><Calendar size={14} className="mr-2" />Request leave</Button></Link>
            <Link to="/profile"><Button variant="outline" className="w-full justify-start rounded-xl"><CheckCircle2 size={14} className="mr-2" />Update profile</Button></Link>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Present this month" value={monthStats.present} icon={CheckCircle2} accent="green" />
        <StatCard label="Late arrivals" value={monthStats.late} icon={Clock} accent="amber" />
        <StatCard label="Leave days" value={monthStats.leave} icon={Calendar} accent="blue" />
        <StatCard label="Hours worked" value={`${monthStats.hours}h`} icon={TrendingUp} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard glow="blue">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Zap size={16} className="text-primary" /> Productivity score</h3>
            <span className="text-3xl font-bold tabular-nums" style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{taskStats.score}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all" style={{ width: `${taskStats.score}%`, background: "var(--gradient-brand)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Total</div><div className="font-bold text-lg tabular-nums">{taskStats.total}</div></div>
            <div><div className="text-xs text-muted-foreground">Completed</div><div className="font-bold text-lg tabular-nums">{taskStats.completed}</div></div>
            <div><div className="text-xs text-muted-foreground">Active</div><div className="font-bold text-lg tabular-nums">{taskStats.active}</div></div>
            <div><div className="text-xs text-muted-foreground">Overdue</div><div className="font-bold text-lg tabular-nums text-destructive">{taskStats.overdue}</div></div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recent activity</h3>
            <Link to="/tasks" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-border">
            {recent.map((r, i) => (
              <li key={i} className="py-2.5 flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-brand-soft)" }}>
                  <Activity size={12} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{r.kind}</div>
                  <div className="text-sm truncate">{r.text}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.when), "MMM d HH:mm")}</div>
              </li>
            ))}
            {recent.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No activity yet — create your first task.</li>}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
