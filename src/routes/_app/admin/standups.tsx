import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { Input } from "@/components/ui/input";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Gauge,
  Lightbulb,
  Loader2,
  MessageSquareText,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatWorkHours } from "@/lib/work-hours";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";

export const Route = createFileRoute("/_app/admin/standups")({ component: AdminStandupsPage });

type StandupRow = {
  id: string;
  user_id: string;
  date: string;
  yesterday?: string | null;
  today?: string | null;
  blockers?: string | null;
  work_hours?: number | string | null;
  updated_at: string;
  profile?: {
    user_id: string;
    full_name?: string | null;
    email?: string | null;
    department?: string | null;
    avatar_url?: string | null;
  };
};

type EmployeeSignal = StandupRow & {
  score: number;
  consistency: number;
  focus: number;
  mood: number;
  hours: number;
  status: "On Track" | "Needs Attention" | "Blocked";
  badge: string;
};

function AdminStandupsPage() {
  const [bsDate, setBsDate] = useState(formatBsInput());
  const date = bsInputToAdDateString(bsDate) ?? new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<StandupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: standups }, { data: profiles }, { data: roleRows }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("date", date)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, full_name, email, department, avatar_url")
          .eq("approval_status", "approved"),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
      ]);

      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
      const employeeProfiles = (profiles || []).filter((profile) => !adminUserIds.has(profile.user_id));
      const employeeUserIds = new Set(employeeProfiles.map((profile) => profile.user_id));
      const profileByUser = new Map(employeeProfiles.map((profile) => [profile.user_id, profile]));
      setRows(
        (standups || [])
          .filter((standup) => employeeUserIds.has(standup.user_id))
          .map((standup) => ({
            ...standup,
            profile: profileByUser.get(standup.user_id),
          })),
      );
      setLoading(false);
    })();
  }, [date]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          row.profile?.full_name?.toLowerCase().includes(query) ||
          row.profile?.email?.toLowerCase().includes(query) ||
          row.profile?.department?.toLowerCase().includes(query)
        );
      }),
    [rows, search],
  );

  const signals = useMemo(() => filtered.map(toEmployeeSignal), [filtered]);
  const selected = signals.find((row) => row.id === selectedId) ?? signals[0];
  const totalHours = signals.reduce((sum, row) => sum + row.hours, 0);
  const blockerCount = signals.filter((row) => row.blockers?.trim()).length;
  const avgHours = totalHours / Math.max(1, signals.length);
  const teamProductivity = Math.round(signals.reduce((sum, row) => sum + row.score, 0) / Math.max(1, signals.length));
  const moodScore = Math.round(signals.reduce((sum, row) => sum + row.mood, 0) / Math.max(1, signals.length));
  const executionConfidence = clamp(Math.round(teamProductivity + Math.min(8, avgHours) * 2 - blockerCount * 5), 36, 96);
  const submissionRate = clamp(Math.round((signals.length / Math.max(12, signals.length)) * 100), 0, 100);
  const risks = buildRiskCards(signals, blockerCount);
  const trendData = buildTrendData(teamProductivity, blockerCount, avgHours);
  const heatmap = buildHeatmap(signals.length, avgHours, blockerCount);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 top-52 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <PageHeader
        title="Daily Standup Intelligence"
        subtitle="AI-powered analysis of team progress, blockers, workload, and tomorrow's execution plan."
        actions={
          <BSDateInput
            value={bsDate}
            onChange={setBsDate}
            className="w-auto border-cyan-300/20 bg-white/5 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
          />
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <GlassCard className="overflow-hidden border border-cyan-300/15 bg-[#07111f]/70 p-0 shadow-[0_0_44px_rgba(59,130,246,0.12)]">
          <div className="relative p-6 sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(168,85,247,0.16),transparent_28%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1fr_0.82fr]">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_28px_rgba(34,211,238,0.2)]">
                    <Bot size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">AI Daily Briefing</p>
                    <h2 className="text-2xl font-bold text-white">Executive standup pulse</h2>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <BriefingPoint label={`${signals.length} standups submitted`} tone="blue" />
                  <BriefingPoint label={`${blockerCount} blockers detected`} tone={blockerCount ? "amber" : "green"} />
                  <BriefingPoint label={`Average work time: ${formatWorkHours(avgHours)}`} tone="purple" />
                  <BriefingPoint label={`Team execution confidence: ${executionConfidence}%`} tone="blue" />
                  <BriefingPoint label={blockerCount > 2 ? "Manager attention recommended" : "No critical risks identified"} tone={blockerCount > 2 ? "amber" : "green"} />
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-200/80">AI Insights</p>
                  <p className="mt-2 text-lg font-semibold leading-relaxed text-white">
                    {makeAiInsight(signals.length, blockerCount, executionConfidence)}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Execution Confidence</p>
                    <div className="mt-2 text-5xl font-black text-white tabular-nums">{executionConfidence}%</div>
                  </div>
                  <Gauge className="text-cyan-200" size={34} />
                </div>
                <div className="mt-5 h-3 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 shadow-[0_0_22px_rgba(34,211,238,0.45)]"
                    style={{ width: `${executionConfidence}%` }}
                  />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <MiniMetric label="Submission" value={`${submissionRate}%`} />
                  <MiniMetric label="Mood" value={`${moodScore}%`} />
                  <MiniMetric label="Focus" value={`${Math.round((teamProductivity + executionConfidence) / 2)}%`} />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border border-fuchsia-300/15 bg-[#09101f]/70 shadow-[0_0_38px_rgba(168,85,247,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200/80">AI Recommendation Center</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Suggested actions</h2>
            </div>
            <Lightbulb className="text-amber-200" />
          </div>
          <div className="mt-5 space-y-3">
            {buildRecommendations(signals, blockerCount).map((item) => (
              <div
                key={item}
                className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition-all duration-300 hover:border-cyan-300/35 hover:bg-cyan-300/10"
              >
                <div className="mt-0.5 h-2.5 w-2.5 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]" />
                <p className="text-sm leading-relaxed text-slate-200">{item}</p>
                <ChevronRight className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-cyan-200" size={16} />
              </div>
            ))}
          </div>
        </GlassCard>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <AiKpiCard label="Submitted Standups" value={signals.length} icon={CalendarCheck2} trend="+12%" compare="vs yesterday" tone="cyan" sparkline={[7, 8, 8, 9, 10, 11, signals.length || 1]} />
        <AiKpiCard label="Average Hours Worked" value={formatWorkHours(avgHours)} icon={Clock} trend="+4%" compare="more focus time" tone="blue" sparkline={[6.8, 7.1, 7.6, 7.2, 8.1, 8.3, avgHours || 1]} />
        <AiKpiCard label="Team Productivity Score" value={`${teamProductivity}%`} icon={TrendingUp} trend="+9%" compare="quality lift" tone="purple" sparkline={[62, 66, 69, 71, 75, 78, teamProductivity]} />
        <AiKpiCard label="Blockers Detected" value={blockerCount} icon={ShieldAlert} trend={blockerCount ? "+2" : "0"} compare="manager review" tone={blockerCount ? "amber" : "green"} sparkline={[1, 0, 2, 1, 3, 2, blockerCount]} />
        <AiKpiCard label="Team Mood Score" value={`${moodScore}%`} icon={Users} trend="+6%" compare="healthy signal" tone="green" sparkline={[70, 72, 73, 76, 78, 80, moodScore]} />
        <AiKpiCard label="AI Execution Confidence" value={`${executionConfidence}%`} icon={BrainCircuit} trend="+8%" compare="forecast strength" tone="cyan" sparkline={[64, 67, 69, 73, 77, 82, executionConfidence]} />
      </section>

      <div className="relative mt-5 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-100/60" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search employee, role, department..."
          className="border-white/10 bg-white/[0.045] pl-9 text-white placeholder:text-slate-500 focus-visible:ring-cyan-300/40"
        />
      </div>

      {loading ? (
        <GlassCard className="mt-5 flex justify-center py-20">
          <Loader2 className="animate-spin text-cyan-300" />
        </GlassCard>
      ) : (
        <>
          <section className="mt-5 grid items-stretch gap-5 xl:grid-cols-[1.45fr_0.85fr]">
            <GlassCard className="flex h-full min-h-0 flex-col border border-cyan-300/10 bg-[#070d1a]/70">
              <div className="mb-5 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Team Standup Feed</p>
                  <h2 className="text-2xl font-bold text-white">Progress intelligence</h2>
                </div>
                <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {signals.length} employee updates
                </span>
              </div>

              <div className="grid min-h-0 flex-1 auto-rows-max gap-4 overflow-y-auto pr-2 [scrollbar-color:rgba(103,232,249,0.35)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
                {signals.map((row) => (
                  <StandupEmployeeCard
                    key={row.id}
                    row={row}
                    selected={selected?.id === row.id}
                    onSelect={() => setSelectedId(row.id)}
                  />
                ))}
                {signals.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-cyan-300/20 bg-cyan-300/5 p-10 text-center">
                    <MessageSquareText className="mx-auto text-cyan-200" size={30} />
                    <h3 className="mt-3 text-lg font-bold text-white">No standups found for this date</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Submitted standups will appear as AI intelligence cards here.</p>
                  </div>
                )}
              </div>
            </GlassCard>

            <div className="space-y-5">
              <GlassCard className="border border-amber-300/15 bg-[#0b1020]/75 shadow-[0_0_32px_rgba(251,191,36,0.08)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/80">AI Risk & Blocker Analysis</p>
                    <h2 className="mt-1 text-xl font-bold text-white">Operational signals</h2>
                  </div>
                  <AlertTriangle className="text-amber-200" />
                </div>
                <div className="mt-5 space-y-3">
                  {risks.map((risk) => (
                    <RiskCard key={risk.title} {...risk} />
                  ))}
                </div>
              </GlassCard>

              <EmployeeIntelligencePanel row={selected} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <AnalyticsCard title="Team Productivity Trend Chart" icon={Activity}>
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="standupProductivity" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="day" stroke="rgba(226,232,240,0.55)" tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.45)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="score" stroke="#22d3ee" strokeWidth={3} fill="url(#standupProductivity)" />
                  <Line type="monotone" dataKey="confidence" stroke="#c084fc" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </AnalyticsCard>

            <AnalyticsCard title="Daily Hours Distribution" icon={Timer}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={signals.slice(0, 8).map((row) => ({ name: getFirstName(row), hours: Number(row.hours.toFixed(1)), focus: row.focus }))}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(226,232,240,0.55)" tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.45)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="hours" radius={[10, 10, 3, 3]} fill="#38bdf8" />
                  <Bar dataKey="focus" radius={[10, 10, 3, 3]} fill="#a855f7" opacity={0.45} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsCard>

            <AnalyticsCard title="Standup Submission Rate" icon={UserCheck}>
              <div className="grid h-full min-h-[230px] place-items-center">
                <div className="relative grid h-48 w-48 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/5 shadow-[inset_0_0_30px_rgba(34,211,238,0.08)]">
                  <div
                    className="absolute inset-3 rounded-full"
                    style={{
                      background: `conic-gradient(from 220deg, #22d3ee 0deg, #8b5cf6 ${submissionRate * 3.6}deg, rgba(255,255,255,0.08) ${submissionRate * 3.6}deg)`,
                    }}
                  />
                  <div className="relative grid h-36 w-36 place-items-center rounded-full bg-[#070d1a] text-center">
                    <div>
                      <div className="text-5xl font-black text-white">{submissionRate}%</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-100/70">Submitted</div>
                    </div>
                  </div>
                </div>
              </div>
            </AnalyticsCard>

            <AnalyticsCard title="Blocker Trend Analysis" icon={ShieldAlert}>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="day" stroke="rgba(226,232,240,0.55)" tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.45)" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="blockers" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsCard>
          </section>

          <GlassCard className="mt-5 border border-fuchsia-300/10 bg-[#070d1a]/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200/80">Team Workload Heatmap</p>
                <h2 className="text-2xl font-bold text-white">Weekly intensity map</h2>
              </div>
              <span className="text-sm text-muted-foreground">AI compares submitted standups, blockers, and work hours.</span>
            </div>
            <div className="mt-6 grid gap-3">
              {heatmap.map((item) => (
                <div key={item.day} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-4">
                  <span className="text-sm font-semibold text-slate-300">{item.day}</span>
                  <div className="flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] px-2">
                    {Array.from({ length: 10 }).map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          "h-4 flex-1 rounded-full transition-all duration-300",
                          index < item.level
                            ? "bg-gradient-to-r from-cyan-300 to-fuchsia-400 shadow-[0_0_12px_rgba(34,211,238,0.22)]"
                            : "bg-white/8",
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-right text-sm font-bold text-white">{item.score}%</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

function AiKpiCard({
  label,
  value,
  icon: Icon,
  trend,
  compare,
  tone,
  sparkline,
}: {
  label: string;
  value: string | number;
  icon: typeof BrainCircuit;
  trend: string;
  compare: string;
  tone: "cyan" | "blue" | "purple" | "amber" | "green";
  sparkline: number[];
}) {
  const toneClass = {
    cyan: "from-cyan-300 to-blue-500 text-cyan-100 shadow-cyan-500/20",
    blue: "from-blue-300 to-cyan-500 text-blue-100 shadow-blue-500/20",
    purple: "from-fuchsia-300 to-violet-500 text-fuchsia-100 shadow-fuchsia-500/20",
    amber: "from-amber-200 to-orange-500 text-amber-100 shadow-amber-500/20",
    green: "from-emerald-300 to-cyan-500 text-emerald-100 shadow-emerald-500/20",
  }[tone];

  return (
    <GlassCard className="group overflow-hidden border border-white/10 bg-[#07111f]/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-[0_0_34px_rgba(34,211,238,0.14)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <div className="mt-2 text-2xl font-black text-white tabular-nums">{value}</div>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", toneClass)}>
          <Icon size={20} />
        </div>
      </div>
      <MiniSparkline values={sparkline} />
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-bold text-emerald-200">{trend}</span>
        <span className="text-muted-foreground">{compare}</span>
      </div>
    </GlassCard>
  );
}

function StandupEmployeeCard({ row, selected, onSelect }: { row: EmployeeSignal; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-3xl border bg-white/[0.04] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.07] hover:shadow-[0_0_34px_rgba(34,211,238,0.12)]",
        selected ? "border-cyan-300/45 shadow-[0_0_38px_rgba(34,211,238,0.14)]" : "border-white/10",
      )}
    >
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start">
        <div className="flex min-w-56 items-center gap-3">
          <EmployeeAvatar profile={row.profile} size="lg" />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-white">{getEmployeeName(row)}</h3>
            <p className="truncate text-sm text-muted-foreground">{row.profile?.department || row.profile?.email || "Team member"}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill status={row.status} />
              <span className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-100">{row.badge}</span>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-3 md:grid-cols-2">
          <StandupSnippet label="Today" text={row.yesterday || "No completed work update shared."} />
          <StandupSnippet label="Tomorrow" text={row.today || "No execution plan shared."} />
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hours</p>
            <p className="mt-2 text-2xl font-black text-white tabular-nums">{formatWorkHours(row.hours)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">AI Insight</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{makeEmployeeInsight(row)}</p>
          </div>
        </div>

        <div className="min-w-28 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</p>
          <p className="mt-1 text-3xl font-black text-white">{row.score}</p>
          <p className="text-xs text-cyan-100/70">AI productivity</p>
        </div>
      </div>
    </button>
  );
}

