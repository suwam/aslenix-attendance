import { createFileRoute } from "@tanstack/react-router";
import { forwardRef, useEffect, useRef, useState } from "react";
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
import { Download, FileDown, Printer, Loader2 } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { formatWorkHours } from "@/lib/work-hours";
import { captureSanitizedPdfPage } from "@/lib/pdf-utils";
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

type WorkingDaySummary = {
  calendarDays: number;
  weeklyHolidays: number;
  publicHolidays: number;
  companyHolidays: number;
  workingDays: number;
};

const EMPTY_WORKING_DAY_SUMMARY: WorkingDaySummary = {
  calendarDays: 0,
  weeklyHolidays: 0,
  publicHolidays: 0,
  companyHolidays: 0,
  workingDays: 0,
};

function ReportsPage() {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [bsDate, setBsDate] = useState(formatBsInput());
  const [bsMonth, setBsMonth] = useState(formatBsMonthInput());
  const date = bsInputToAdDateString(bsDate) ?? format(new Date(), "yyyy-MM-dd");
  const monthRange = bsMonthInputToAdRange(bsMonth);
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [workingDaySummary, setWorkingDaySummary] =
    useState<WorkingDaySummary>(EMPTY_WORKING_DAY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const pdfExportRef = useRef<HTMLDivElement>(null);
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const isFutureDate = date > todayDate;
  const isWeeklyOff = isWeeklyOffDate(date);
  const weekStart = format(
    startOfWeek(new Date(`${date}T00:00:00`), { weekStartsOn: 0 }),
    "yyyy-MM-dd",
  );
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
    setWorkingDaySummary(EMPTY_WORKING_DAY_SUMMARY);
    const [{ data: attendance }, { data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", date).order("date", { ascending: false }),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, department, approval_status, is_suspended")
        .order("full_name"),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin", "hr_manager"]),
    ]);

    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const attendanceRows = attendance ?? [];
    const employeeProfiles = buildHistoricalReportProfiles(profiles ?? [], attendanceRows, adminUserIds);
    const attendanceByUser = new Map(attendanceRows.map((row) => [row.user_id, row]));
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
    const [{ data: attendance }, { data: profiles }, { data: roleRows }, { data: holidays }] =
      await Promise.all([
        supabase
          .from("attendance")
          .select("*")
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("profiles")
          .select("user_id, full_name, email, department, approval_status, is_suspended")
          .order("full_name"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "super_admin", "hr_manager"]),
        supabase
          .from("holidays")
          .select("*")
          .eq("is_active", true)
          .gte("date", startDate)
          .lte("date", endDate),
      ]);

    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const attendanceRows = attendance ?? [];
    const employeeProfiles = buildHistoricalReportProfiles(profiles ?? [], attendanceRows, adminUserIds);
    const attendanceByUser = new Map<string, any[]>();
    attendanceRows.forEach((row) => {
      attendanceByUser.set(row.user_id, [...(attendanceByUser.get(row.user_id) ?? []), row]);
    });

    const allDates = dateRange(startDate, endDate);
    const weeklyHolidayDates = new Set(allDates.filter((day) => isWeeklyOffDate(day)));
    const publicHolidayDates = new Set<string>();
    const companyHolidayDates = new Set<string>();

    (holidays ?? []).forEach((holiday: any) => {
      if (!holiday?.date || weeklyHolidayDates.has(holiday.date)) return;
      if (isCompanyHoliday(holiday)) {
        companyHolidayDates.add(holiday.date);
        return;
      }
      publicHolidayDates.add(holiday.date);
    });

    companyHolidayDates.forEach((day) => {
      if (publicHolidayDates.has(day)) companyHolidayDates.delete(day);
    });

    const workingDates = allDates.filter(
      (day) =>
        !weeklyHolidayDates.has(day) &&
        !publicHolidayDates.has(day) &&
        !companyHolidayDates.has(day),
    );
    const workingDateSet = new Set(workingDates);
    const summary: WorkingDaySummary = {
      calendarDays: allDates.length,
      weeklyHolidays: weeklyHolidayDates.size,
      publicHolidays: publicHolidayDates.size,
      companyHolidays: companyHolidayDates.size,
      workingDays: workingDates.length,
    };
    setWorkingDaySummary(summary);

    const merged = employeeProfiles.map((profile) => {
      const records = attendanceByUser.get(profile.user_id) ?? [];
      const workingRecords = records.filter((record) => workingDateSet.has(record.date));
      const presentDates = new Set<string>();
      const absentDates = new Set<string>();
      const leaveDates = new Set<string>();
      const wfhDates = new Set<string>();

      workingRecords.forEach((record) => {
        if (record.status === "wfh") {
          wfhDates.add(record.date);
          return;
        }
        if (record.status === "leave" || record.status === "half_day") {
          leaveDates.add(record.date);
          return;
        }
        if (record.status === "absent") {
          absentDates.add(record.date);
          return;
        }
        if (["present", "late", "half_day_present"].includes(record.status)) {
          presentDates.add(record.date);
        }
      });

      wfhDates.forEach((day) => {
        presentDates.delete(day);
        leaveDates.delete(day);
        absentDates.delete(day);
      });
      leaveDates.forEach((day) => {
        presentDates.delete(day);
        absentDates.delete(day);
      });
      absentDates.forEach((day) => {
        presentDates.delete(day);
      });

      const coveredDates = new Set([
        ...presentDates,
        ...absentDates,
        ...leaveDates,
        ...wfhDates,
      ]);

      const elapsedWorkingDates = workingDates.filter((day) => day <= todayDate);
      const coveredElapsedDates = new Set(
        Array.from(coveredDates).filter((day) => day <= todayDate),
      );

      const missingAbsentDays = Math.max(elapsedWorkingDates.length - coveredElapsedDates.size, 0);
      const presentDays = Math.min(presentDates.size, summary.workingDays);
      const leaveDays = Math.min(leaveDates.size, summary.workingDays);
      const wfhDays = Math.min(wfhDates.size, summary.workingDays);
      
      const elapsedAbsentDates = Array.from(absentDates).filter((day) => day <= todayDate);
      const absentDays = elapsedAbsentDates.length + missingAbsentDays + leaveDays;

      const elapsedWorkingDaysCount = elapsedWorkingDates.length;
      const attendancePercentage =
        elapsedWorkingDaysCount > 0
          ? Math.min(Math.round(((presentDays + wfhDays) / elapsedWorkingDaysCount) * 1000) / 10, 100)
          : 0;

      return {
        ...profile,
        records,
        presentDays,
        absentDays,
        leaveDays,
        wfhDays,
        attendancePercentage,
        totalWorkingDays: summary.workingDays,
        lateDays: workingRecords.filter((record) => record.is_late).length,
        earlyCheckoutDays: workingRecords.filter((record) => record.is_early_checkout).length,
        editedDays: workingRecords.filter((record) => record.is_edited).length,
        totalHours: workingRecords.reduce(
          (total, record) => total + Number(record.work_hours || 0),
          0,
        ),
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
      "Calendar days",
      "Weekly holidays",
      "Public holidays",
      "Company holidays",
      "Working days",
      "Present days",
      "Absent days",
      "Late days",
      "Early checkout days",
      "Leave days",
      "WFH days",
      "Attendance %",
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
        workingDaySummary.calendarDays,
        workingDaySummary.weeklyHolidays,
        workingDaySummary.publicHolidays,
        workingDaySummary.companyHolidays,
        workingDaySummary.workingDays,
        row.presentDays,
        row.absentDays,
        row.lateDays,
        row.earlyCheckoutDays,
        row.leaveDays,
        row.wfhDays,
        `${row.attendancePercentage}%`,
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

  const savePDF = async () => {
    if (loading) return;
    if (!rows.length) {
      toast.error("Run a report before saving PDF");
      return;
    }

    try {
      setSavingPdf(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const reportElement = pdfExportRef.current;
      if (!reportElement) throw new Error("Report layout is not ready");

      const imgData = await captureSanitizedPdfPage(reportElement);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= 297;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= 297;
      }

      const dateLabel =
        period === "monthly" ? monthRange?.label || bsMonth : period === "weekly" ? weekStart : date;
      pdf.save(`aslenix-attendance-${period}-${String(dateLabel).replace(/\s+/g, "-")}.pdf`);
      toast.success("PDF saved");
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to save PDF: ${error.message || "Unknown error"}`);
    } finally {
      setSavingPdf(false);
    }
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
              <Button variant="outline" onClick={savePDF} disabled={savingPdf || loading}>
                {savingPdf ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <FileDown size={14} className="mr-1" />
                )}
                Save PDF
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
            <h1 className="text-[3.25rem] leading-none font-black tracking-[0.3em] text-black font-serif whitespace-nowrap">
              A S L E N I X
            </h1>
            <p className="text-[1.1rem] font-bold tracking-[0.4em] text-black mt-4 whitespace-nowrap">
              T E C H & S O L U T I O N
            </p>
          </div>

          <div className="flex flex-col items-center shrink-0">
            <div className="font-bold text-[15px] mb-2 text-black" style={{ fontFamily: "serif" }}>
              PAN No: 623611557
            </div>
            <div className="flex flex-col items-center">
              <img src={logoMarkUrl} alt="Logo" className="w-[88px] h-[88px] object-contain" />
              <span className="text-[#1065F5] font-black tracking-widest uppercase text-xl">
                ASLENIX
              </span>
            </div>
          </div>
        </div>

        <div
          className="text-[15px] font-bold text-black border-b-[1.5px] border-black pb-2 mb-2 flex justify-between items-center px-2"
          style={{ fontFamily: "serif" }}
        >
          <div>Reg No: 391840/82/83</div>
          <div>DATE: {formatBsInput()}</div>
        </div>

        {/* Report Title */}
        <div className="text-center mt-8 mb-4">
          <h2 className="text-xl font-bold uppercase underline underline-offset-4 decoration-2">
            ATTENDANCE OF{" "}
            {period === "monthly"
              ? monthRange?.label || bsMonth
              : period === "weekly"
                ? `${formatNepaliDate(weekStart, "DD MMMM")} - ${formatNepaliDate(weekEnd, "DD MMMM YYYY")} BS`
                : bsDate}
          </h2>
        </div>
      </div>

      <div className="fixed -left-[10000px] top-0 pointer-events-none opacity-0">
        <PrintableReport
          ref={pdfExportRef}
          rows={rows}
          period={period}
          bsDate={bsDate}
          date={date}
          startDate={aggregateStart}
          endDate={aggregateEnd}
          label={aggregateLabel}
          monthLabel={monthRange?.label || bsMonth}
          workingDaySummary={workingDaySummary}
          isWeeklyOff={isWeeklyOff}
          isFutureDate={isFutureDate}
        />
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
              {period === "monthly"
                ? "Month (BS)"
                : period === "weekly"
                  ? "Week date (BS)"
                  : "Date (BS)"}
            </label>
            {period === "monthly" ? (
              <BSMonthInput value={bsMonth} onChange={setBsMonth} />
            ) : (
              <BSDateInput value={bsDate} onChange={setBsDate} />
            )}
            {period === "weekly" && (
              <div className="mt-1 text-xs text-muted-foreground">
                {formatNepaliDate(weekStart, "DD MMMM")} -{" "}
                {formatNepaliDate(weekEnd, "DD MMMM YYYY")} BS
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

      {period === "monthly" && <WorkingDaySummaryCard summary={workingDaySummary} />}

      <GlassCard className="p-0 overflow-hidden print:p-0 print:border-none print:bg-transparent print:shadow-none print:backdrop-blur-none">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No records for this{" "}
            {period === "monthly" ? "month" : period === "weekly" ? "week" : "day"}.
          </div>
        ) : period === "weekly" || period === "monthly" ? (
          <AggregateReportTable
            rows={rows}
            startDate={aggregateStart}
            endDate={aggregateEnd}
            label={aggregateLabel}
            period={period}
            summary={workingDaySummary}
          />
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
                        {attendance?.work_hours ? formatWorkHours(attendance.work_hours) : "—"}
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

function buildHistoricalReportProfiles(
  profiles: any[],
  attendanceRows: any[],
  adminUserIds: Set<string>,
) {
  const attendanceUserIds = new Set(attendanceRows.map((row) => row.user_id).filter(Boolean));
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const includedUserIds = new Set<string>();
  const rows = profiles.filter(
    (profile) => {
      const shouldInclude =
        !adminUserIds.has(profile.user_id) &&
        (profile.approval_status === "approved" || attendanceUserIds.has(profile.user_id));
      if (shouldInclude) includedUserIds.add(profile.user_id);
      return shouldInclude;
    },
  );

  attendanceRows.forEach((row) => {
    if (
      adminUserIds.has(row.user_id) ||
      profilesByUser.has(row.user_id) ||
      includedUserIds.has(row.user_id)
    )
      return;
    includedUserIds.add(row.user_id);
    rows.push({
      user_id: row.user_id,
      full_name: "Former employee",
      email: "",
      department: null,
      approval_status: "removed",
      is_suspended: true,
    });
  });

  return sortByEmployeeName(rows);
}

type PrintableReportProps = {
  rows: any[];
  period: ReportPeriod;
  bsDate: string;
  date: string;
  startDate: string;
  endDate: string;
  label: string;
  monthLabel: string;
  workingDaySummary: WorkingDaySummary;
  isWeeklyOff: boolean;
  isFutureDate: boolean;
};

const PrintableReport = forwardRef<HTMLDivElement, PrintableReportProps>(function PrintableReport(
  {
    rows,
    period,
    bsDate,
    date,
    startDate,
    endDate,
    label,
    monthLabel,
    workingDaySummary,
    isWeeklyOff,
    isFutureDate,
  },
  ref,
) {
  const title =
    period === "monthly"
      ? monthLabel
      : period === "weekly"
        ? `${formatNepaliDate(startDate, "DD MMMM")} - ${formatNepaliDate(endDate, "DD MMMM YYYY")} BS`
        : bsDate;

  return (
    <div
      ref={ref}
      style={{
        width: 794,
        minHeight: 1123,
        boxSizing: "border-box",
        padding: "44px 58px",
        background: "#ffffff",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, textAlign: "center", marginTop: 24, marginRight: 40 }}>
          <div
            style={{
              fontFamily: "serif",
              fontSize: 44,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: 24,
              color: "#000000",
              whiteSpace: "nowrap",
            }}
          >
            A S L E N I X
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 12,
              color: "#000000",
              whiteSpace: "nowrap",
            }}
          >
            T E C H & S O L U T I O N
          </div>
        </div>

        <div style={{ width: 120, textAlign: "center" }}>
          <div style={{ marginBottom: 10, fontFamily: "serif", fontSize: 14, fontWeight: 700 }}>
            PAN No: 623611557
          </div>
          <img
            src={logoMarkUrl}
            alt="Logo"
            style={{ width: 88, height: 88, objectFit: "contain", margin: "0 auto" }}
          />
          <div
            style={{
              color: "#1065F5",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            ASLENIX
          </div>
        </div>
      </div>

      <div
        style={{
          borderBottom: "1.5px solid #000000",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 24,
          padding: "0 8px 8px",
          fontFamily: "serif",
          fontSize: 14,
          fontWeight: 700,
          color: "#000000",
        }}
      >
        <div>Reg No: 391840/82/83</div>
        <div>DATE: {formatBsInput()}</div>
      </div>

      <div style={{ marginTop: 28, marginBottom: 18, textAlign: "center" }}>
        <h2
          style={{
            display: "inline-block",
            margin: 0,
            borderBottom: "2px solid #111827",
            fontSize: 19,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          ATTENDANCE OF {title}
        </h2>
      </div>

      {period === "monthly" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {[
            ["Calendar Days", workingDaySummary.calendarDays],
            ["Weekly Holidays", workingDaySummary.weeklyHolidays],
            ["Public Holidays", workingDaySummary.publicHolidays],
            ["Company Holidays", workingDaySummary.companyHolidays],
            ["Working Days", workingDaySummary.workingDays],
          ].map(([summaryLabel, value]) => (
            <div
              key={summaryLabel}
              style={{
                border: "1px solid #d1d5db",
                padding: "8px 7px",
                minHeight: 52,
              }}
            >
              <div
                style={{
                  color: "#4b5563",
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                {summaryLabel}
              </div>
              <div style={{ marginTop: 5, fontSize: 20, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {period === "weekly" || period === "monthly" ? (
        <PrintableAggregateTable
          rows={rows}
          period={period}
          startDate={startDate}
          endDate={endDate}
          label={label}
          summary={workingDaySummary}
        />
      ) : (
        <PrintableDailyTable
          rows={rows}
          date={date}
          isWeeklyOff={isWeeklyOff}
          isFutureDate={isFutureDate}
        />
      )}
    </div>
  );
});

const pdfThStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #d1d5db",
  color: "#374151",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.3,
  textAlign: "left" as const,
  textTransform: "uppercase" as const,
};

const pdfTdStyle = {
  padding: "10px 8px",
  borderBottom: "1px solid #e5e7eb",
  color: "#111827",
  fontSize: 10,
  lineHeight: 1.35,
  verticalAlign: "middle" as const,
};

function PrintableDailyTable({
  rows,
  date,
  isWeeklyOff,
  isFutureDate,
}: {
  rows: any[];
  date: string;
  isWeeklyOff: boolean;
  isFutureDate: boolean;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ ...pdfThStyle, width: "16%" }}>Date</th>
          <th style={{ ...pdfThStyle, width: "17%" }}>Employee</th>
          <th style={{ ...pdfThStyle, width: "15%" }}>Department</th>
          <th style={{ ...pdfThStyle, width: "8%" }}>In</th>
          <th style={{ ...pdfThStyle, width: "8%" }}>Out</th>
          <th style={{ ...pdfThStyle, width: "13%" }}>Location</th>
          <th style={{ ...pdfThStyle, width: "9%" }}>Hours</th>
          <th style={{ ...pdfThStyle, width: "14%" }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const attendance = row.attendance;
          return (
            <tr key={row.user_id}>
              <td style={pdfTdStyle}>{formatNepaliDate(date, "ddd DD, MMMM YYYY")} BS</td>
              <td style={{ ...pdfTdStyle, fontWeight: 700 }}>{row.full_name || "-"}</td>
              <td style={pdfTdStyle}>{row.department || "-"}</td>
              <td style={pdfTdStyle}>
                {attendance?.check_in_time ? format(new Date(attendance.check_in_time), "HH:mm") : "-"}
              </td>
              <td style={pdfTdStyle}>
                {attendance?.check_out_time
                  ? format(new Date(attendance.check_out_time), "HH:mm")
                  : "-"}
              </td>
              <td style={pdfTdStyle}>{attendance?.work_location || "-"}</td>
              <td style={pdfTdStyle}>
                {attendance?.work_hours ? formatWorkHours(attendance.work_hours) : "-"}
              </td>
              <td style={pdfTdStyle}>
                {dailyStatusLabel(attendance, isWeeklyOff, isFutureDate)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PrintableAggregateTable({
  rows,
  period,
  startDate,
  endDate,
  label,
  summary,
}: {
  rows: any[];
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  label: string;
  summary: WorkingDaySummary;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
        <tr>
          <th style={{ ...pdfThStyle, width: "15%" }}>{period === "monthly" ? "Month" : "Week"}</th>
          <th style={{ ...pdfThStyle, width: "14%" }}>Employee</th>
          <th style={{ ...pdfThStyle, width: "10%" }}>Department</th>
          <th style={{ ...pdfThStyle, width: "7%" }}>Present</th>
          <th style={{ ...pdfThStyle, width: "7%" }}>Absent</th>
          <th style={{ ...pdfThStyle, width: "6%" }}>Late</th>
          <th style={{ ...pdfThStyle, width: "8%" }}>Early</th>
          <th style={{ ...pdfThStyle, width: "7%" }}>Leave</th>
          <th style={{ ...pdfThStyle, width: "6%" }}>WFH</th>
          <th style={{ ...pdfThStyle, width: "8%" }}>Working</th>
          <th style={{ ...pdfThStyle, width: "7%" }}>Att %</th>
          <th style={{ ...pdfThStyle, width: "5%" }}>Hours</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.user_id}>
            <td style={pdfTdStyle}>
              {period === "monthly"
                ? `${label} BS`
                : `${formatNepaliDate(startDate, "DD MMMM")} - ${formatNepaliDate(endDate, "DD MMMM YYYY")} BS`}
            </td>
            <td style={{ ...pdfTdStyle, fontWeight: 700 }}>{row.full_name || "-"}</td>
            <td style={pdfTdStyle}>{row.department || "-"}</td>
            <td style={pdfTdStyle}>{row.presentDays}</td>
            <td style={pdfTdStyle}>{row.absentDays}</td>
            <td style={pdfTdStyle}>{row.lateDays}</td>
            <td style={pdfTdStyle}>{row.earlyCheckoutDays}</td>
            <td style={pdfTdStyle}>{row.leaveDays}</td>
            <td style={pdfTdStyle}>{row.wfhDays}</td>
            <td style={pdfTdStyle}>{row.totalWorkingDays ?? summary.workingDays}</td>
            <td style={pdfTdStyle}>{row.attendancePercentage}%</td>
            <td style={pdfTdStyle}>{formatWorkHours(row.totalHours)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WorkingDaySummaryCard({ summary }: { summary: WorkingDaySummary }) {
  const items = [
    ["Calendar Days", summary.calendarDays],
    ["Weekly Holidays", summary.weeklyHolidays],
    ["Public Holidays", summary.publicHolidays],
    ["Company Holidays", summary.companyHolidays],
    ["Working Days", summary.workingDays],
  ];

  return (
    <GlassCard className="mb-5 print:mb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/60 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function AggregateReportTable({
  rows,
  startDate,
  endDate,
  label,
  period,
  summary,
}: {
  rows: any[];
  startDate: string;
  endDate: string;
  label: string;
  period: ReportPeriod;
  summary: WorkingDaySummary;
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
            <th className="p-3">Working days</th>
            <th className="p-3">Attendance %</th>
            <th className="p-3">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.user_id} className="border-b border-border/40 hover:bg-muted/20">
              <td className="p-3">
                {period === "monthly"
                  ? `${label} BS`
                  : `${formatNepaliDate(startDate, "DD MMMM")} - ${formatNepaliDate(endDate, "DD MMMM YYYY")} BS`}
              </td>
              <td className="p-3 font-medium">{row.full_name || "—"}</td>
              <td className="p-3 text-muted-foreground">{row.department || "—"}</td>
              <td className="p-3 tabular-nums">{row.presentDays}</td>
              <td className="p-3 tabular-nums">{row.absentDays}</td>
              <td className="p-3 tabular-nums">{row.lateDays}</td>
              <td className="p-3 tabular-nums">{row.earlyCheckoutDays}</td>
              <td className="p-3 tabular-nums">{row.leaveDays}</td>
              <td className="p-3 tabular-nums">{row.wfhDays}</td>
              <td className="p-3 tabular-nums">{row.totalWorkingDays ?? summary.workingDays}</td>
              <td className="p-3 tabular-nums">{row.attendancePercentage}%</td>
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

function isCompanyHoliday(holiday: any) {
  const scope = String(
    holiday?.scope ?? holiday?.type ?? holiday?.category ?? holiday?.holiday_type ?? "",
  ).toLowerCase();
  return scope === "company" || scope === "organization" || scope === "organisation";
}
