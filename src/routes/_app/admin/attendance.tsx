import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/attendance")({ component: AttendancePage });

function AttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: att }, { data: profs }] = await Promise.all([
        supabase.from("attendance").select("*").eq("date", date),
        supabase.from("profiles").select("*").eq("approval_status", "approved"),
      ]);
      const map = new Map((att ?? []).map((a) => [a.user_id, a]));
      const merged = (profs ?? []).map((p) => ({ ...p, attendance: map.get(p.user_id) }));
      setRows(merged);
      setLoading(false);
    })();
  }, [date]);

  const filtered = rows.filter(
    (r) => !search || r.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily attendance overview" />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="sm:w-48"
        />
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee…"
            className="pl-9"
          />
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Check-in</th>
                  <th className="p-4">Check-out</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div
                            className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                            style={{ background: "var(--gradient-brand)" }}
                          >
                            {r.full_name
                              ?.split(" ")
                              .map((s: string) => s[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{r.full_name}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{r.department || "—"}</td>
                    <td className="p-4 tabular-nums">
                      {r.attendance?.check_in_time
                        ? format(new Date(r.attendance.check_in_time), "HH:mm")
                        : "—"}
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.attendance?.check_out_time
                        ? format(new Date(r.attendance.check_out_time), "HH:mm")
                        : "—"}
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.attendance?.work_hours
                        ? `${Number(r.attendance.work_hours).toFixed(2)}h`
                        : "—"}
                    </td>
                    <td className="p-4">
                      <StatusPill status={r.attendance?.status} late={r.attendance?.is_late} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

function StatusPill({ status, late }: { status?: string; late?: boolean }) {
  if (!status)
    return (
      <span className="px-2 py-1 rounded-full text-[10px] font-medium uppercase bg-destructive/15 text-destructive">
        Absent
      </span>
    );
  const map: Record<string, string> = {
    present: "bg-success/15 text-success",
    late: "bg-warning/15 text-warning",
    leave: "bg-muted text-muted-foreground",
    half_day: "bg-warning/15 text-warning",
    wfh: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${map[late ? "late" : status] || "bg-muted"}`}
    >
      {late ? "Late" : status.replace("_", " ")}
    </span>
  );
}
