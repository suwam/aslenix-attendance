import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, StatCard } from "@/components/PageHeader";
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp,
  BellDot,
  Activity,
} from "lucide-react";
import { format, subDays } from "date-fns";

const AdminCharts = lazy(() => import("@/components/AdminCharts"));

export const Route = createFileRoute("/_app/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    present: 0,
    absent: 0,
    late: 0,
    leaves: 0,
    pending: 0,
    pct: 0,
  });
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
      const active =
        profiles.data?.filter((p) => p.approval_status === "approved" && !p.is_suspended).length ??
        0;
      const present =
        attToday.data?.filter(
          (a) => a.status === "present" || a.status === "late" || a.status === "wfh",
        ).length ?? 0;
      const late = attToday.data?.filter((a) => a.is_late).length ?? 0;
      const absent = Math.max(0, active - present);
      const pct = active ? Math.round((present / active) * 100) : 0;
      setStats({
        total,
        active,
        present,
        absent,
        late,
        leaves: leaves.data?.length ?? 0,
        pending: pending.data?.length ?? 0,
        pct,
      });

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
      const { data: notif } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);
      setActivity(notif ?? []);
    })();
  }, []);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "Admin"}`}
        subtitle="Here's what's happening across ASLENIX today"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total employees"
          value={stats.total}
          icon={Users}
          accent="blue"
          delay={0}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={UserCheck}
          accent="green"
          delay={0.05}
        />
        <StatCard
          label="Present today"
          value={stats.present}
          icon={Activity}
          accent="green"
          delay={0.1}
          hint={`${stats.pct}% attendance`}
        />
        <StatCard
          label="Absent today"
          value={stats.absent}
          icon={AlertTriangle}
          accent="red"
          delay={0.15}
        />
        <StatCard label="Late today" value={stats.late} icon={Clock} accent="amber" delay={0.2} />
        <StatCard
          label="Leave requests"
          value={stats.leaves}
          icon={Calendar}
          accent="blue"
          delay={0.25}
        />
        <StatCard
          label="Pending approvals"
          value={stats.pending}
          icon={BellDot}
          accent="red"
          delay={0.3}
        />
        <StatCard
          label="Attendance %"
          value={`${stats.pct}%`}
          icon={TrendingUp}
          accent="green"
          delay={0.35}
        />
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass rounded-2xl h-80 lg:col-span-2 animate-pulse" />
            <div className="glass rounded-2xl h-80 animate-pulse" />
            <div className="glass rounded-2xl h-40 lg:col-span-3 animate-pulse" />
          </div>
        }
      >
        <AdminCharts weekly={weekly} deptData={deptData} activity={activity} />
      </Suspense>
    </>
  );
}
