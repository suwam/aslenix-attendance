import { useEffect, useMemo, useState } from "react";
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
  Sparkles,
  Trophy,
  Undo2,
} from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { productivityScore } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";

type EmployeeRank = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  completedTasks: number;
  totalTasks: number;
  attendancePct: number;
  score: number;
  badges: string[];
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
      const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
      const monthStartIso = `${monthStart}T00:00:00.000Z`;
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: profiles }, { data: tasks }, assigneeResult, { data: attendance }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, full_name, department, avatar_url")
            .eq("approval_status", "approved")
            .eq("is_suspended", false),
          supabase.from("tasks").select("*"),
          supabase.from("task_assignees").select("task_id,user_id"),
          supabase
            .from("attendance")
            .select("user_id,date,status,work_hours")
            .gte("date", monthStart)
            .lte("date", today),
        ]);
      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays = Math.max(1, new Date().getDate());

      const ranked = (profiles || [])
        .map((profile) => {
          const assignedTasks = (tasks || []).filter(
            (task: any) =>
              task.assigned_to === profile.user_id ||
              assignees.some(
                (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
              ),
          );
          const completedThisMonth = assignedTasks.filter(
            (task: any) =>
              task.status === "completed" &&
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
          const hours = (attendance || [])
            .filter((row) => row.user_id === profile.user_id)
            .reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
          const attendancePct = Math.min(100, Math.round((attendedDays / elapsedDays) * 100));
          const score = productivityScore({
            completed: completedThisMonth,
            total: Math.max(assignedTasks.length, completedThisMonth),
            onTimeRate: 1,
            hours,
            targetHours: 160,
          });
          const badges = [
            completedThisMonth >= 1 ? "Starter" : null,
            completedThisMonth >= 5 ? "Task Sprinter" : null,
            attendancePct >= 90 ? "Attendance Pro" : null,
            score >= 80 ? "High Focus" : null,
            score >= 95 ? "Elite" : null,
          ].filter(Boolean) as string[];

          return {
            userId: profile.user_id,
            name: profile.full_name,
            department: profile.department || "Unassigned",
            avatarUrl: profile.avatar_url,
            completedTasks: completedThisMonth,
            totalTasks: assignedTasks.length,
            attendancePct,
            score,
            badges,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.completedTasks - a.completedTasks ||
            b.attendancePct - a.attendancePct,
        )
        .slice(0, 6);

      setRows(ranked);
      setLoading(false);
    })();
  }, [visible]);

  const winner = rows[0];
  const averageScore = useMemo(
    () => Math.round(rows.reduce((sum, row) => sum + row.score, 0) / Math.max(1, rows.length)),
    [rows],
  );

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
            Leaderboard preview for {format(new Date(), "MMMM yyyy")}
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
          No approved employees found.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1.35fr]">
          <WinnerCard winner={winner} averageScore={averageScore} />
          <Leaderboard rows={rows} />
        </div>
      )}
    </section>
  );
}

function WinnerCard({ winner, averageScore }: { winner: EmployeeRank; averageScore: number }) {
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
            <p className="text-sm text-white/65">{winner.department}</p>
          </div>
        </div>
        <div className="eom-crown">
          <Crown size={28} />
        </div>
      </div>

      <div className="relative z-10 mt-8 grid grid-cols-3 gap-3">
        <WinnerMetric label="Score" value={winner.score} icon={ZapIcon} />
        <WinnerMetric label="Tasks" value={winner.completedTasks} icon={CheckCircle2} />
        <WinnerMetric label="Attendance" value={`${winner.attendancePct}%`} icon={BadgeCheck} />
      </div>

      <div className="relative z-10 mt-7 space-y-4">
        <AnalyticsBar label="Productivity score" value={winner.score} />
        <AnalyticsBar label="Attendance" value={winner.attendancePct} />
        <AnalyticsBar label="Team avg score" value={averageScore} />
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
                  <span key={badge} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/70">
                    {badge}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{row.department}</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MiniBar label="Score" value={row.score} />
                <MiniBar label="Tasks" value={Math.min(100, row.completedTasks * 10)} detail={`${row.completedTasks}`} />
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
    <div>
      <div className="mb-1 flex justify-between text-xs">
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
    <div>
      <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span>{detail ?? `${value}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="eom-progress h-full rounded-full" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
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
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_26px_rgba(125,92,255,.35)]`}>
      {initials}
    </div>
  );
}

function ZapIcon(props: React.ComponentProps<typeof Flame>) {
  return <Flame {...props} />;
}
