import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, useCallback } from "react";
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
  QrCode,
  UserPlus,
  FileSpreadsheet,
  RotateCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { addDays, format, subDays } from "date-fns";
import { getCurrentNepaliMonthRange, formatNepaliDate } from "@/lib/nepali-calendar";
import type { WeeklyAttendanceDay } from "@/components/AdminCharts";
import {
  LiveWorkforceRadar,
  type LiveEmployeePresence,
} from "@/components/LiveWorkforceRadar";

const AdminCharts = lazy(() => import("@/components/AdminCharts"));

export const Route = createFileRoute("/_app/admin/")({ component: AdminDashboard });

function LiveTimeCount() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-initial inline-flex items-center gap-2 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs">
      <Clock size={13} className="text-primary animate-pulse" />
      <span className="font-mono text-xs sm:text-[13px] font-bold tabular-nums text-foreground tracking-tight">
        {time}
      </span>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile, isAdmin, isHR, hasPermission } = useAuth();
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
  const [weekly, setWeekly] = useState<WeeklyAttendanceDay[]>([]);
  const [historyData, setHistoryData] = useState<{
    sevenDays: WeeklyAttendanceDay[];
    fourteenDays: WeeklyAttendanceDay[];
    monthDays: WeeklyAttendanceDay[];
  } | null>(null);
  const [roster, setRoster] = useState<LiveEmployeePresence[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [profiles, roles, attToday, leaves, pending] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "super_admin", "hr_manager"]),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("leave_requests").select("*").eq("status", "pending"),
        supabase.from("profiles").select("*").eq("approval_status", "pending"),
      ]);

      const adminUserIds = new Set((roles.data ?? []).map((row) => row.user_id));
      const employeeProfiles = (profiles.data ?? []).filter(
        (p) => !adminUserIds.has(p.user_id),
      );
      const employeeIds = new Set(employeeProfiles.map((p) => p.user_id));
      const employeeAttendanceToday = (attToday.data ?? []).filter((row) =>
        employeeIds.has(row.user_id),
      );

      const total = employeeProfiles.length;
      const active = employeeProfiles.filter(
        (p) => p.approval_status === "approved" && !p.is_suspended,
      ).length;
      const present = employeeAttendanceToday.filter(
        (a) => a.status === "present" || a.status === "late" || a.status === "wfh",
      ).length;
      const late = employeeAttendanceToday.filter((a) => a.is_late).length;
      const absent = Math.max(0, active - present);
      const pct = active ? Math.round((present / active) * 100) : 0;

      setStats({
        total,
        active,
        present,
        absent,
        late,
        leaves: (leaves.data ?? []).filter((leave) => employeeIds.has(leave.user_id)).length,
        pending: pending.data?.length ?? 0,
        pct,
      });

      // Build live workforce presence roster
      const attMap = new Map(employeeAttendanceToday.map((a) => [a.user_id, a]));
      const presenceList: LiveEmployeePresence[] = employeeProfiles
        .filter((p) => p.approval_status === "approved" && !p.is_suspended)
        .map((p) => {
          const att = attMap.get(p.user_id);
          let status: LiveEmployeePresence["status"] = "absent";
          if (att) {
            if (att.status === "wfh") status = "wfh";
            else if (att.status === "leave") status = "leave";
            else if (att.is_late || att.status === "late") status = "late";
            else status = "present";
          }
          return {
            userId: p.user_id,
            fullName: p.full_name || p.email?.split("@")[0] || "Employee",
            email: p.email || "",
            department: p.department || "General",
            designation: p.position || undefined,
            avatarUrl: p.avatar_url || null,
            phone: p.phone || null,
            status,
            checkInTime: att?.check_in_time || null,
            checkOutTime: att?.check_out_time || null,
            lateMinutes: att?.late_minutes || null,
            workLocation: att?.work_location || null,
          };
        });

      // Sort: Late first, then Present, then WFH, then Absent, alphabetical
      presenceList.sort((a, b) => {
        const order = { late: 0, present: 1, wfh: 2, leave: 3, absent: 4 };
        if (order[a.status] !== order[b.status]) {
          return order[a.status] - order[b.status];
        }
        return a.fullName.localeCompare(b.fullName);
      });
      setRoster(presenceList);

      // Fetch attendance history for the last 31 days in ONE single optimized query
      const todayDate = new Date(`${today}T00:00:00`);
      const earliestDate = subDays(todayDate, 31);
      const { data: attendanceHistory } = await supabase
        .from("attendance")
        .select("user_id,status,is_late,date")
        .gte("date", format(earliestDate, "yyyy-MM-dd"))
        .lte("date", today);

      // Group records by date for O(1) daily lookup
      const attendanceByDate: Record<string, any[]> = {};
      for (const row of attendanceHistory ?? []) {
        if (employeeIds.has(row.user_id)) {
          if (!attendanceByDate[row.date]) attendanceByDate[row.date] = [];
          attendanceByDate[row.date].push(row);
        }
      }

      const buildDaysForRange = (startDate: Date, endDate: Date): WeeklyAttendanceDay[] => {
        const result: WeeklyAttendanceDay[] = [];
        for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
          const ds = format(d, "yyyy-MM-dd");
          const dayRows = attendanceByDate[ds] ?? [];
          const presentCount = dayRows.filter(
            (x: any) => x.status === "present" && !x.is_late,
          ).length;
          const lateCount = dayRows.filter(
            (x: any) => x.status === "late" || x.is_late,
          ).length;
          const wfhCount = dayRows.filter((x: any) => x.status === "wfh").length;
          const attendedCount = presentCount + lateCount + wfhCount;
          result.push({
            day: format(d, "EEE"),
            date: ds,
            totalEmployees: active,
            present: presentCount,
            late: lateCount,
            wfh: wfhCount,
            absent: Math.max(0, active - attendedCount),
            attendancePct: active ? Math.round((attendedCount / active) * 100) : 0,
            noData: dayRows.length === 0,
            isToday: ds === today,
          });
        }
        return result;
      };

      // 1. Rolling 7 days (ALWAYS guarantees 7 data points, never just 1 day)
      const sevenDays = buildDaysForRange(subDays(todayDate, 6), todayDate);
      // 2. Rolling 14 days
      const fourteenDays = buildDaysForRange(subDays(todayDate, 13), todayDate);
      // 3. Current Nepali month to date
      const nepaliMonthStart = new Date(`${getCurrentNepaliMonthRange().startAd}T00:00:00`);
      const monthDays = buildDaysForRange(
        nepaliMonthStart <= todayDate ? nepaliMonthStart : subDays(todayDate, 6),
        todayDate,
      );

      setWeekly(sevenDays);
      setHistoryData({ sevenDays, fourteenDays, monthDays });

      // Departments
      const deptMap: Record<string, number> = {};
      employeeProfiles.forEach((p) => {
        const k = p.department || "Unassigned";
        deptMap[k] = (deptMap[k] || 0) + 1;
      });
      setDeptData(Object.entries(deptMap).map(([name, value]) => ({ name, value })));

      // Activity
      const { data: notif } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setActivity(notif ?? []);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const hasUrgentActions = stats.pending > 0 || stats.leaves > 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${isAdmin ? "Admin" : isHR ? "HR" : profile?.full_name?.split(" ")[0] ?? "Admin"}`}
        subtitle={`Live Operations · ${format(new Date(), "EEEE, MMMM d, yyyy")} (${formatNepaliDate(new Date().toISOString(), "DD MMMM YYYY")} BS)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Digital Time Counter */}
            <LiveTimeCount />

            {/* Quick Action: QR / Card Reader Attendance */}
            {isAdmin && (
              <Link
                to="/admin/card-reader-attendance"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-all"
              >
                <QrCode size={13} className="text-primary" />
                <span>Scan & Attend</span>
              </Link>
            )}

            {/* Quick Action: Add Employee */}
            {(isAdmin || hasPermission("employees.create")) && (
              <Link
                to="/admin/employees"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-all"
              >
                <UserPlus size={13} className="text-primary" />
                <span>Add Employee</span>
              </Link>
            )}

            {/* Quick Action: Reports */}
            {(isAdmin || hasPermission("reports.view")) && (
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs hover:border-primary/40 transition-all"
              >
                <FileSpreadsheet size={13} className="text-primary" />
                <span>Reports</span>
              </Link>
            )}

            {/* Live Refresh Button */}
            <button
              type="button"
              onClick={() => loadDashboardData(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 hover:bg-white dark:hover:bg-card text-muted-foreground hover:text-foreground shadow-xs hover:border-primary/40 transition-all disabled:opacity-50 cursor-pointer"
              title="Refresh Dashboard Data"
            >
              <RotateCw size={13} className={refreshing ? "animate-spin text-primary" : ""} />
            </button>
          </div>
        }
      />

      {/* Action Required Alert Ribbon */}
      {hasUrgentActions && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 p-4 text-amber-950 dark:text-amber-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">Action Required</div>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 mt-0.5">
                {stats.pending > 0 && (
                  <span>
                    <strong>{stats.pending}</strong> pending registration approval
                    {stats.pending > 1 ? "s" : ""}
                  </span>
                )}
                {stats.pending > 0 && stats.leaves > 0 && " and "}
                {stats.leaves > 0 && (
                  <span>
                    <strong>{stats.leaves}</strong> pending leave request
                    {stats.leaves > 1 ? "s" : ""}
                  </span>
                )}{" "}
                awaiting administrative review.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stats.pending > 0 && (
              <Link
                to="/admin/approvals"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Review Approvals</span>
                <ArrowRight size={12} />
              </Link>
            )}
            {stats.leaves > 0 && (
              <Link
                to="/admin/leaves"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-white/80 dark:bg-card hover:bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 shadow-xs transition-colors"
              >
                <span>Review Leaves</span>
                <ArrowRight size={12} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Metric Cards — All Clickable with direct routes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total employees"
          value={stats.total}
          icon={Users}
          accent="blue"
          to={isAdmin || hasPermission("employees.view") ? "/admin/employees" : undefined}
          hint={isAdmin || hasPermission("employees.view") ? "Click to manage staff" : undefined}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={UserCheck}
          accent="green"
          to={isAdmin || hasPermission("employees.view") ? "/admin/employees" : undefined}
          hint={`${stats.total - stats.active} inactive`}
        />
        <StatCard
          label="Present today"
          value={stats.present}
          icon={Activity}
          accent="green"
          to={isAdmin || hasPermission("attendance.view") ? "/admin/attendance" : undefined}
          hint={`${stats.pct}% attendance rate`}
        />
        <StatCard
          label="Absent today"
          value={stats.absent}
          icon={AlertTriangle}
          accent="red"
          to={isAdmin || hasPermission("attendance.view") ? "/admin/attendance" : undefined}
          hint={`${stats.active ? Math.round((stats.absent / stats.active) * 100) : 0}% absent`}
        />
        <StatCard
          label="Late today"
          value={stats.late}
          icon={Clock}
          accent="amber"
          to={isAdmin || hasPermission("attendance.view") ? "/admin/attendance" : undefined}
          hint="Checked in after grace"
        />
        <StatCard
          label="Leave requests"
          value={stats.leaves}
          icon={Calendar}
          accent="blue"
          to={isAdmin || hasPermission("leaves.view") ? "/admin/leaves" : undefined}
          hint={stats.leaves > 0 ? "Requires review" : "All cleared"}
        />
        <StatCard
          label="Pending approvals"
          value={stats.pending}
          icon={BellDot}
          accent="red"
          to={isAdmin ? "/admin/approvals" : undefined}
          hint={stats.pending > 0 ? "Action required" : "Zero pending"}
        />
        <StatCard
          label="Attendance %"
          value={`${stats.pct}%`}
          icon={TrendingUp}
          accent="green"
          to={isAdmin || hasPermission("attendance.view") ? "/admin/attendance" : undefined}
          hint="Live today status"
        />
      </div>

      {/* UNIQUE & NECESSARY FEATURE: Live Workforce Presence Radar */}
      <LiveWorkforceRadar
        roster={roster}
        activeCount={stats.active}
        presentCount={stats.present}
        lateCount={stats.late}
        absentCount={stats.absent}
        wfhCount={roster.filter((r) => r.status === "wfh").length}
        pct={stats.pct}
      />

      {/* Comprehensive Attendance Charts & Departments Breakdown */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="glass rounded-2xl h-80 lg:col-span-2 animate-pulse" />
            <div className="glass rounded-2xl h-80 animate-pulse" />
            <div className="glass rounded-2xl h-40 lg:col-span-3 animate-pulse" />
          </div>
        }
      >
        <AdminCharts
          weekly={weekly}
          historyData={historyData ?? undefined}
          deptData={deptData}
          activity={activity}
          activeEmployeesCount={stats.active}
        />
      </Suspense>
    </>
  );
}
