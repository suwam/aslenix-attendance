import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatWorkHours } from "@/lib/work-hours";

export const Route = createFileRoute("/_app/standup")({ component: StandupPage });

function getAttendanceHours(
  attendance?: { check_in_time: string | null; check_out_time: string | null; work_hours: number | null } | null,
) {
  if (!attendance?.check_in_time || !attendance.check_out_time) return null;
  if (attendance.work_hours !== null && attendance.work_hours !== undefined) {
    return Number(attendance.work_hours);
  }

  const checkedInAt = new Date(attendance.check_in_time);
  const checkedOutAt = new Date(attendance.check_out_time);
  if (Number.isNaN(checkedInAt.getTime()) || Number.isNaN(checkedOutAt.getTime())) return null;

  return Math.max(0, (checkedOutAt.getTime() - checkedInAt.getTime()) / 36e5);
}

function StandupPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [hoursSource, setHoursSource] = useState<"attendance" | "standup" | "none">("none");
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data }, { data: attendance }] = await Promise.all([
      supabase
        .from("standups")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("attendance")
        .select("check_in_time, check_out_time, work_hours")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle(),
    ]);
    setYesterday(data?.yesterday || "");
    setToday(data?.today || "");
    setBlockers(data?.blockers || "");
    const attendanceHours = getAttendanceHours(attendance);
    if (attendanceHours !== null) {
      setHours(attendanceHours);
      setHoursSource("attendance");
    } else if (data?.work_hours) {
      setHours(Number(data.work_hours));
      setHoursSource("standup");
    } else {
      setHours(0);
      setHoursSource("none");
    }
    const { data: hist } = await supabase
      .from("standups")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(7);
    setHistory(hist || []);
  }, [user, date]);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { data: attendance } = await supabase
      .from("attendance")
      .select("check_in_time, check_out_time, work_hours")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    const calculatedHours = getAttendanceHours(attendance) ?? hours;
    const { error } = await supabase.from("standups").upsert(
      {
        user_id: user.id,
        date,
        yesterday,
        today,
        blockers,
        work_hours: calculatedHours,
      },
      { onConflict: "user_id,date" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Standup saved");
    load();
  };

  return (
    <>
      <PageHeader
        title="Daily Standup"
        subtitle="Share what you worked on today, what you'll work on tomorrow, and what's blocking you"
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Standups (7d)" value={history.length} icon={Calendar} accent="blue" />
        <StatCard
          label="Avg hours"
          value={formatWorkHours(
            history.reduce((a, h) => a + Number(h.work_hours || 0), 0) /
              Math.max(1, history.length),
          )}
          icon={Clock}
          accent="green"
        />
        <StatCard
          label="With blockers"
          value={history.filter((h) => h.blockers && h.blockers.trim()).length}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Today logged"
          value={today || yesterday ? "Yes" : "No"}
          icon={CheckCircle2}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 space-y-4">
          <div>
            <Label>Today I worked on</Label>
            <Textarea
              rows={4}
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              placeholder="Wrapped up auth flow, fixed UI bugs…"
            />
          </div>
          <div>
            <Label>Tomorrow I plan to work on</Label>
            <Textarea
              rows={4}
              value={today}
              onChange={(e) => setToday(e.target.value)}
              placeholder="Build dashboard widgets, review PRs…"
            />
          </div>
          <div>
            <Label>Blockers</Label>
            <Textarea
              rows={3}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Waiting on design specs…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Work hours</Label>
              <Input
                type="text"
                value={formatWorkHours(hours)}
                readOnly
              />
              <div className="mt-1 text-xs text-muted-foreground">
                {hoursSource === "attendance"
                  ? "Auto calculated from check-in and check-out."
                  : hoursSource === "standup"
                    ? "Using previously saved hours. Check out to auto-calculate."
                    : "Check in and check out to calculate work hours."}
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={save} disabled={busy} className="neon-button w-full rounded-xl">
                <Save size={14} className="mr-1.5" />
                Save standup
              </Button>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Recent standups</h3>
          <ul className="space-y-3 max-h-[420px] overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-sm border-l-2 border-primary/40 pl-3">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(h.date), "EEE, MMM d")}
                </div>
                <div className="line-clamp-2 mt-1">
                  {h.today || h.yesterday || (
                    <span className="text-muted-foreground">No notes</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {formatWorkHours(h.work_hours)} logged
                </div>
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-sm text-muted-foreground">No standups yet</li>
            )}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
