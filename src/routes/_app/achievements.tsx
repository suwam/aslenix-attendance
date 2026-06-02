import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  approved?: boolean;
};

type PersistedAchievement = {
  badge: string;
  status: "Approved" | "Pending" | "Manual";
};

type CelebrationBadge = {
  key: string;
  title: string;
  subtitle: string;
  status: PersistedAchievement["status"];
  tier?: BadgeTier;
  icon: typeof Trophy;
};

const approvedBadgeAliases: Record<string, string> = {
  "Productivity Hero": "hero",
  "30-Day Streak": "thirty-day",
  "Fast Worker": "twenty-five",
  "No Overdue Tasks": "no-overdue",
  "Elite Performer": "elite",
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
  const [celebrationBadge, setCelebrationBadge] = useState<CelebrationBadge | null>(null);
  const [seenVersion, setSeenVersion] = useState(0);
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
  const [approvedAchievements, setApprovedAchievements] = useState<PersistedAchievement[]>([]);

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
      const [{ data: attendance }, { data: standups }, achievementResult] = await Promise.all([
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
        supabase
          .from("employee_achievements")
          .select("badge,status")
          .eq("user_id", user.id)
          .in("status", ["Approved", "Manual"]),
      ]);
      if (achievementResult.error) {
        console.warn("Unable to load approved achievements", achievementResult.error);
      }
      setApprovedAchievements((achievementResult.data || []) as PersistedAchievement[]);
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

  const approvedBadgeIds = useMemo(
    () =>
      new Set(
        approvedAchievements
          .map((achievement) => approvedBadgeAliases[achievement.badge])
          .filter(Boolean),
      ),
    [approvedAchievements],
  );

  const approvedOfficialBadges = useMemo(
    () =>
      approvedAchievements.filter(
        (achievement) => !approvedBadgeAliases[achievement.badge],
      ),
    [approvedAchievements],
  );

  const badges = useMemo<BadgeDefinition[]>(() => {
    const definitions: BadgeDefinition[] = [
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
    ];

    return definitions.map((badge) =>
      approvedBadgeIds.has(badge.id)
        ? { ...badge, value: badge.target, approved: true }
        : badge,
    );
  }, [approvedBadgeIds, stats]);

  const unlocked = badges.filter((badge) => badge.value >= badge.target);
  const totalUnlocked = unlocked.length + approvedOfficialBadges.length;
  const featuredBadges = [
    ...badges.filter((badge) => badge.approved || badge.value >= badge.target).map((badge) => ({
      key: badge.id,
      title: badge.title,
      subtitle: badge.approved ? "Approved by admin" : "Unlocked from progress",
      status: badge.approved ? "Approved" : "Manual",
      tier: badge.tier,
      icon: badge.icon,
    })),
    ...approvedOfficialBadges.map((achievement) => ({
      key: `official-${achievement.badge}`,
      title: achievement.badge,
      subtitle: "Official achievement approved by admin",
      status: achievement.status,
      icon: BadgeCheck,
    })),
  ].slice(0, 4);

  useEffect(() => {
    if (loading || !user || approvedAchievements.length === 0) return;

    const celebrationBadges = approvedAchievements
      .map<CelebrationBadge>((achievement) => {
        const mappedId = approvedBadgeAliases[achievement.badge];
        const mappedBadge = mappedId ? badges.find((badge) => badge.id === mappedId) : null;

        return {
          key: `${user.id}:${achievement.badge}:${achievement.status}`,
          title: mappedBadge?.title || achievement.badge,
          subtitle:
            achievement.status === "Manual"
              ? "An admin assigned this official badge to you."
              : "An admin approved this achievement for you.",
          status: achievement.status,
          tier: mappedBadge?.tier,
          icon: mappedBadge?.icon || BadgeCheck,
        };
      });
    const storageKey = `aslenix-seen-achievements:${user.id}`;
    const seen = readSeenBadgeKeys(storageKey);
    const nextBadge = celebrationBadges.find((badge) => !seen.has(badge.key));

    if (nextBadge) {
      setCelebrationBadge(nextBadge);
    }
  }, [approvedAchievements, badges, loading, seenVersion, user]);

  const closeCelebration = () => {
    if (!user || !celebrationBadge) {
      setCelebrationBadge(null);
      return;
    }

    const storageKey = `aslenix-seen-achievements:${user.id}`;
    const seen = readSeenBadgeKeys(storageKey);
    seen.add(celebrationBadge.key);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(seen)));
    setCelebrationBadge(null);
    setSeenVersion((current) => current + 1);
  };

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

      <AchievementCelebration badge={celebrationBadge} onOpenChange={(open) => !open && closeCelebration()} />

      <div className="achievement-shell space-y-6">
        <section className="glass achievement-tier overflow-hidden">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_34px_rgba(125,92,255,.36)]">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Achievement Vault</h2>
                  <p className="text-sm text-muted-foreground">
                    Your approved badges, live progress, and current milestones.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <VaultStat label="Earned" value={totalUnlocked} />
                <VaultStat label="Official" value={approvedAchievements.length} />
                <VaultStat label="In progress" value={badges.length - unlocked.length} />
                <VaultStat label="Best tier" value={bestTierLabel(unlocked)} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Recent rewards</div>
                  <div className="text-xs text-muted-foreground">Latest badges on your profile</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                  {featuredBadges.length}
                </div>
              </div>
              <div className="space-y-2">
                {featuredBadges.length > 0 ? (
                  featuredBadges.map((badge) => {
                    const Icon = badge.icon;
                    const meta = badge.tier ? tierMeta[badge.tier] : null;
                    return (
                      <div key={badge.key} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                            meta?.gradient || "from-cyan-400 via-violet-500 to-pink-500"
                          } text-white`}
                        >
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{badge.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{badge.subtitle}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
                    Approved rewards will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Unlocked" value={`${totalUnlocked}/12`} icon={Trophy} />
          <MetricCard label="Completed tasks" value={stats.completedTasks} icon={CheckCircle2} />
          <MetricCard label="Productivity score" value={stats.score} icon={Zap} />
          <MetricCard label="Current streak" value={`${stats.loginStreak}d`} icon={Flame} />
        </section>

        {approvedOfficialBadges.length > 0 && (
          <section className="glass achievement-tier">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 shadow-[0_0_34px_rgba(78,220,255,.3)]">
                  <BadgeCheck size={21} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Official Badges</h2>
                  <p className="text-sm text-muted-foreground">Approved by admin</p>
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                {approvedOfficialBadges.length} official
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {approvedOfficialBadges.map((achievement) => (
                <OfficialBadgeCard key={achievement.badge} badge={achievement.badge} />
              ))}
            </div>
          </section>
        )}

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

function VaultStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function AchievementCelebration({
  badge,
  onOpenChange,
}: {
  badge: CelebrationBadge | null;
  onOpenChange: (open: boolean) => void;
}) {
  const Icon = badge?.icon || BadgeCheck;
  const meta = badge?.tier ? tierMeta[badge.tier] : null;

  return (
    <Dialog open={Boolean(badge)} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-white/10 bg-background/95 p-0 sm:max-w-md">
        {badge && (
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(33,212,253,.24),transparent_34%),radial-gradient(circle_at_20%_35%,rgba(255,45,111,.2),transparent_26%),radial-gradient(circle_at_80%_45%,rgba(139,92,246,.22),transparent_30%)]" />
            <div className="pointer-events-none absolute inset-x-8 top-5 flex justify-between opacity-70">
              {["h-2 w-2", "h-1.5 w-1.5", "h-2.5 w-2.5", "h-1 w-1"].map((size, index) => (
                <span
                  key={index}
                  className={`${size} rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,.7)]`}
                />
              ))}
            </div>
            <div className="relative px-6 pb-6 pt-8 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/20 bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_55px_rgba(125,92,255,.45)]">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${
                    meta?.gradient || "from-cyan-400 via-violet-500 to-pink-500"
                  } shadow-[inset_0_1px_0_rgba(255,255,255,.28)]`}
                >
                  <Icon size={32} />
                </div>
              </div>
              <DialogHeader className="items-center text-center">
                <div className="mb-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Badge unlocked
                </div>
                <DialogTitle className="text-2xl font-bold text-white">{badge.title}</DialogTitle>
                <DialogDescription className="max-w-xs text-muted-foreground">
                  {badge.subtitle}
                </DialogDescription>
              </DialogHeader>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="neon-button mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
              >
                Awesome
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OfficialBadgeCard({ badge }: { badge: string }) {
  return (
    <article className="achievement-card achievement-diamond achievement-unlocked group">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="achievement-icon bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 shadow-[0_0_34px_rgba(78,220,255,.3)]">
          <BadgeCheck size={24} />
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
          Approved
        </div>
      </div>

      <div className="relative z-10 mt-5">
        <h3 className="text-lg font-bold text-white">{badge}</h3>
        <p className="mt-1 min-h-10 text-sm text-muted-foreground">
          Official achievement approved by admin
        </p>
      </div>

      <div className="relative z-10 mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-semibold text-white">1/1</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-500 to-pink-500" />
        </div>
      </div>
    </article>
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

function readSeenBadgeKeys(storageKey: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function bestTierLabel(unlocked: BadgeDefinition[]) {
  if (unlocked.some((badge) => badge.tier === "diamond")) return "Diamond";
  if (unlocked.some((badge) => badge.tier === "gold")) return "Gold";
  if (unlocked.some((badge) => badge.tier === "silver")) return "Silver";
  if (unlocked.some((badge) => badge.tier === "bronze")) return "Bronze";
  return "None";
}