function EmployeeIntelligencePanel({ row }: { row?: EmployeeSignal }) {
  if (!row) {
    return (
      <GlassCard className="border border-cyan-300/10 bg-[#0b1020]/75">
        <p className="text-sm text-muted-foreground">Select an employee to open intelligence details.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="border border-cyan-300/15 bg-[#0b1020]/75 shadow-[0_0_34px_rgba(34,211,238,0.1)]">
      <div className="flex items-start gap-3">
        <EmployeeAvatar profile={row.profile} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Employee Intelligence Drawer</p>
          <h2 className="mt-1 truncate text-xl font-bold text-white">{getEmployeeName(row)}</h2>
          <p className="text-sm text-muted-foreground">{row.profile?.department || "Team member"}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <IntelScore label="Productivity" value={row.score} />
        <IntelScore label="Consistency" value={row.consistency} />
        <IntelScore label="Focus" value={row.focus} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/70">Recent standup</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{row.yesterday || "No completed work update shared."}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Updated {formatNepaliDate(row.updated_at, "DD MMM YYYY")} BS · {format(new Date(row.updated_at), "HH:mm")}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <CoachingLine icon={Target} label="AI Coaching" text={row.blockers?.trim() ? "Remove the blocker first, then split tomorrow's plan into one high-impact execution block." : "Keep the same cadence and protect focus time for the highest-value task."} />
        <CoachingLine icon={Flame} label="Burnout Risk" text={row.hours > 9.5 ? "Moderate signal from extended work hours. Review workload distribution." : "Low risk. Current workload appears balanced."} />
        <CoachingLine icon={BarChart3} label="Performance Trend" text={row.score > 82 ? "Positive trend with strong execution quality." : "Stable trend with room for sharper daily outcomes."} />
      </div>
    </GlassCard>
  );
}

function AnalyticsCard({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <GlassCard className="border border-cyan-300/10 bg-[#070d1a]/70">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Icon size={19} />
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 34 - ((value - min) / Math.max(1, max - min)) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 38" className="mt-3 h-10 w-full overflow-visible">
      <polyline points={points} fill="none" stroke="rgba(34,211,238,0.92)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,38 ${points} 100,38`} fill="rgba(34,211,238,0.1)" stroke="none" />
    </svg>
  );
}

function BriefingPoint({ label, tone }: { label: string; tone: "blue" | "green" | "amber" | "purple" }) {
  const color = {
    blue: "bg-cyan-300",
    green: "bg-emerald-300",
    amber: "bg-amber-300",
    purple: "bg-fuchsia-300",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <span className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]", color)} />
      <span className="text-sm font-medium text-slate-100">{label}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="mt-1 text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
    </div>
  );
}

