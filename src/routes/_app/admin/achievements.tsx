import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Crown,
  Eye,
  Flame,
  Gem,
  Loader2,
  MessageSquare,
  MinusCircle,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, startOfMonth } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { productivityScore } from "@/lib/tasks-utils";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/achievements")({
  component: AdminAchievementsPage,
});

type EmployeeAchievement = {
  userId: string;
  name: string;
  department: string;
  avatarUrl: string | null;
  badge: string;
  badgeType: "productivity" | "streak" | "tasks" | "attendance" | "quality";
  score: number;
  completedTasks: number;
  attendancePct: number;
  date: string;
  status: "Approved" | "Pending" | "Manual";
  streak: number;
  overdueTasks: number;
  history: string[];
};

const badgeOptions = [
  "All badges",
  "Productivity Hero",
  "30-Day Streak",
  "Fast Worker",
  "Attendance Pro",
  "No Overdue Tasks",
  "Elite Performer",
];

function AdminAchievementsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EmployeeAchievement[]>([]);
  const [search, setSearch] = useState("");
  const [badgeFilter, setBadgeFilter] = useState("All badges");
  const [departmentFilter, setDepartmentFilter] = useState("All departments");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState<EmployeeAchievement | null>(null);
  const [manualBadge, setManualBadge] = useState("Productivity Hero");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStart = startOfMonth(new Date(`${monthFilter}-01T00:00:00`));
      const monthStartDate = monthStart.toISOString().slice(0, 10);
      const monthStartIso = `${monthStartDate}T00:00:00.000Z`;
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
            .gte("date", monthStartDate)
            .lte("date", today),
        ]);

      const assignees =
        assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
          ? []
          : assigneeResult.data || [];
      const elapsedDays =
        monthFilter === new Date().toISOString().slice(0, 7)
          ? new Date().getDate()
          : new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();

      const generated = (profiles || []).flatMap((profile) => {
        const assignedTasks = (tasks || []).filter(
          (task: any) =>
            task.assigned_to === profile.user_id ||
            assignees.some(
              (assignee) => assignee.task_id === task.id && assignee.user_id === profile.user_id,
            ),
        );
        const completedTasks = assignedTasks.filter(
          (task: any) =>
            task.status === "completed" &&
            (!task.completed_at ||
              new Date(task.completed_at).getTime() >= new Date(monthStartIso).getTime()),
        ).length;
        const overdueTasks = assignedTasks.filter(
          (task: any) =>
            task.deadline &&
            new Date(task.deadline).getTime() < Date.now() &&
            task.status !== "completed",
        ).length;
        const employeeAttendance = (attendance || []).filter(
          (row) => row.user_id === profile.user_id,
        );
        const activeDates = new Set(
          employeeAttendance
            .filter((row) => ["present", "late", "wfh"].includes(row.status || ""))
            .map((row) => row.date),
        );
        const hours = employeeAttendance.reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
        const attendancePct = Math.min(
          100,
          Math.round((activeDates.size / Math.max(1, elapsedDays)) * 100),
        );
        const score = productivityScore({
          completed: completedTasks,
          total: Math.max(assignedTasks.length, completedTasks),
          onTimeRate: assignedTasks.length ? Math.max(0, 1 - overdueTasks / assignedTasks.length) : 1,
          hours,
          targetHours: 160,
        });
        const streak = countRecentStreak(activeDates, 30);
        const earned = [
          score >= 80
            ? { badge: "Productivity Hero", badgeType: "productivity" as const }
            : null,
          streak >= 30 ? { badge: "30-Day Streak", badgeType: "streak" as const } : null,
          completedTasks >= 5 ? { badge: "Fast Worker", badgeType: "tasks" as const } : null,
          attendancePct >= 90 ? { badge: "Attendance Pro", badgeType: "attendance" as const } : null,
          overdueTasks === 0 && assignedTasks.length > 0
            ? { badge: "No Overdue Tasks", badgeType: "quality" as const }
            : null,
          score >= 95 ? { badge: "Elite Performer", badgeType: "productivity" as const } : null,
        ].filter(Boolean) as { badge: string; badgeType: EmployeeAchievement["badgeType"] }[];

        const fallback =
          earned.length > 0
            ? earned
            : [{ badge: "Performance Review", badgeType: "quality" as const }];

        return fallback.map((item, index) => ({
          userId: profile.user_id,
          name: profile.full_name,
          department: profile.department || "Unassigned",
          avatarUrl: profile.avatar_url,
          badge: item.badge,
          badgeType: item.badgeType,
          score,
          completedTasks,
          attendancePct,
          date: new Date(Date.now() - index * 86400000).toISOString(),
          status:
            item.badge === "Performance Review"
              ? "Pending"
              : score >= 95
                ? "Approved"
                : "Pending",
          streak,
          overdueTasks,
          history: earned.map((badge) => badge.badge),
        }));
      });

      setRows(
        generated.sort(
          (a, b) => b.score - a.score || b.completedTasks - a.completedTasks || b.attendancePct - a.attendancePct,
        ),
      );
      setLoading(false);
    })();
  }, [monthFilter]);

  const departments = useMemo(
    () => ["All departments", ...Array.from(new Set(rows.map((row) => row.department)))],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          row.name.toLowerCase().includes(query) ||
          row.department.toLowerCase().includes(query) ||
          row.badge.toLowerCase().includes(query);
        const matchesBadge = badgeFilter === "All badges" || row.badge === badgeFilter;
        const matchesDepartment =
          departmentFilter === "All departments" || row.department === departmentFilter;
        const matchesScore =
          scoreFilter === "all" ||
          (scoreFilter === "90" && row.score >= 90) ||
          (scoreFilter === "75" && row.score >= 75) ||
          (scoreFilter === "under75" && row.score < 75);
        return matchesSearch && matchesBadge && matchesDepartment && matchesScore;
      }),
    [rows, search, badgeFilter, departmentFilter, scoreFilter],
  );

  const uniqueRewarded = new Set(rows.filter((row) => row.badge !== "Performance Review").map((row) => row.userId));
  const highest = rows.reduce<EmployeeAchievement | null>(
    (best, row) => (!best || row.score > best.score ? row : best),
    null,
  );
  const topMonthly = rows.reduce<EmployeeAchievement | null>(
    (best, row) => (!best || row.completedTasks > best.completedTasks ? row : best),
    null,
  );
  const leaderboard = Array.from(new Map(rows.map((row) => [row.userId, row])).values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const chartRows = leaderboard.map((row) => ({
    name: row.name.split(" ")[0],
    score: row.score,
    attendance: row.attendancePct,
    tasks: row.completedTasks,
  }));

  const actionToast = (action: string, row?: EmployeeAchievement | null) => {
    toast.success(`${action}${row ? `: ${row.name}` : ""}`);
  };

  return (
    <>
      <PageHeader
        title="Achievement Management"
        subtitle="Track, review, approve, and manage employee achievements across ASLENIX"
      />

      {loading ? (
        <div className="flex min-h-[55vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="admin-achievements space-y-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <AdminAchievementStat
              label="Unlocked"
              value={rows.filter((row) => row.badge !== "Performance Review").length}
              icon={Trophy}
            />
            <AdminAchievementStat
              label="Employees rewarded"
              value={uniqueRewarded.size}
              icon={UserCheck}
            />
            <AdminAchievementStat
              label="Highest productivity"
              value={highest ? highest.name.split(" ")[0] : "—"}
              icon={Zap}
            />
            <AdminAchievementStat
              label="Top monthly performer"
              value={topMonthly ? topMonthly.name.split(" ")[0] : "—"}
              icon={Crown}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
            <GlassCard className="admin-achievement-panel">
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                <div className="relative md:col-span-2">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employee or badge..."
                    className="pl-9"
                  />
                </div>
                <Select value={badgeFilter} onValueChange={setBadgeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {badgeOptions.map((badge) => (
                      <SelectItem key={badge} value={badge}>
                        {badge}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="month"
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                />
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All productivity scores</SelectItem>
                    <SelectItem value="90">90+ score</SelectItem>
                    <SelectItem value="75">75+ score</SelectItem>
                    <SelectItem value="under75">Under 75</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="rounded-xl" onClick={() => actionToast("Manual badge assigned")}>
                  <PlusCircle size={14} className="mr-1.5" />
                  Assign badge
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => actionToast("Selected achievement approved")}>
                  <BadgeCheck size={14} className="mr-1.5" />
                  Approve
                </Button>
              </div>

              <AchievementTable rows={filtered} onSelect={setSelected} onAction={actionToast} />
            </GlassCard>

            <div className="space-y-4">
              <Leaderboard rows={leaderboard} />
              <ActivityFeed rows={rows.slice(0, 6)} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <GlassCard>
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <BarChart3 size={16} className="text-primary" />
                Performance analytics
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                  <XAxis dataKey="name" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                  <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                  <Bar dataKey="score" fill="#ff2d6f" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="attendance" fill="#21d4fd" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="tasks" fill="#f6c453" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            <GlassCard className="admin-achievement-panel">
              <h3 className="mb-4 flex items-center gap-2 font-semibold">
                <ShieldCheck size={16} className="text-primary" />
                Admin controls
              </h3>
              <div className="space-y-3">
                <Select value={manualBadge} onValueChange={setManualBadge}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {badgeOptions.slice(1).map((badge) => (
                      <SelectItem key={badge} value={badge}>
                        {badge}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={4}
                  placeholder="Performance review notes or admin feedback..."
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button className="neon-button rounded-xl" onClick={() => actionToast(`Assigned ${manualBadge}`)}>
                    <PlusCircle size={14} className="mr-1.5" />
                    Assign
                  </Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => actionToast("Badge removed")}>
                    <MinusCircle size={14} className="mr-1.5" />
                    Remove
                  </Button>
                </div>
                <Button variant="outline" className="w-full rounded-xl" onClick={() => actionToast("Feedback saved")}>
                  <MessageSquare size={14} className="mr-1.5" />
                  Feedback
                </Button>
              </div>
            </GlassCard>
          </section>
        </div>
      )}

      <EmployeeDetailModal employee={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}

function AchievementTable({
  rows,
  onSelect,
  onAction,
}: {
  rows: EmployeeAchievement[];
  onSelect: (row: EmployeeAchievement) => void;
  onAction: (action: string, row?: EmployeeAchievement | null) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-white/[0.035] text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-4">Employee</th>
            <th className="p-4">Department</th>
            <th className="p-4">Badge earned</th>
            <th className="p-4">Score</th>
            <th className="p-4">Tasks</th>
            <th className="p-4">Attendance</th>
            <th className="p-4">Date</th>
            <th className="p-4">Status</th>
            <th className="p-4">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row, index) => (
            <tr key={`${row.userId}-${row.badge}-${index}`} className="transition hover:bg-white/[0.035]">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar row={row} />
                  <div className="font-semibold">{row.name}</div>
                </div>
              </td>
              <td className="p-4 text-muted-foreground">{row.department}</td>
              <td className="p-4">
                <BadgePill badge={row.badge} type={row.badgeType} />
              </td>
              <td className="p-4 font-semibold tabular-nums">{row.score}</td>
              <td className="p-4 tabular-nums">{row.completedTasks}</td>
              <td className="p-4 tabular-nums">{row.attendancePct}%</td>
              <td className="p-4 text-muted-foreground">{format(new Date(row.date), "MMM d")}</td>
              <td className="p-4">
                <span className={`admin-achievement-status ${row.status.toLowerCase()}`}>
                  {row.status}
                </span>
              </td>
              <td className="p-4">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onSelect(row)}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/15 hover:text-primary"
                    title="View details"
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => onAction("Achievement approved", row)}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-success/15 hover:text-success"
                    title="Approve"
                  >
                    <BadgeCheck size={14} />
                  </button>
                  <button
                    onClick={() => onAction("Badge removed", row)}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                    title="Remove"
                  >
                    <MinusCircle size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="p-10 text-center text-muted-foreground">
                No achievements match the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Leaderboard({ rows }: { rows: EmployeeAchievement[] }) {
  return (
    <GlassCard className="admin-achievement-panel">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Crown size={16} className="text-primary" />
        Leaderboard
      </h3>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.userId} className="admin-achievement-leader">
            <div className={`admin-achievement-rank ${index === 0 ? "top" : ""}`}>
              {index === 0 ? <Crown size={15} /> : index + 1}
            </div>
            <Avatar row={row} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{row.name}</div>
              <div className="text-xs text-muted-foreground">{row.badge}</div>
            </div>
            <div className="text-right">
              <div className="font-bold tabular-nums gradient-text">{row.score}</div>
              <div className="text-[10px] uppercase text-muted-foreground">Score</div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function ActivityFeed({ rows }: { rows: EmployeeAchievement[] }) {
  return (
    <GlassCard className="admin-achievement-panel">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <Sparkles size={16} className="text-primary" />
        Achievement activity
      </h3>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={`${row.userId}-${row.badge}-${index}`} className="flex gap-3 rounded-2xl bg-white/[0.035] p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white">
              <Award size={15} />
            </div>
            <div className="min-w-0">
              <div className="text-sm">
                <span className="font-semibold">{row.name}</span>{" "}
                {row.status === "Pending" ? "is ready for" : "unlocked"}{" "}
                <span className="text-primary">{row.badge}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(row.date), "MMM d, HH:mm")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function EmployeeDetailModal({
  employee,
  onOpenChange,
}: {
  employee: EmployeeAchievement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const analytics = employee
    ? [
        { label: "W1", score: Math.max(0, employee.score - 18), attendance: Math.max(0, employee.attendancePct - 16) },
        { label: "W2", score: Math.max(0, employee.score - 10), attendance: Math.max(0, employee.attendancePct - 9) },
        { label: "W3", score: Math.max(0, employee.score - 4), attendance: Math.max(0, employee.attendancePct - 4) },
        { label: "W4", score: employee.score, attendance: employee.attendancePct },
      ]
    : [];

  return (
    <Dialog open={Boolean(employee)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl glass border-border">
        {employee && (
          <>
            <DialogHeader>
              <DialogTitle>Employee achievement profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar row={employee} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl font-bold">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{employee.department}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[employee.badge, ...employee.history].filter(Boolean).slice(0, 5).map((badge) => (
                      <BadgePill key={badge} badge={badge} type={employee.badgeType} />
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                  <div className="text-3xl font-bold gradient-text">{employee.score}</div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Score</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <DetailStat label="Completed" value={employee.completedTasks} icon={CheckCircle2} />
                <DetailStat label="Attendance" value={`${employee.attendancePct}%`} icon={CalendarCheck2} />
                <DetailStat label="Streak" value={`${employee.streak}d`} icon={Flame} />
                <DetailStat label="Overdue" value={employee.overdueTasks} icon={ShieldCheck} />
              </div>

              <GlassCard>
                <h4 className="mb-3 font-semibold">Performance analytics</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={analytics}>
                    <defs>
                      <linearGradient id="achievementModalScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff2d6f" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis dataKey="label" stroke="oklch(0.7 0.03 250)" fontSize={12} />
                    <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipItemStyle} />
                    <Area type="monotone" dataKey="score" stroke="#ff2d6f" fill="url(#achievementModalScore)" strokeWidth={3} />
                    <Area type="monotone" dataKey="attendance" stroke="#21d4fd" fill="transparent" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>

              <GlassCard>
                <h4 className="mb-3 font-semibold">Admin feedback history</h4>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">
                  No saved feedback history yet. Use the admin controls to add review notes.
                </div>
              </GlassCard>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminAchievementStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Trophy;
}) {
  return (
    <GlassCard className="admin-achievement-stat">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-white shadow-[0_0_24px_rgba(125,92,255,.35)]">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 truncate text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </GlassCard>
  );
}

function DetailStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Trophy }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <Icon size={16} className="mb-2 text-primary" />
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function BadgePill({
  badge,
  type,
}: {
  badge: string;
  type: EmployeeAchievement["badgeType"];
}) {
  const Icon =
    type === "productivity"
      ? Zap
      : type === "streak"
        ? Flame
        : type === "tasks"
          ? CheckCircle2
          : type === "attendance"
            ? CalendarCheck2
            : Star;
  return (
    <span className="admin-achievement-badge">
      <Icon size={12} />
      {badge}
    </span>
  );
}

function Avatar({
  row,
  size = "md",
}: {
  row: Pick<EmployeeAchievement, "name" | "avatarUrl">;
  size?: "md" | "lg";
}) {
  const initials = row.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const className = size === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs";
  return row.avatarUrl ? (
    <img src={row.avatarUrl} alt="" className={`${className} shrink-0 rounded-2xl object-cover ring-2 ring-primary/40`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-400 font-bold text-white shadow-[0_0_24px_rgba(125,92,255,.35)]`}>
      {initials}
    </div>
  );
}

function countRecentStreak(activityDates: Set<string>, maxDays: number) {
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

const tooltipStyle = {
  background: "oklch(0.18 0.025 265)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  color: "white",
};

const tooltipItemStyle = { color: "white" };
