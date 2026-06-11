import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardList,
  History,
  Lightbulb,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatWorkHours } from "@/lib/work-hours";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";

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
  const [bsDate, setBsDate] = useState(formatBsInput());
  const date = bsInputToAdDateString(bsDate) ?? new Date().toISOString().slice(0, 10);
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

  const isSubmitted = Boolean(yesterday.trim() || today.trim() || blockers.trim());
  const avgHistoryHours =
    history.reduce((a, h) => a + Number(h.work_hours || 0), 0) / Math.max(1, history.length);
  const blockerHistoryCount = history.filter((h) => h.blockers && h.blockers.trim()).length;
  const quality = useMemo(() => getStandupQuality(yesterday, today, blockers, hours), [yesterday, today, blockers, hours]);
  const suggestions = useMemo(
    () => getAiSuggestions(yesterday, today, blockers, hoursSource, isSubmitted),
    [yesterday, today, blockers, hoursSource, isSubmitted],
  );
  const writingSignals = useMemo(
    () => getWritingSignals(yesterday, today, blockers, hoursSource),
    [yesterday, today, blockers, hoursSource],
  );

  return (
    <>
      <PageHeader
        title="Daily Standup"
        subtitle="Submit a clear daily update with AI guidance for progress, plans, blockers, and work hours."
        actions={
          <BSDateInput
            value={bsDate}
            onChange={setBsDate}
            className="w-auto border-cyan-300/20 bg-white/5"
          />
        }
      />

      <GlassCard className="mb-6 overflow-hidden border-cyan-300/15 bg-[#07111f]/70 p-0 shadow-[0_0_42px_rgba(34,211,238,0.1)]">
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,0.14),transparent_30%)]" />
          <div className="relative grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Bot size={23} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">AI Standup Assistant</p>
                  <h2 className="text-2xl font-bold text-white">Make today's update crisp and useful</h2>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">
                Your standup should tell the team what changed, what happens next, and whether anything needs manager help.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <SummaryBadge label="Status" value={isSubmitted ? "Submitted draft" : "Pending"} tone={isSubmitted ? "green" : "amber"} />
                <SummaryBadge label="Quality" value={`${quality.score}%`} tone={quality.score >= 80 ? "green" : quality.score >= 55 ? "blue" : "amber"} />
                <SummaryBadge label="Hours source" value={hoursSource === "attendance" ? "Attendance" : hoursSource === "standup" ? "Saved" : "Waiting"} tone="blue" />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200/80">AI Quality Check</p>
                  <h3 className="mt-1 text-lg font-bold text-white">{quality.label}</h3>
                </div>
                <BrainCircuit className="text-fuchsia-200" />
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
                  style={{ width: `${quality.score}%` }}
                />
              </div>
              <ul className="mt-4 space-y-2">
                {quality.notes.map((note) => (
                  <li key={note} className="flex items-start gap-2 text-sm text-slate-300">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cyan-200" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StandupMetric label="Standups (7d)" value={history.length} icon={Calendar} tone="blue" />
        <StandupMetric
          label="Avg hours"
          value={formatWorkHours(avgHistoryHours)}
          icon={Clock}
          tone="green"
        />
        <StandupMetric
          label="With blockers"
          value={blockerHistoryCount}
          icon={AlertTriangle}
          tone="amber"
        />
        <StandupMetric
          label="Today status"
          value={isSubmitted ? "Ready" : "Pending"}
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
                  Daily execution update
                </div>
                <h2 className="text-xl font-bold text-white">Today's standup report</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`rounded-full border px-3 py-1.5 text-xs font-bold ${isSubmitted ? "border-success/25 bg-success/10 text-success" : "border-warning/25 bg-warning/10 text-warning"}`}>
                  {isSubmitted ? "Submitted" : "Pending"}
                </div>
                <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {formatNepaliDate(date, "ddd DD, MMMM YYYY")} BS
                </div>
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
              hint="Mention finished outcomes, shipped work, or measurable progress."
            />
            <StandupField
              icon={Target}
              label="Tomorrow I plan to work on"
              value={today}
              onChange={setToday}
              placeholder="Build dashboard widgets, review PRs..."
              rows={4}
              hint="Write the next clear execution step, not a vague intention."
            />
            <StandupField
              icon={AlertTriangle}
              label="Blockers"
              value={blockers}
              onChange={setBlockers}
              placeholder="Waiting on design specs..."
              rows={3}
              hint="Leave blank if nothing is blocking you. If blocked, include what help is needed."
            />

            <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Work hours</Label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
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

        <div className="space-y-6">
        <GlassCard className="border-cyan-300/15 bg-white/[0.025]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">AI writing helper</h3>
              <p className="text-xs text-muted-foreground">Limited guidance before you save</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
              <WandSparkles size={18} />
            </div>
          </div>
          <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">Readiness</div>
                <div className="mt-1 text-2xl font-black text-white">{quality.score}%</div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {quality.label}
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400"
                style={{ width: `${quality.score}%` }}
              />
            </div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {writingSignals.map((signal) => (
              <WritingSignal key={signal.label} {...signal} />
            ))}
          </div>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div key={suggestion.title} className={`flex items-start gap-3 rounded-2xl border p-3 text-sm ${suggestion.tone === "good" ? "border-success/20 bg-success/10 text-success" : suggestion.tone === "warn" ? "border-warning/20 bg-warning/10 text-warning" : "border-white/10 bg-black/20 text-slate-300"}`}>
                {suggestion.tone === "good" ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                ) : (
                  <Lightbulb size={15} className="mt-0.5 shrink-0" />
                )}
                <span>
                  <span className="block font-semibold text-white">{suggestion.title}</span>
                  <span className="mt-0.5 block leading-relaxed">{suggestion.text}</span>
                </span>
              </div>
            ))}
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
              <li key={h.id} className="group rounded-2xl border border-white/10 bg-black/20 p-4 text-sm transition-all duration-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.055]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-semibold text-white">
                    {formatNepaliDate(h.date, "ddd DD, MMMM YYYY")} BS
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
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <HistorySignal label="Today" active={Boolean(h.yesterday?.trim())} />
                  <HistorySignal label="Plan" active={Boolean(h.today?.trim())} />
                  <HistorySignal label="Blocker" active={Boolean(h.blockers?.trim())} warning />
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

function SummaryBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber";
}) {
  const colors = {
    blue: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    green: "border-success/20 bg-success/10 text-success",
    amber: "border-warning/20 bg-warning/10 text-warning",
  };

  return (
    <div className={`rounded-2xl border p-3 ${colors[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
    </div>
  );
}

function HistorySignal({ label, active, warning = false }: { label: string; active: boolean; warning?: boolean }) {
  return (
    <div
      className={`rounded-full border px-2 py-1 text-center font-semibold ${
        active
          ? warning
            ? "border-warning/25 bg-warning/10 text-warning"
            : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
          : "border-white/10 bg-white/[0.035] text-muted-foreground"
      }`}
    >
      {label}
    </div>
  );
}

function WritingSignal({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${active ? "border-cyan-300/20 bg-cyan-300/10" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${active ? "bg-success" : "bg-warning"}`} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function StandupField({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  rows,
  hint,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows: number;
  hint: string;
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
      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles size={13} className="mt-0.5 shrink-0 text-cyan-200" />
        <span>{hint}</span>
      </div>
    </div>
  );
}

function getStandupQuality(yesterday: string, today: string, blockers: string, hours: number) {
  const yesterdayWords = wordCount(yesterday);
  const todayWords = wordCount(today);
  const blockerWords = wordCount(blockers);
  let score = 20;
  const notes: string[] = [];

  if (yesterdayWords >= 5) {
    score += 25;
    notes.push("Today's completed work has enough detail.");
  } else {
    notes.push("Add one concrete completed outcome for today.");
  }

  if (todayWords >= 5) {
    score += 25;
    notes.push("Tomorrow's plan is clear enough for the team.");
  } else {
    notes.push("Add a specific next step for tomorrow.");
  }

  if (hours > 0) {
    score += 15;
    notes.push("Work hours are attached to this update.");
  } else {
    notes.push("Check in and check out to attach automatic work hours.");
  }

  if (!blockers.trim()) {
    score += 10;
    notes.push("No blocker reported.");
  } else if (blockerWords >= 4) {
    score += 10;
    notes.push("Blocker includes useful context for manager review.");
  } else {
    notes.push("Describe what help is needed for the blocker.");
  }

  score = Math.min(100, score);
  return {
    score,
    label: score >= 80 ? "Strong standup" : score >= 55 ? "Almost ready" : "Needs more detail",
    notes: notes.slice(0, 4),
  };
}

function getAiSuggestions(
  yesterday: string,
  today: string,
  blockers: string,
  hoursSource: "attendance" | "standup" | "none",
  isSubmitted: boolean,
) {
  const yesterdayWords = wordCount(yesterday);
  const todayWords = wordCount(today);
  const blockerWords = wordCount(blockers);
  const suggestions: Array<{ title: string; text: string; tone: "info" | "warn" | "good" }> = [];

  if (!isSubmitted) {
    suggestions.push({
      title: "Start the update",
      text: "Write one concrete outcome you completed today, then one priority for tomorrow.",
      tone: "warn",
    });
  }
  if (yesterdayWords > 0 && yesterdayWords < 8) {
    suggestions.push({
      title: "Add proof of progress",
      text: "Mention the deliverable, fix, campaign, meeting outcome, or measurable result.",
      tone: "info",
    });
  }
  if (todayWords > 0 && todayWords < 8) {
    suggestions.push({
      title: "Make tomorrow specific",
      text: "Name the exact task you will move first, not only the project name.",
      tone: "info",
    });
  }
  if (blockers.trim() && blockerWords < 4) {
    suggestions.push({
      title: "Clarify the blocker",
      text: "Add what is blocked, who can help, and what decision or resource is needed.",
      tone: "warn",
    });
  }
  if (!blockers.trim()) {
    suggestions.push({
      title: "Blocker status is clear",
      text: "Leaving blockers blank is fine when nothing needs manager help.",
      tone: "good",
    });
  }
  if (hoursSource === "none") {
    suggestions.push({
      title: "Hours are missing",
      text: "Check in and check out so work hours can attach automatically.",
      tone: "warn",
    });
  }
  if (yesterdayWords >= 8 && todayWords >= 8 && (blockerWords === 0 || blockerWords >= 4) && hoursSource !== "none") {
    suggestions.unshift({
      title: "Ready to save",
      text: "This standup has enough detail for progress, plan, blocker status, and hours.",
      tone: "good",
    });
  }
  return suggestions.slice(0, 4);
}

function getWritingSignals(
  yesterday: string,
  today: string,
  blockers: string,
  hoursSource: "attendance" | "standup" | "none",
) {
  const doneWords = wordCount(yesterday);
  const planWords = wordCount(today);
  const blockerWords = wordCount(blockers);

  return [
    {
      label: "Done",
      value: doneWords >= 8 ? "Clear" : doneWords > 0 ? "Needs detail" : "Missing",
      active: doneWords >= 8,
    },
    {
      label: "Plan",
      value: planWords >= 8 ? "Clear" : planWords > 0 ? "Needs detail" : "Missing",
      active: planWords >= 8,
    },
    {
      label: "Blocker",
      value: blockerWords === 0 ? "None" : blockerWords >= 4 ? "Clear" : "Too short",
      active: blockerWords === 0 || blockerWords >= 4,
    },
    {
      label: "Hours",
      value: hoursSource === "attendance" ? "Auto" : hoursSource === "standup" ? "Saved" : "Waiting",
      active: hoursSource !== "none",
    },
  ];
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}