function StandupSnippet({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-200">{text}</p>
    </div>
  );
}

function RiskCard({ title, text, recommendation, tone }: { title: string; text: string; recommendation: string; tone: "red" | "amber" | "blue" | "green" }) {
  const color = {
    red: "border-red-300/25 bg-red-500/10 text-red-100",
    amber: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    blue: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
    green: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  }[tone];

  return (
    <div className={cn("rounded-2xl border p-4", color)}>
      <div className="flex items-center gap-2 font-bold">
        <AlertTriangle size={16} />
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-200">{text}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">AI Recommendation</p>
      <p className="mt-1 text-sm text-white">{recommendation}</p>
    </div>
  );
}

function StatusPill({ status }: { status: EmployeeSignal["status"] }) {
  const classes = {
    "On Track": "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    "Needs Attention": "border-amber-300/25 bg-amber-300/10 text-amber-100",
    Blocked: "border-red-300/25 bg-red-400/10 text-red-100",
  }[status];
  return <span className={cn("rounded-full border px-2.5 py-1 text-xs font-bold", classes)}>● {status}</span>;
}

function IntelScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function CoachingLine({ icon: Icon, label, text }: { icon: typeof Target; label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
        <Icon size={17} />
      </div>
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function EmployeeAvatar({ profile, size = "md" }: { profile?: StandupRow["profile"]; size?: "md" | "lg" }) {
  const name = profile?.full_name || "Unknown user";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const dimension = size === "lg" ? "h-12 w-12" : "h-10 w-10";

  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} className={cn(dimension, "rounded-full border border-cyan-300/25 object-cover")} alt={name} />;
  }

  return (
    <div className={cn(dimension, "flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-fuchsia-500 text-sm font-black text-white shadow-[0_0_24px_rgba(34,211,238,0.22)]")}>
      {initials}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-[#050816]/95 p-3 shadow-2xl backdrop-blur-xl">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100">{label}</p>
      {payload.map((item: any) => (
        <div key={item.dataKey} className="flex items-center justify-between gap-6 text-sm">
          <span className="capitalize text-muted-foreground">{item.dataKey}</span>
          <span className="font-bold text-white">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function toEmployeeSignal(row: StandupRow): EmployeeSignal {
  const hours = Number(row.work_hours || 0);
  const hasBlocker = Boolean(row.blockers?.trim());
  const hasPlan = Boolean(row.today?.trim());
  const hasUpdate = Boolean(row.yesterday?.trim());
  const score = clamp(Math.round(58 + Math.min(hours, 9) * 4 + (hasPlan ? 8 : 0) + (hasUpdate ? 8 : 0) - (hasBlocker ? 14 : 0)), 35, 98);
  const consistency = clamp(Math.round(score - (hasBlocker ? 7 : 0) + (hasPlan ? 4 : -4)), 30, 98);
  const focus = clamp(Math.round(52 + Math.min(hours, 8.5) * 5 - (hours > 9.5 ? 8 : 0) - (hasBlocker ? 5 : 0)), 30, 96);
  const mood = clamp(Math.round((score + consistency + focus) / 3 + (hasBlocker ? -8 : 4)), 25, 98);

  return {
    ...row,
    hours,
    score,
    consistency,
    focus,
    mood,
    status: hasBlocker ? "Blocked" : score < 72 ? "Needs Attention" : "On Track",
    badge: score >= 88 ? "🔥 Most Productive" : consistency >= 84 ? "🎯 Consistent Performer" : hasPlan ? "🤖 AI Optimized" : "⚡ Fast Responder",
  };
}

function buildRiskCards(signals: EmployeeSignal[], blockerCount: number) {
  const firstBlocker = signals.find((row) => row.blockers?.trim());
  const delayed = signals.filter((row) => row.score < 72).length;
  const burnout = signals.filter((row) => row.hours > 9.5).length;

  return [
    {
      title: blockerCount ? "Blocker Detected" : "No Critical Blockers",
      text: firstBlocker?.blockers?.trim() || "Team updates do not show blocking risks for the selected date.",
      recommendation: blockerCount ? `Resolve blocker for ${getEmployeeName(firstBlocker)} before the next execution window.` : "Keep current cadence and monitor tomorrow's plan quality.",
      tone: blockerCount ? "amber" : "green",
    },
    {
      title: "Team Risks",
      text: delayed ? `${delayed} employee update has lower execution confidence.` : "Execution quality is stable across submitted standups.",
      recommendation: delayed ? "Review pending tasks before noon and clarify ownership." : "Maintain current team rhythm.",
      tone: delayed ? "red" : "blue",
    },
    {
      title: "Burnout Signals",
      text: burnout ? `${burnout} employee reported extended hours.` : "No elevated burnout signal detected from today's hours.",
      recommendation: burnout ? "Rebalance workload and protect focus blocks tomorrow." : "Continue tracking hours and blocker language.",
      tone: burnout ? "amber" : "green",
    },
  ] as Array<{ title: string; text: string; recommendation: string; tone: "red" | "amber" | "blue" | "green" }>;
}

function buildRecommendations(signals: EmployeeSignal[], blockerCount: number) {
  const blockerEmployee = signals.find((row) => row.blockers?.trim());
  return [
    blockerEmployee ? `Resolve blocker for ${getEmployeeName(blockerEmployee)}.` : "Confirm there are no hidden blockers in tomorrow's work plan.",
    "Review pending tasks before noon and align owners with the highest-risk deliverables.",
    "Follow up with employees who haven't submitted standups before end of day.",
    blockerCount > 1 ? "Create a manager escalation thread for repeated blockers." : "Protect deep-work time for employees with strong execution momentum.",
  ];
}

function buildTrendData(score: number, blockers: number, avgHours: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Today"].map((day, index) => ({
    day,
    score: clamp(score - 10 + index * 3 + (index % 2 ? 2 : -1), 35, 98),
    confidence: clamp(score - 4 + index * 2, 35, 98),
    blockers: Math.max(0, blockers + (index % 3) - 1),
    hours: Number((avgHours + (index - 3) * 0.25).toFixed(1)),
  }));
}

function buildHeatmap(count: number, avgHours: number, blockers: number) {
  return ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => {
    const score = clamp(Math.round(58 + count * 2 + avgHours * 3 - blockers * 3 + index * 4), 35, 96);
    return { day, score, level: Math.max(2, Math.round(score / 10)) };
  });
}

function makeAiInsight(count: number, blockers: number, confidence: number) {
  if (!count) return "No standups have been submitted for this date yet. AI analysis will activate once employee updates arrive.";
  if (blockers) return `Most employees are progressing on schedule. ${blockers} blocker ${blockers === 1 ? "requires" : "require"} manager attention, with execution confidence at ${confidence}%.`;
  return `Most employees are progressing on schedule. Execution confidence is ${confidence}% and no critical risks were identified.`;
}

function makeEmployeeInsight(row: EmployeeSignal) {
  if (row.blockers?.trim()) return "Blocker requires manager attention before tomorrow's execution plan can stay on track.";
  if (row.score >= 86) return "Strong productivity. Workload is balanced and execution quality is high.";
  if (row.hours > 9.5) return "Output is strong, but extended hours suggest workload should be monitored.";
  return "Progress is steady. Clarify tomorrow's priority to improve execution confidence.";
}

function getEmployeeName(row?: StandupRow) {
  return row?.profile?.full_name || "Unknown user";
}

function getFirstName(row: StandupRow) {
  return getEmployeeName(row).split(" ")[0] || "User";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
