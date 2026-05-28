import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { AttendanceLocationLinks } from "@/components/AttendanceLocationLinks";
import { Input } from "@/components/ui/input";
import { formatWorkHours } from "@/lib/work-hours";
import { CalendarDays, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";

export const Route = createFileRoute("/_app/my-attendance")({ component: MyAttendance });

function MyAttendance() {
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isWeeklyOff = isWeeklyOffDate(date);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("date", { ascending: false })
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, [user, date]);

  return (
    <>
      <PageHeader title="My Attendance" subtitle="Your attendance for the selected day" />
      <div className="mb-5 max-w-48">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 && isWeeklyOff ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
              <CalendarDays size={22} />
            </div>
            <div className="text-lg font-semibold text-accent">{WEEKLY_OFF_LABEL}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Saturday is weekly off. No attendance record is required.
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Date</th>
                  <th className="p-4">Check-in</th>
                  <th className="p-4">Check-out</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">{format(new Date(r.date), "EEE, MMM d")}</td>
                    <td className="p-4 tabular-nums">
                      {r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "—"}
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—"}
                    </td>
                    <td className="p-4">
                      <AttendanceLocationLinks
                        checkInLatitude={r.check_in_latitude}
                        checkInLongitude={r.check_in_longitude}
                        checkInAccuracyMeters={r.check_in_accuracy_meters}
                        checkOutLatitude={r.check_out_latitude}
                        checkOutLongitude={r.check_out_longitude}
                        checkOutAccuracyMeters={r.check_out_accuracy_meters}
                      />
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.work_hours ? formatWorkHours(r.work_hours) : "—"}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase ${
                          r.is_early_checkout
                            ? "bg-warning/15 text-warning"
                            : r.is_late
                              ? "bg-warning/15 text-warning"
                              : "bg-success/15 text-success"
                        }`}
                      >
                        {r.is_early_checkout
                          ? "Early checkout"
                          : r.is_late
                            ? "Late"
                            : r.status.replace("_", " ")}
                      </span>
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
