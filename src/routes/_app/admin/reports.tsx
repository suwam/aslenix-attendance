import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/reports")({ component: ReportsPage });

function ReportsPage() {
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Map<string, any>>(new Map());

  const run = async () => {
    setLoading(true);
    let q = supabase.from("attendance").select("*").gte("date", from).lte("date", to).order("date", { ascending: false });
    if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
    const { data } = await q;
    const ids = [...new Set((data ?? []).map((r) => r.user_id))];
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email, department").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    setProfilesMap(new Map((profs ?? []).map((p) => [p.user_id, p])));
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  const exportCSV = () => {
    const header = ["Date", "Employee", "Email", "Department", "Check-in", "Check-out", "Hours", "Status", "Late"];
    const lines = rows.map((r) => {
      const p = profilesMap.get(r.user_id);
      return [
        r.date,
        p?.full_name || "",
        p?.email || "",
        p?.department || "",
        r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "",
        r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "",
        r.work_hours ?? "",
        r.status,
        r.is_late ? "Yes" : "No",
      ].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `aslenix-attendance-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader title="Reports" subtitle="Generate, filter and export attendance reports" actions={
        <>
          <Button variant="outline" onClick={() => window.print()}><Printer size={14} className="mr-1" />Print</Button>
          <Button onClick={exportCSV} className="neon-button rounded-lg"><Download size={14} className="mr-1" />Export CSV</Button>
        </>
      } />

      <GlassCard className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><label className="text-xs text-muted-foreground">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="wfh">WFH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button onClick={run} className="w-full neon-button rounded-lg">Run report</Button></div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div> : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Date</th><th className="p-3">Employee</th><th className="p-3">Department</th><th className="p-3">In</th><th className="p-3">Out</th><th className="p-3">Hours</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const p = profilesMap.get(r.user_id);
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="p-3">{format(new Date(r.date), "MMM d, yyyy")}</td>
                      <td className="p-3 font-medium">{p?.full_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{p?.department || "—"}</td>
                      <td className="p-3 tabular-nums">{r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "—"}</td>
                      <td className="p-3 tabular-nums">{r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—"}</td>
                      <td className="p-3 tabular-nums">{r.work_hours ? `${Number(r.work_hours).toFixed(2)}h` : "—"}</td>
                      <td className="p-3"><span className="capitalize text-xs">{r.is_late ? "Late" : r.status.replace("_", " ")}</span></td>
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
