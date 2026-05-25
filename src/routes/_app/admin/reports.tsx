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
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
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
            if (statusFilter === "absent") return !row.attendance;
            if (statusFilter === "late") return row.attendance?.is_late;
            if (statusFilter === "early_checkout") return row.attendance?.is_early_checkout;
            return row.attendance?.status === statusFilter;
          }),
    );
    setLoading(false);
  };

  useEffect(() => {
    run();
  }, []);

  const exportCSV = () => {
    const header = [
      "Date",
      "Employee",
      "Email",
      "Department",
      "Check-in",
      "Check-out",
      "Hours",
      "Status",
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
        attendance?.work_hours ?? "",
        attendance ? attendanceLabel(attendance) : "Absent",
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
    a.download = `aslenix-attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Generate, filter and export attendance reports for a selected day"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <div className="text-center py-16 text-muted-foreground">No records for this day.</div>
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
                  <th className="p-3">Hours</th>
                  <th className="p-3">Status</th>
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
                      <td className="p-3 tabular-nums">
                        {attendance?.work_hours
                          ? `${Number(attendance.work_hours).toFixed(2)}h`
                          : "—"}
                      </td>
                      <td className="p-3">
                        <span className="capitalize text-xs">
                          {attendance
                            ? attendanceLabel(attendance)
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
