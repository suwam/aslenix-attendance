import { useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Crown,
  Flame,
  Gem,
  Loader2,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Undo2,
} from "lucide-react";
import { getCurrentNepaliMonthRange } from "@/lib/nepali-calendar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { calculateTaskProgressMetrics } from "@/lib/employee-scoring";
import { eomEligibilityLabel, isEomEligible } from "@/lib/eom-eligibility";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";

type EmployeeRank = {
  userId: string;
  name: string;
  department: string;
  position: string;
  isEomEligible: boolean;
  avatarUrl: string | null;
  taskProgress: number;
  productivityContribution: number;
  activeTasks: number;
  completionTrend: number;
  completedTasks: number;
  totalTasks: number;
  attendancePct: number;
  score: number;
  badges: string[];
};

type EomProfile = {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  is_eom_eligible?: boolean | null;
};

export function EmployeeOfMonthSection() {
  const [visible, setVisible] = useState(
    () => window.sessionStorage.getItem("hide-eom-preview") !== "true",
  );
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeRank[]>([]);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      const nepaliMonth = getCurrentNepaliMonthRange();
      const monthStart = nepaliMonth.startAd;
      const monthEnd = nepaliMonth.endAd;
      const monthStartIso = `${monthStart}T00:00:00.000Z`;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: profiles }, { data: roleRows }, { data: tasks }, assigneeResult, { data: attendance }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, department, position, avatar_url, is_eom_eligible")
            .eq("approval_status", "approved")
            .eq("is_suspended", false),
          supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
          supabase.from("tasks").select("*"),
          supabase.from("task_assignees").select("task_id,user_id"),
          supabase
            .from("attendance")
            .select("user_id,date,status,work_hours")
            .gte("date", monthStart)
            .lte("date", monthEnd),
        ]);
      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays = Math.max(1, new Date().getDate());
      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));

      const ranked = ((profiles || []) as EomProfile[])
        .filter((profile) => !adminUserIds.has(profile.user_id))
        .filter(isEomEligible)
        .map((profile) => {
          const assignedTasks = (tasks || []).filter(
            (task: any) =>
              task.assigned_to === profile.user_id ||
              assignees.some(
                (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
              ),
          );
          const taskMetrics = calculateTaskProgressMetrics(assignedTasks);
          const completedThisMonth = assignedTasks.filter(
            (task: any) =>
              (task.status === "completed" || Number(task.progress || 0) >= 100) &&
              (!task.completed_at || new Date(task.completed_at).getTime() >= new Date(monthStartIso).getTime()),
          ).length;
          const attendedDays = new Set(
            (attendance || [])
              .filter(
                (row) =>
                  row.user_id === profile.user_id &&
                  ["present", "late", "wfh"].includes(row.status || ""),
              )
              .map((row) => row.date),
          ).size;
          const attendancePct = Math.min(100, Math.round((attendedDays / elapsedDays) * 100));
          const score = Math.round(taskMetrics.productivityContribution);
          const badges = [
            taskMetrics.averageProgress >= 10 ? "Progress Starter" : null,
            taskMetrics.averageProgress >= 50 ? "Momentum Builder" : null,
            attendancePct >= 90 ? "Attendance Pro" : null,
            score >= 80 ? "High Focus" : null,
            score >= 95 ? "Elite" : null,
          ].filter(Boolean) as string[];

          return {
            userId: profile.user_id,
            name: profile.full_name,
            department: profile.department || "Unassigned",
            position: profile.position || "Employee",
            isEomEligible: true,
            avatarUrl: profile.avatar_url,
            taskProgress: taskMetrics.averageProgress,
            productivityContribution: taskMetrics.productivityContribution,
            activeTasks: taskMetrics.activeTasks,
            completionTrend: taskMetrics.completionTrend,
            completedTasks: completedThisMonth,
            totalTasks: taskMetrics.totalTasks,
            attendancePct,
            score,
            badges,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.taskProgress - a.taskProgress ||
            b.attendancePct - a.attendancePct,
        )
        .slice(0, 6);

      setRows(ranked);
      setLoading(false);
    })();
  }, [visible]);

  const winner = rows[0];
  if (!visible) {
    return (
      <div className="mb-6 flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            window.sessionStorage.removeItem("hide-eom-preview");
            setVisible(true);
          }}
          className="rounded-xl"
        >
          <Undo2 size={14} className="mr-1.5" />
          Restore Employee of Month preview
        </Button>
      </div>
    );
  }

  return (
    <section className="eom-shell mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles size={14} />
            Monthly performance
          </div>
          <h2 className="text-2xl font-bold">Employee of the Month</h2>
          <p className="text-sm text-muted-foreground">
            Leaderboard preview for {getCurrentNepaliMonthRange().label} BS
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            window.sessionStorage.setItem("hide-eom-preview", "true");
            setVisible(false);
          }}
          className="rounded-xl"
        >
          <Undo2 size={14} className="mr-1.5" />
          Undo preview
        </Button>
      </div>

      {loading ? (
        <GlassCard className="flex min-h-80 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </GlassCard>
      ) : !winner ? (
        <GlassCard className="py-12 text-center text-muted-foreground">
          No EOM-eligible employees found.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.35fr]">
          <WinnerCard winner={winner} />
          <Leaderboard rows={rows} />
        </div>
      )}
    </section>
  );
}

