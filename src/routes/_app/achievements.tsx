import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  Crown,
  Flame,
  Gem,
  Loader2,
  Lock,
  Medal,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { productivityScore } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";

export const Route = createFileRoute("/_app/achievements")({ component: AchievementsPage });

type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

type BadgeDefinition = {
  id: string;
  tier: BadgeTier;
  title: string;
  subtitle: string;
  target: number;
  value: number;
  icon: typeof Trophy;
};

const tierMeta: Record<
  BadgeTier,
  { title: string; label: string; ring: string; glow: string; gradient: string; icon: typeof Medal }
> = {
  bronze: {
    title: "Bronze Tier",
    label: "Core momentum",
    ring: "achievement-bronze",
    glow: "shadow-[0_0_34px_rgba(210,115,54,.26)]",
    gradient: "from-[#b86b38] via-[#ff8f5d] to-[#7c3f22]",
    icon: Medal,
  },
  silver: {
    title: "Silver Tier",
    label: "Reliable execution",
    ring: "achievement-silver",
    glow: "shadow-[0_0_34px_rgba(190,216,255,.28)]",
    gradient: "from-[#a7b7d8] via-[#f6fbff] to-[#7a88a7]",
    icon: ShieldCheck,
  },
  gold: {
    title: "Gold Tier",
    label: "High performance",
    ring: "achievement-gold",
    glow: "shadow-[0_0_38px_rgba(255,201,77,.32)]",
    gradient: "from-[#e1a600] via-[#ffe985] to-[#ff7a59]",
    icon: Crown,
  },
  diamond: {
    title: "Diamond Tier",
    label: "Elite consistency",
    ring: "achievement-diamond",
    glow: "shadow-[0_0_42px_rgba(78,220,255,.36)]",
    gradient: "from-[#3ddcff] via-[#9d7cff] to-[#ff4ecd]",
    icon: Gem,
  },
};

function AchievementsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    completedTasks: 0,
    totalTasks: 0,
    overdueTasks: 0,
    activeTasks: 0,
    score: 0,
    loginStreak: 0,
    consistency30: 0,
    loggedToday: false,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      const taskIds = (tasks || []).map((task) => task.id);
      const assigneeResult = taskIds.length
        ? await supabase.from("task_assignees").select("task_id,user_id").in("task_id", taskIds)
        : { data: [] };
      const assignees =
        "error" in assigneeResult &&
        assigneeResult.error &&
        isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const visibleTasks = (tasks || []).filter(
        (task: any) =>
          task.assigned_to === user.id ||
          assignees.some((assignee) => assignee.task_id === task.id && assignee.user_id === user.id),
      );

      const now = Date.now();
      const completedTasks = visibleTasks.filter((task) => task.status === "completed").length;
      const overdueTasks = visibleTasks.filter(
        (task) =>
          task.deadline && new Date(task.deadline).getTime() < now && task.status !== "completed",
      ).length;
      const activeTasks = visibleTasks.filter(
        (task) => task.status === "in_progress" || task.status === "review",
      ).length;
      const onTimeCompleted = visibleTasks.filter(
        (task) =>
          task.status === "completed" &&
          (!task.deadline ||
            !task.completed_at ||
            new Date(task.completed_at).getTime() <= new Date(task.deadline).getTime()),
      ).length;

      const since = new Date();
      since.setDate(since.getDate() - 34);
      const [{ data: attendance }, { data: standups }] = await Promise.all([
        supabase
          .from("attendance")
          .select("date, work_hours")
          .eq("user_id", user.id)
          .gte("date", since.toISOString().slice(0, 10))
          .order("date", { ascending: false }),
        supabase
          .from("standups")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", since.toISOString().slice(0, 10))
          .order("date", { ascending: false }),
      ]);
      const activityDates = new Set([
        ...(attendance || []).map((row) => row.date),
        ...(standups || []).map((row) => row.date),
      ]);
      const totalHours = (attendance || []).reduce(
        (sum, row) => sum + Number(row.work_hours || 0),
        0,
      );
      const score = productivityScore({
        completed: completedTasks,
        total: visibleTasks.length,
        onTimeRate: completedTasks ? onTimeCompleted / completedTasks : 0,
        hours: totalHours,
        targetHours: 160,
      });
      const loginStreak = countStreak(activityDates, 7);
      const consistency30 = countStreak(activityDates, 30);
      const today = new Date().toISOString().slice(0, 10);

      setStats({
        completedTasks,
        totalTasks: visibleTasks.length,
        overdueTasks,
        activeTasks,
        score,
        loginStreak,
        consistency30,
        loggedToday: activityDates.has(today),
      });
      setLoading(false);
    })();
  }, [user]);

  const badges = useMemo<BadgeDefinition[]>(
    () => [
      {
        id: "starter",
        tier: "bronze",
        title: "Starter",
        subtitle: "Start your productivity journey",
        target: 1,
        value: stats.totalTasks > 0 || stats.loggedToday ? 1 : 0,
        icon: Rocket,
      },
      {
        id: "first-task",
        tier: "bronze",
        title: "First Task Completed",
        subtitle: "Complete your first assigned task",
        target: 1,
        value: stats.completedTasks,
        icon: CheckCircle2,
      },
      {
        id: "daily-login",
        tier: "bronze",
        title: "Daily Login",
        subtitle: "Log activity today",
        target: 1,
        value: stats.loggedToday ? 1 : 0,
        icon: CalendarCheck2,
      },
      {
        id: "seven-day",
        tier: "silver",
        title: "7 Day Streak",
        subtitle: "Log activity for 7 days",
        target: 7,
        value: stats.loginStreak,
        icon: Flame,
      },
      {
        id: "twenty-five",
        tier: "silver",
        title: "25 Tasks Completed",
        subtitle: "Finish 25 assigned tasks",
        target: 25,
        value: stats.completedTasks,
        icon: Award,
      },
      {
        id: "no-overdue",
        tier: "silver",
        title: "No Overdue Tasks",
        subtitle: "Keep every active task on schedule",
        target: 1,
        value: stats.totalTasks > 0 && stats.overdueTasks === 0 ? 1 : 0,
        icon: ShieldCheck,
      },
      {
        id: "hero",
        tier: "gold",
        title: "Productivity Hero",
        subtitle: "Reach an 80+ productivity score",
        target: 80,
        value: stats.score,
        icon: Star,
      },
      {
        id: "score-95",
        tier: "gold",
        title: "95+ Productivity Score",
        subtitle: "Operate at a premium performance level",
        target: 95,
        value: stats.score,
        icon: Zap,
      },
      {
        id: "hundred",
        tier: "gold",
        title: "100 Tasks Completed",
        subtitle: "Complete 100 assigned tasks",
        target: 100,
        value: stats.completedTasks,
        icon: Trophy,
      },
      {
        id: "legend",
        tier: "diamond",
        title: "Legend",
        subtitle: "Complete 100 tasks with 95+ score",
        target: 2,
        value: Number(stats.completedTasks >= 100) + Number(stats.score >= 95),
        icon: Crown,
      },
      {
        id: "elite",
        tier: "diamond",
        title: "Elite Performer",
        subtitle: "Keep a 95+ score with no overdue tasks",
        target: 2,
        value: Number(stats.score >= 95) + Number(stats.overdueTasks === 0 && stats.totalTasks > 0),
        icon: Gem,
      },
      {
        id: "thirty-day",
        tier: "diamond",
        title: "30 Day Consistency",
        subtitle: "Log activity for 30 days",
        target: 30,
        value: stats.consistency30,
        icon: Sparkles,
      },
    ],
    [stats],
  );

  const unlocked = badges.filter((badge) => badge.value >= badge.target);
  const activePopupBadge = unlocked[unlocked.length - 1];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Achievements"
        subtitle="Productivity badges, streaks, and performance milestones"
      />

      {activePopupBadge && <UnlockPulse badge={activePopupBadge} />}

      <div className="achievement-shell space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Unlocked" value={`${unlocked.length}/12`} icon={Trophy} />
          <MetricCard label="Completed tasks" value={stats.completedTasks} icon={CheckCircle2} />
          <MetricCard label="Productivity score" value={stats.score} icon={Zap} />
          <MetricCard label="Current streak" value={`${stats.loginStreak}d`} icon={Flame} />
        </section>

        {(["bronze", "silver", "gold", "diamond"] as BadgeTier[]).map((tier) => {
          const meta = tierMeta[tier];
          const TierIcon = meta.icon;
          return (
            <section key={tier} className="glass achievement-tier">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} ${meta.glow}`}
                  >
                    <TierIcon size={21} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,.7)]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{meta.title}</h2>
                    <p className="text-sm text-muted-foreground">{meta.label}</p>
                  </div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                  {badges.filter((badge) => badge.tier === tier && badge.value >= badge.target).length}/3 unlocked
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {badges
                  .filter((badge) => badge.tier === tier)
                  .map((badge) => (
                    <AchievementCard key={badge.id} badge={badge} />
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function AchievementCard({ badge }: { badge: BadgeDefinition }) {
  const meta = tierMeta[badge.tier];
  const Icon = badge.icon;
  const progress = Math.min(100, Math.round((badge.value / Math.max(1, badge.target)) * 100));
  const unlocked = progress >= 100;

  return (
    <article
      className={`achievement-card group ${meta.ring} ${unlocked ? "achievement-unlocked" : "achievement-locked"}`}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div
          className={`achievement-icon bg-gradient-to-br ${meta.gradient} ${
            unlocked ? meta.glow : "opacity-60 grayscale"
          }`}
        >
          <Icon size={24} />
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {unlocked ? "Unlocked" : "Locked"}
        </div>
      </div>

      <div className="relative z-10 mt-5">
        <h3 className="text-lg font-bold text-white">{badge.title}</h3>
        <p className="mt-1 min-h-10 text-sm text-muted-foreground">{badge.subtitle}</p>
      </div>

      <div className="relative z-10 mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-semibold text-white">
            {Math.min(badge.value, badge.target)}/{badge.target}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${meta.gradient} transition-all duration-700`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!unlocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/18 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <Lock className="text-white/80 drop-shadow-[0_0_12px_rgba(255,255,255,.65)]" size={26} />
        </div>
      )}
    </article>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Trophy;
}) {
  return (
    <GlassCard className="achievement-metric">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_24px_rgba(125,92,255,.35)]">
        <Icon size={19} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums text-white">{value}</div>
      </div>
    </GlassCard>
  );
}

function UnlockPulse({ badge }: { badge: BadgeDefinition }) {
  const Icon = badge.icon;
  const meta = tierMeta[badge.tier];

  return (
    <div className="pointer-events-none fixed right-5 top-20 z-50 hidden animate-achievement-pop md:block">
      <div className="glass-strong flex items-center gap-3 rounded-2xl border-primary/30 px-4 py-3 shadow-[0_0_42px_rgba(255,45,111,.28)]">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient}`}>
          <Icon size={21} className="text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-primary">Achievement unlocked</div>
          <div className="text-sm font-semibold text-white">{badge.title}</div>
        </div>
      </div>
    </div>
  );
}

function countStreak(activityDates: Set<string>, maxDays: number) {
  let streak = 0;
  const day = new Date();
  for (let index = 0; index < maxDays; index += 1) {
    const key = day.toISOString().slice(0, 10);
    if (!activityDates.has(key)) break;
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
