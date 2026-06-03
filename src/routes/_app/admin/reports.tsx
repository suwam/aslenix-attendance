import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Printer, Loader2 } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import { formatWorkHours } from "@/lib/work-hours";
import { isWeeklyOffDate } from "@/lib/weekly-off";

export const Route = createFileRoute("/_app/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isWeeklyOff = isWeeklyOffDate(date);
  const weekStart = format(startOfWeek(new Date(date), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");

  const run = async () => {
    setLoading(true);
    if (period === "weekly") {
      await runWeeklyReport();
      setLoading(false);
      return;
    }
    const [{ data: attendance }, { data: profiles }] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", date).order("date", { ascending: false }),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .eq("approval_status", "approved")
        .order("full_name"),
    ]);

    const attendanceByUser = new Map((attendance ?? []).map((row) => [row.user_id, row]));
    const merged = (profiles ?? []).map((profile) => ({
      ...profile,
      attendance: attendanceByUser.get(profile.user_id) ?? null,
    }));
    setRows(
      statusFilter === "all"
        ? merged
        : merged.filter((row) => {
            if (statusFilter === "weekly_off") return isWeeklyOff && !row.attendance;
            if (statusFilter === "absent") return !isWeeklyOff && !row.attendance;
            if (statusFilter === "late") return row.attendance?.is_late;
            if (statusFilter === "early_checkout") return row.attendance?.is_early_checkout;
            return row.attendance?.status === statusFilter;
          }),
    );
    setLoading(false);
  };

  const runWeeklyReport = async () => {
    const [{ data: attendance }, { data: profiles }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true }),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .eq("approval_status", "approved")
        .order("full_name"),
    ]);

    const attendanceByUser = new Map<string, any[]>();
    (attendance ?? []).forEach((row) => {
      attendanceByUser.set(row.user_id, [...(attendanceByUser.get(row.user_id) ?? []), row]);
    });

    const merged = (profiles ?? []).map((profile) => {
      const records = attendanceByUser.get(profile.user_id) ?? [];
      const workDays = weekDates(weekStart).filter((day) => !isWeeklyOffDate(day)).length;
      return {
        ...profile,
        records,
        presentDays: records.filter((record) => ["present", "late", "wfh"].includes(record.status)).length,
        lateDays: records.filter((record) => record.is_late).length,
        earlyCheckoutDays: records.filter((record) => record.is_early_checkout).length,
        leaveDays: records.filter((record) => record.status === "leave").length,
        wfhDays: records.filter((record) => record.status === "wfh").length,
        editedDays: records.filter((record) => record.is_edited).length,
        absentDays: Math.max(workDays - records.length, 0),
        totalHours: records.reduce((total, record) => total + Number(record.work_hours || 0), 0),
      };
    });

    setRows(
      statusFilter === "all"
        ? merged
        : merged.filter((row) => {
            if (statusFilter === "absent") return row.absentDays > 0;
            if (statusFilter === "late") return row.lateDays > 0;
            if (statusFilter === "early_checkout") return row.earlyCheckoutDays > 0;
            if (statusFilter === "leave") return row.leaveDays > 0;
            if (statusFilter === "wfh") return row.wfhDays > 0;
            if (statusFilter === "present") return row.presentDays > 0;
            if (statusFilter === "weekly_off") return false;
            return false;
          }),
    );
  };

  useEffect(() => {
    run();
  }, []);

  const exportCSV = () => {
    if (period === "weekly") {
      exportWeeklyCSV();
      return;
    }
    const header = [
      "Date",
      "Employee",
      "Email",
      "Department",
      "Check-in",
      "Check-out",
      "Work location",
      "Hours",
      "Status",
      "Edited",
      "Late",
      "Early checkout",
    ];
    const lines = rows.map((row) => {
      const attendance = row.attendance;
      return [
        date,
        row.full_name || "",
        row.email || "",
        row.department || "",
        attendance?.check_in_time ? format(new Date(attendance.check_in_time), "HH:mm") : "",
        attendance?.check_out_time ? format(new Date(attendance.check_out_time), "HH:mm") : "",
        attendance?.work_location || "",
        attendance?.work_hours ? formatWorkHours(attendance.work_hours) : "",
        attendance ? attendanceLabel(attendance) : isWeeklyOff ? "Weekly off" : "Absent",
        attendance?.is_edited ? "Yes" : "No",
        attendance?.is_late ? "Yes" : "No",
        attendance?.is_early_checkout ? "Yes" : "No",
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aslenix-attendance-daily-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportWeeklyCSV = () => {
    const header = [
      "Week start",
      "Week end",
      "Employee",
      "Email",
      "Department",
      "Present days",
      "Absent days",
      "Late days",
      "Early checkout days",
      "Leave days",
      "WFH days",
      "Edited days",
      "Total hours",
    ];
    const lines = rows.map((row) =>
      [
        weekStart,
        weekEnd,
        row.full_name || "",
        row.email || "",
        row.department || "",
        row.presentDays,
        row.absentDays,
        row.lateDays,
        row.earlyCheckoutDays,
        row.leaveDays,
        row.wfhDays,
        row.editedDays,
        formatWorkHours(row.totalHours),
      ]
        .map((x) => `"${String(x).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aslenix-attendance-weekly-${weekStart}-to-${weekEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Generate, filter and export daily or weekly attendance reports"
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer size={14} className="mr-1" />
              Print
            </Button>
            <Button onClick={exportCSV} className="neon-button rounded-lg">
              <Download size={14} className="mr-1" />
              Export CSV
            </Button>
          </>
        }
      />

      <GlassCard className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Report type</label>
            <Select value={period} onValueChange={(value) => setPeriod(value as "daily" | "weekly")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily report</SelectItem>
                <SelectItem value="weekly">Weekly report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{period === "weekly" ? "Week date" : "Date"}</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {period === "weekly" && (
              <div className="mt-1 text-xs text-muted-foreground">
                {format(new Date(weekStart), "MMM d")} - {format(new Date(weekEnd), "MMM d, yyyy")}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="early_checkout">Early checkout</SelectItem>
                <SelectItem value="weekly_off">Weekly off</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="wfh">WFH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={run} className="w-full neon-button rounded-lg">
              Run report
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No records for this {period === "weekly" ? "week" : "day"}.</div>
        ) : period === "weekly" ? (
          <WeeklyReportTable rows={rows} weekStart={weekStart} weekEnd={weekEnd} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">In</th>
                  <th className="p-3">Out</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Hours</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Audit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const attendance = row.attendance;
                  return (
                    <tr key={row.user_id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="p-3">{format(new Date(date), "MMM d, yyyy")}</td>
                      <td className="p-3 font-medium">{row.full_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{row.department || "—"}</td>
                      <td className="p-3 tabular-nums">
                        {attendance?.check_in_time
                          ? format(new Date(attendance.check_in_time), "HH:mm")
                          : "—"}
                      </td>
                      <td className="p-3 tabular-nums">
                        {attendance?.check_out_time
                          ? format(new Date(attendance.check_out_time), "HH:mm")
                          : "—"}
                      </td>
                      <td className="p-3">{attendance?.work_location || "—"}</td>
                      <td className="p-3 tabular-nums">
                        {attendance?.work_hours
                          ? formatWorkHours(attendance.work_hours)
                          : "—"}
                      </td>
                      <td className="p-3">
                        <span className="capitalize text-xs">
                          {attendance
                            ? attendanceLabel(attendance)
                            : isWeeklyOff
                              ? "Weekly off"
                              : "Absent"}
                        </span>
                      </td>
                      <td className="p-3">
                        {attendance?.is_edited ? (
                          <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Edited
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

function attendanceLabel(attendance: any) {
  if (attendance.is_early_checkout) return "Early checkout";
  if (attendance.is_late) return "Late";
  return attendance.status.replace("_", " ");
}

function WeeklyReportTable({ rows, weekStart, weekEnd }: { rows: any[]; weekStart: string; weekEnd: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="p-3">Week</th>
            <th className="p-3">Employee</th>
            <th className="p-3">Department</th>
            <th className="p-3">Present</th>
            <th className="p-3">Absent</th>
            <th className="p-3">Late</th>
            <th className="p-3">Early checkout</th>
            <th className="p-3">Leave</th>
            <th className="p-3">WFH</th>
            <th className="p-3">Hours</th>
            <th className="p-3">Audit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-b border-border/40 hover:bg-muted/20">
              <td className="p-3">
                {format(new Date(weekStart), "MMM d")} - {format(new Date(weekEnd), "MMM d")}
              </td>
              <td className="p-3 font-medium">{row.full_name || "—"}</td>
              <td className="p-3 text-muted-foreground">{row.department || "—"}</td>
              <td className="p-3 tabular-nums">{row.presentDays}</td>
              <td className="p-3 tabular-nums">{row.absentDays}</td>
              <td className="p-3 tabular-nums">{row.lateDays}</td>
              <td className="p-3 tabular-nums">{row.earlyCheckoutDays}</td>
              <td className="p-3 tabular-nums">{row.leaveDays}</td>
              <td className="p-3 tabular-nums">{row.wfhDays}</td>
              <td className="p-3 tabular-nums">{formatWorkHours(row.totalHours)}</td>
              <td className="p-3">
                {row.editedDays > 0 ? (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {row.editedDays} edited
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function weekDates(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => format(addDays(new Date(weekStart), index), "yyyy-MM-dd"));
}
