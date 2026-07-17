import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput, BSMonthInput } from "@/components/BSDateInput";
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
import {
  bsInputToAdDateString,
  bsMonthInputToAdRange,
  formatBsInput,
  formatBsMonthInput,
  formatNepaliDate,
} from "@/lib/nepali-calendar";
import { isWeeklyOffDate } from "@/lib/weekly-off";
import logoMarkUrl from "@/assets/aslenix-mark.png";

export const Route = createFileRoute("/_app/admin/reports")({ component: ReportsPage });

type ReportPeriod = "daily" | "weekly" | "monthly";

function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [bsDate, setBsDate] = useState(formatBsInput());
  const [bsMonth, setBsMonth] = useState(formatBsMonthInput());
  const date = bsInputToAdDateString(bsDate) ?? format(new Date(), "yyyy-MM-dd");
  const monthRange = bsMonthInputToAdRange(bsMonth);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isFutureDate = date > todayDate;
  const isWeeklyOff = isWeeklyOffDate(date);
  const weekStart = format(startOfWeek(new Date(`${date}T00:00:00`), { weekStartsOn: 0 }), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(`${weekStart}T00:00:00`), 5), "yyyy-MM-dd");
  const monthStart = monthRange?.startAd ?? date;
  const monthEnd = monthRange?.endAd ?? date;
  const aggregateStart = period === "monthly" ? monthStart : weekStart;
  const aggregateEnd = period === "monthly" ? monthEnd : weekEnd;
  const aggregateLabel = period === "monthly" ? monthRange?.label || bsMonth : "Week";

  const run = async () => {
    setLoading(true);
    if (period === "weekly") {
      await runAggregateReport(weekStart, weekEnd);
      setLoading(false);
      return;
    }
    if (period === "monthly") {
      await runAggregateReport(monthStart, monthEnd);
      setLoading(false);
      return;
    }
    const [{ data: attendance }, { data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", date).order("date", { ascending: false }),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .eq("approval_status", "approved")
        .order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
    ]);

    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeProfiles = sortByEmployeeName(
      (profiles ?? []).filter((profile) => !adminUserIds.has(profile.user_id)),
    );
    const attendanceByUser = new Map((attendance ?? []).map((row) => [row.user_id, row]));
    const merged = employeeProfiles.map((profile) => ({
      ...profile,
      attendance: attendanceByUser.get(profile.user_id) ?? null,
    }));
    setRows(
      statusFilter === "all"
        ? merged
        : merged.filter((row) => {
            if (statusFilter === "weekly_off") return isWeeklyOff && !row.attendance;
            if (statusFilter === "absent") return !isFutureDate && !isWeeklyOff && !row.attendance;
            if (statusFilter === "late") return row.attendance?.is_late;
            if (statusFilter === "early_checkout") return row.attendance?.is_early_checkout;
            return row.attendance?.status === statusFilter;
          }),
    );
    setLoading(false);
  };

  const runAggregateReport = async (startDate: string, endDate: string) => {
    const [{ data: attendance }, { data: profiles }, { data: roleRows }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .eq("approval_status", "approved")
        .order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
    ]);

    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeProfiles = sortByEmployeeName(
      (profiles ?? []).filter((profile) => !adminUserIds.has(profile.user_id)),
    );
    const attendanceByUser = new Map<string, any[]>();
    (attendance ?? []).forEach((row) => {
      attendanceByUser.set(row.user_id, [...(attendanceByUser.get(row.user_id) ?? []), row]);
    });

    const merged = employeeProfiles.map((profile) => {
      const records = attendanceByUser.get(profile.user_id) ?? [];
      const elapsedEndDate = endDate > todayDate ? todayDate : endDate;
      const elapsedWorkDates =
        startDate <= todayDate ? dateRange(startDate, elapsedEndDate).filter((day) => !isWeeklyOffDate(day)) : [];
      const elapsedRecords = records.filter((record) => record.date <= todayDate);
      const recordedWorkDates = new Set(
        elapsedRecords.filter((record) => !isWeeklyOffDate(record.date)).map((record) => record.date),
      );
      return {
        ...profile,
        records,
        presentDays: elapsedRecords.filter((record) => ["present", "late", "wfh"].includes(record.status)).length,
        lateDays: elapsedRecords.filter((record) => record.is_late).length,
        earlyCheckoutDays: elapsedRecords.filter((record) => record.is_early_checkout).length,
        leaveDays: elapsedRecords.filter((record) => record.status === "leave").length,
        wfhDays: elapsedRecords.filter((record) => record.status === "wfh").length,
        editedDays: elapsedRecords.filter((record) => record.is_edited).length,
        absentDays: Math.max(elapsedWorkDates.length - recordedWorkDates.size, 0),
        totalHours: elapsedRecords.reduce((total, record) => total + Number(record.work_hours || 0), 0),
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
    if (period === "weekly" || period === "monthly") {
      exportAggregateCSV();
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
        dailyStatusLabel(attendance, isWeeklyOff, isFutureDate),
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

  const exportAggregateCSV = () => {
    const header = [
      period === "monthly" ? "Month start" : "Week start",
      period === "monthly" ? "Month end" : "Week end",
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
        aggregateStart,
        aggregateEnd,
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
    a.download = `aslenix-attendance-${period}-${aggregateStart}-to-${aggregateEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          subtitle="Generate, filter and export daily, weekly or monthly attendance reports"
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
      </div>

      <div className="hidden print:block mb-8">
        {/* Letterhead */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col items-center justify-center flex-1 mt-6 mr-10">
            <h1 className="text-[3.25rem] leading-none font-black tracking-[0.3em] text-black font-serif">
              A S L E N I X
            </h1>
            <p className="text-[1.1rem] font-bold tracking-[0.4em] text-black mt-4">
              T E C H & S O L U T I O N
            </p>
          </div>
          
          <div className="flex flex-col items-center shrink-0">
            <div className="font-bold text-[15px] mb-2 text-black" style={{ fontFamily: "serif" }}>PAN No: 623611557</div>
            <div className="flex flex-col items-center">
              <img src={logoMarkUrl} alt="Logo" className="w-[88px] h-[88px] object-contain" />
              <span className="text-[#1065F5] font-black tracking-widest uppercase text-xl">ASLENIX</span>
            </div>
          </div>
        </div>
        
        <div className="text-[15px] font-bold text-black border-b-[1.5px] border-black pb-2 mb-2 flex flex-col gap-3" style={{ fontFamily: "serif" }}>
          <div className="ml-2">Reg No: 391840/82/83</div>
          <div className="flex justify-between items-center ml-2 mr-2">
            <div>Ref No: ASL-{new Date().getFullYear()}-125</div>
            <div>DATE: {formatBsInput()}</div>
          </div>
        </div>
        
        {/* Report Title */}
        <div className="text-center mt-8 mb-4">
          <h2 className="text-xl font-bold uppercase underline underline-offset-4 decoration-2">
            ATTENDANCE OF {period === "monthly" ? monthRange?.label || bsMonth : period === "weekly" ? `${formatNepaliDate(weekStart, "DD MMMM")} - ${formatNepaliDate(weekEnd, "DD MMMM YYYY")} BS` : bsDate}
          </h2>
        </div>
      </div>

      <GlassCard className="mb-5 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Report type</label>
            <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily report</SelectItem>
                <SelectItem value="weekly">Weekly report</SelectItem>
                <SelectItem value="monthly">Monthly report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              {period === "monthly" ? "Month (BS)" : period === "weekly" ? "Week date (BS)" : "Date (BS)"}
            </label>
            {period === "monthly" ? (
              <BSMonthInput value={bsMonth} onChange={setBsMonth} />
            ) : (
              <BSDateInput value={bsDate} onChange={setBsDate} />
            )}
            {period === "weekly" && (
              <div className="mt-1 text-xs text-muted-foreground">
                {formatNepaliDate(weekStart, "DD MMMM")} - {formatNepaliDate(weekEnd, "DD MMMM YYYY")} BS
              </div>
            )}
            {period === "monthly" && (
              <div className="mt-1 text-xs text-muted-foreground">
                {monthRange?.label || bsMonth} BS · {formatNepaliDate(monthStart, "DD MMMM")} -{" "}
                {formatNepaliDate(monthEnd, "DD MMMM YYYY")} BS
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

      <GlassCard className="p-0 overflow-hidden print:p-0 print:border-none print:bg-transparent print:shadow-none print:backdrop-blur-none">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No records for this {period === "monthly" ? "month" : period === "weekly" ? "week" : "day"}.
          </div>
        ) : period === "weekly" || period === "monthly" ? (
          <AggregateReportTable rows={rows} startDate={aggregateStart} endDate={aggregateEnd} label={aggregateLabel} period={period} />
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const attendance = row.attendance;
                  return (
                    <tr key={row.user_id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="p-3">{formatNepaliDate(date, "ddd DD, MMMM YYYY")} BS</td>
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
                              : isFutureDate
                                ? "Not due"
                                : "Absent"}
                        </span>
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

function dailyStatusLabel(attendance: any, isWeeklyOff: boolean, isFutureDate: boolean) {
  if (attendance) return attendanceLabel(attendance);
  if (isWeeklyOff) return "Weekly off";
  if (isFutureDate) return "Not due";
  return "Absent";
}

function sortByEmployeeName<T extends { full_name?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
      sensitivity: "base",
    }),
  );
}

function AggregateReportTable({
  rows,
  startDate,
  endDate,
  label,
  period,
}: {
  rows: any[];
  startDate: string;
  endDate: string;
  label: string;
  period: ReportPeriod;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="p-3">{period === "monthly" ? "Month" : "Week"}</th>
            <th className="p-3">Employee</th>
            <th className="p-3">Department</th>
            <th className="p-3">Present</th>
            <th className="p-3">Absent</th>
            <th className="p-3">Late</th>
            <th className="p-3">Early checkout</th>
            <th className="p-3">Leave</th>
            <th className="p-3">WFH</th>
            <th className="p-3">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-b border-border/40 hover:bg-muted/20">
              <td className="p-3">
                {period === "monthly" ? `${label} BS` : `${formatNepaliDate(startDate, "DD MMMM")} - ${formatNepaliDate(endDate, "DD MMMM YYYY")} BS`}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function dateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  return Array.from({ length: days }, (_, index) => format(addDays(start, index), "yyyy-MM-dd"));
}
