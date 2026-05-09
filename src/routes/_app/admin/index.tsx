import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Users, UserCheck, Clock, AlertTriangle, Calendar, TrendingUp, BellDot, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { format, subDays, startOfMonth } from "date-fns";

export const Route = createFileRoute("/_app/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ total: 0, active: 0, present: 0, absent: 0, late: 0, leaves: 0, pending: 0, pct: 0 });
  const [weekly, setWeekly] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [profiles, attToday, leaves, pending] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("leave_requests").select("*").eq("status", "pending"),
        supabase.from("profiles").select("*").eq("approval_status", "pending"),
      ]);
      const total = profiles.data?.length ?? 0;
      const active = profiles.data?.filter((p) => p.approval_status === "approved" && !p.is_suspended).length ?? 0;
      const present = attToday.data?.filter((a) => a.status === "present" || a.status === "late" || a.status === "wfh").length ?? 0;
      const late = attToday.data?.filter((a) => a.is_late).length ?? 0;
      const absent = Math.max(0, active - present);
      const pct = active ? Math.round((present / active) * 100) : 0;
      setStats({ total, active, present, absent, late, leaves: leaves.data?.length ?? 0, pending: pending.data?.length ?? 0, pct });

      // Weekly attendance
      const days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const ds = d.toISOString().slice(0, 10);
        const { data } = await supabase.from("attendance").select("status,is_late").eq("date", ds);
        days.push({
          day: format(d, "EEE"),
          present: data?.filter((x: any) => x.status === "present").length ?? 0,
          late: data?.filter((x: any) => x.status === "late" || x.is_late).length ?? 0,
          wfh: data?.filter((x: any) => x.status === "wfh").length ?? 0,
        });
      }
      setWeekly(days);

      // Departments
      const deptMap: Record<string, number> = {};
      profiles.data?.forEach((p) => {
        const k = p.department || "Unassigned";
        deptMap[k] = (deptMap[k] || 0) + 1;
      });
      setDeptData(Object.entries(deptMap).map(([name, value]) => ({ name, value })));

      // Activity
      const { data: notif } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(8);
      setActivity(notif ?? []);
    })();
  }, []);

  const COLORS = ["oklch(0.65 0.27 22)", "oklch(0.6 0.25 260)", "oklch(0.72 0.18 155)", "oklch(0.82 0.17 75)", "oklch(0.7 0.2 320)", "oklch(0.65 0.2 200)"];

  return (
    <>
      <PageHeader title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "Admin"}`} subtitle="Here's what's happening across ASLENIX today" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total employees" value={stats.total} icon={Users} accent="blue" delay={0} />
        <StatCard label="Active" value={stats.active} icon={UserCheck} accent="green" delay={0.05} />
        <StatCard label="Present today" value={stats.present} icon={Activity} accent="green" delay={0.1} hint={`${stats.pct}% attendance`} />
        <StatCard label="Absent today" value={stats.absent} icon={AlertTriangle} accent="red" delay={0.15} />
        <StatCard label="Late today" value={stats.late} icon={Clock} accent="amber" delay={0.2} />
        <StatCard label="Leave requests" value={stats.leaves} icon={Calendar} accent="blue" delay={0.25} />
        <StatCard label="Pending approvals" value={stats.pending} icon={BellDot} accent="red" delay={0.3} />
        <StatCard label="Attendance %" value={`${stats.pct}%`} icon={TrendingUp} accent="green" delay={0.35} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Weekly attendance</h3>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
              <XAxis dataKey="day" stroke="oklch(0.7 0.03 250)" fontSize={12} />
              <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
              <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
              <Bar dataKey="present" stackId="a" fill="oklch(0.6 0.25 260)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="late" stackId="a" fill="oklch(0.82 0.17 75)" />
              <Bar dataKey="wfh" stackId="a" fill="oklch(0.72 0.18 155)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Departments</h3>
          {deptData.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={deptData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1.5">
            {deptData.slice(0, 5).map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</div>
                <span className="text-muted-foreground tabular-nums">{d.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-3">
          <h3 className="text-lg font-semibold mb-4">Recent activity</h3>
          {activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No activity yet</div>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((n) => (
                <li key={n.id} className="py-3 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--gradient-brand-soft)" }}>
                    <BellDot size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{n.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(n.created_at), "MMM d, HH:mm")}</div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}