function WinnerCard({ winner }: { winner: EmployeeRank }) {
  return (
    <article className="eom-winner glass">
      <div className="eom-confetti" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar employee={winner} size="lg" />
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              <Crown size={15} />
              Top employee
            </div>
            <h3 className="text-2xl font-bold">{winner.name}</h3>
            <p className="text-sm text-white/65">{winner.department} · {winner.position}</p>
            <div className="mt-2">
              <EligibilityBadge eligible={winner.isEomEligible} />
            </div>
          </div>
        </div>
        <div className="eom-crown">
          <Crown size={28} />
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-3 gap-3">
        <WinnerMetric label="Score" value={winner.score} icon={ZapIcon} />
        <WinnerMetric label="Task progress" value={`${winner.taskProgress}%`} icon={CheckCircle2} />
        <WinnerMetric label="Attendance" value={`${winner.attendancePct}%`} icon={BadgeCheck} />
      </div>

      <div className="relative z-10 mt-7 space-y-4">
        <AnalyticsBar label="Task progression" value={winner.taskProgress} />
        <AnalyticsBar label="Productivity" value={winner.productivityContribution} />
        <AnalyticsBar label="Completion trend" value={winner.completionTrend} />
        <AnalyticsBar label="Attendance" value={winner.attendancePct} />
      </div>

      <div className="relative z-10 mt-6 flex flex-wrap gap-2">
        {(winner.badges.length ? winner.badges : ["Rising Talent"]).map((badge) => (
          <span key={badge} className="eom-badge">
            <Gem size={12} />
            {badge}
          </span>
        ))}
      </div>
    </article>
  );
}

function Leaderboard({ rows }: { rows: EmployeeRank[] }) {
  return (
    <GlassCard className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4">
        <h3 className="flex items-center gap-2 font-semibold">
          <Trophy size={17} className="text-primary" />
          Performance leaderboard
        </h3>
      </div>
      <div className="divide-y divide-border/50">
        {rows.map((row, index) => (
          <div key={row.userId} className="eom-rank-row">
            <div className={`eom-rank-number ${index === 0 ? "eom-rank-first" : ""}`}>
              {index === 0 ? <Crown size={16} /> : index + 1}
            </div>
            <Avatar employee={row} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{row.name}</span>
                {row.badges.slice(0, 2).map((badge) => (
                  <span key={badge} className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] text-white/70">
                    {badge}
                  </span>
                ))}
                <EligibilityBadge eligible={row.isEomEligible} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.department} · {row.position}</div>
              <div className="eom-leader-metrics mt-3 grid gap-3">
                <MiniBar label="Task progress" value={row.taskProgress} detail={`${row.taskProgress}%`} />
                <MiniBar label="Productivity" value={row.productivityContribution} detail={`${row.productivityContribution}%`} />
                <MiniBar label="Active tasks" value={Math.min(100, row.activeTasks * 10)} detail={`${row.activeTasks}`} />
                <MiniBar label="Attendance" value={row.attendancePct} detail={`${row.attendancePct}%`} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tabular-nums gradient-text">{row.score}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function WinnerMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Trophy;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <Icon size={16} className="mb-2 text-amber-200" />
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/55">{label}</div>
    </div>
  );
}

function AnalyticsBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="eom-analytics-bar">
      <div className="eom-analytics-bar-label mb-1 flex justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="eom-mini-bar">
      <div className="eom-mini-bar-label mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{detail ?? `${value}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function EligibilityBadge({ eligible }: { eligible: boolean }) {
  return (
    <span className={`eom-eligibility-badge ${eligible ? "eligible" : "excluded"}`}>
      <ShieldCheck size={11} />
      {eomEligibilityLabel({ is_eom_eligible: eligible })}
    </span>
  );
}

function Avatar({ employee, size = "md" }: { employee: EmployeeRank; size?: "md" | "lg" }) {
  const initials = employee.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const className = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";

  return employee.avatarUrl ? (
    <img
      src={employee.avatarUrl}
      alt=""
      className={`${className} rounded-2xl object-cover ring-2 ring-amber-200/50`}
    />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_26px_rgba(125,92,255,.35)]`}>
      {initials}
    </div>
  );
}

function ZapIcon(props: React.ComponentProps<typeof Flame>) {
  return <Flame {...props} />;
}
