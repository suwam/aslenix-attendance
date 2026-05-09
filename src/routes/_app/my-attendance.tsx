import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/my-attendance")({ component: MyAttendance });

function MyAttendance() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("attendance").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(60)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <>
      <PageHeader title="My Attendance" subtitle="Your attendance history" />
      <GlassCard className="p-0 overflow-hidden">
        {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div> :
          rows.length === 0 ? <div className="text-center py-16 text-muted-foreground">No records yet.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Date</th><th className="p-4">Check-in</th><th className="p-4">Check-out</th><th className="p-4">Hours</th><th className="p-4">Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">{format(new Date(r.date), "EEE, MMM d")}</td>
                    <td className="p-4 tabular-nums">{r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "—"}</td>
                    <td className="p-4 tabular-nums">{r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—"}</td>
                    <td className="p-4 tabular-nums">{r.work_hours ? `${Number(r.work_hours).toFixed(2)}h` : "—"}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase ${r.is_late ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>{r.is_late ? "Late" : r.status.replace("_", " ")}</span></td>
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
