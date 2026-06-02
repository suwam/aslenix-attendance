import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  History,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
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

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StandupMetric label="Standups (7d)" value={history.length} icon={Calendar} tone="blue" />
        <StandupMetric
          label="Avg hours"
          value={formatWorkHours(
            history.reduce((a, h) => a + Number(h.work_hours || 0), 0) /
              Math.max(1, history.length),
          )}
          icon={Clock}
          tone="green"
        />
        <StandupMetric
          label="With blockers"
          value={history.filter((h) => h.blockers && h.blockers.trim()).length}
          icon={AlertTriangle}
          tone="amber"
        />
        <StandupMetric
          label="Today logged"
          value={today || yesterday ? "Yes" : "No"}
          icon={CheckCircle2}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <GlassCard className="overflow-hidden border-white/10 bg-white/[0.025] p-0">
          <div className="border-b border-white/10 bg-white/[0.025] px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <ClipboardList size={15} />
                  Engineering update
                </div>
                <h2 className="text-xl font-bold text-white">Today's standup report</h2>
              </div>
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {format(new Date(`${date}T00:00:00`), "EEE, MMM d")}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <StandupField
              icon={CheckCircle2}
              label="Today I worked on"
              value={yesterday}
              onChange={setYesterday}
              placeholder="Wrapped up auth flow, fixed UI bugs..."
              rows={4}
            />
            <StandupField
              icon={Target}
              label="Tomorrow I plan to work on"
              value={today}
              onChange={setToday}
              placeholder="Build dashboard widgets, review PRs..."
              rows={4}
            />
            <StandupField
              icon={AlertTriangle}
              label="Blockers"
              value={blockers}
              onChange={setBlockers}
              placeholder="Waiting on design specs..."
              rows={3}
            />

            <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Work hours</Label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                    <Clock size={18} />
                  </div>
                  <Input type="text" value={formatWorkHours(hours)} readOnly className="border-0 bg-transparent px-0 text-lg font-bold shadow-none focus-visible:ring-0" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {hoursSource === "attendance"
                    ? "Auto calculated from check-in and check-out."
                    : hoursSource === "standup"
                      ? "Using previously saved hours. Check out to auto-calculate."
                      : "Check in and check out to calculate work hours."}
                </div>
              </div>
              <div className="flex items-end">
                <Button onClick={save} disabled={busy} className="neon-button h-12 w-full rounded-xl text-base">
                  <Save size={15} className="mr-2" />
                  {busy ? "Saving..." : "Save standup"}
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border-white/10 bg-white/[0.025]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Recent standups</h3>
              <p className="text-xs text-muted-foreground">Last 7 submitted updates</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-primary">
              <History size={18} />
            </div>
          </div>
          <ul className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {history.map((h) => (
              <li key={h.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-semibold text-white">
                    {format(new Date(h.date), "EEE, MMM d")}
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                    {formatWorkHours(h.work_hours)}
                  </span>
                </div>
                <div className="line-clamp-2 text-muted-foreground">
                  {h.today || h.yesterday || (
                    <span>No notes</span>
                  )}
                </div>
              </li>
            ))}
            {history.length === 0 && (
              <li className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
                <Sparkles size={20} className="mx-auto mb-2 text-primary" />
                No standups yet
              </li>
            )}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}

function StandupMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Calendar;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const colors = {
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-300",
    green: "border-success/20 bg-success/10 text-success",
    amber: "border-warning/20 bg-warning/10 text-warning",
    red: "border-primary/20 bg-primary/10 text-primary",
  };

  return (
    <GlassCard className="border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function StandupField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
}) {
  return (
    <div>
      <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-primary">
          <Icon size={14} />
        </span>
        {label}
      </Label>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-2xl border-white/10 bg-black/20 text-base leading-6"
      />
    </div>
  );
}
