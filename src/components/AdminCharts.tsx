import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BellDot,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FilePenLine,
  Laptop,
  ListChecks,
  Megaphone,
  Plane,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Line,
  Sector,
} from "recharts";
import { GlassCard } from "@/components/GlassCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNepaliDate } from "@/lib/nepali-calendar";

const COLORS = [
  "oklch(0.65 0.27 22)",
  "oklch(0.6 0.25 260)",
  "oklch(0.72 0.18 155)",
  "oklch(0.82 0.17 75)",
  "oklch(0.7 0.2 320)",
  "oklch(0.65 0.2 200)",
];

const ATTENDANCE_COLORS = {
  present: "#60a5fa",
  late: "#f59e0b",
  wfh: "#a78bfa",
  absent: "#fb7185",
  trend: "#67e8f9",
};

const DEPARTMENT_COLORS = {
  frontend: "#38bdf8",
  backend: "#818cf8",
  softwaredeveloper: "#f59e0b",
  digitalmarketing: "#34d399",
  administrator: "#ec4899",
  uiux: "#fb7185",
  hr: "#60a5fa",
  marketing: "#34d399",
  development: "#f59e0b",
};

export type WeeklyAttendanceDay = {
  day: string;
  date?: string;
  totalEmployees?: number;
  present?: number;
  late?: number;
  wfh?: number;
  absent?: number;
  attendancePct?: number;
  noData?: boolean;
  isToday?: boolean;
};

export type AttendanceRange = "7d" | "14d" | "month";
export type AttendanceViewMode = "all" | "bars" | "trend";

export type AdminChartsProps = {
  weekly: WeeklyAttendanceDay[];
  historyData?: {
    sevenDays: WeeklyAttendanceDay[];
    fourteenDays: WeeklyAttendanceDay[];
    monthDays: WeeklyAttendanceDay[];
  };
  deptData: any[];
  activity: any[];
  activeEmployeesCount?: number;
};

type DepartmentRow = {
  name: string;
  value: number;
  color: string;
  gradientId: string;
  percentage: number;
};

type ActivityFilter = "all" | "attendance" | "task" | "leave" | "employee";

type ActivityKind =
  | "attendance_approved"
  | "attendance_correction"
  | "task_updated"
  | "task_completed"
  | "leave_request"
  | "employee_added"
  | "announcement"
  | "system";

type ActivityFeedItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  category: ActivityFilter | "system";
  kind: ActivityKind;
  badge: "Attendance" | "Task" | "Leave" | "Employee" | "System";
  priority: "high" | "medium" | "low";
  employeeName: string;
  avatarUrl?: string | null;
  groupedCount: number;
  groupedTitle?: string;
};

export default function AdminCharts({
  weekly,
  historyData,
  deptData,
  activity,
  activeEmployeesCount,
}: AdminChartsProps) {
  const navigate = useNavigate();
  const [activeDepartmentIndex, setActiveDepartmentIndex] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [selectedActivity, setSelectedActivity] = useState<ActivityFeedItem | null>(null);
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRange>("7d");
  const [viewMode, setViewMode] = useState<AttendanceViewMode>("all");

  const selectedWeekly =
    attendanceRange === "7d"
      ? (historyData?.sevenDays ?? weekly)
      : attendanceRange === "14d"
        ? (historyData?.fourteenDays ?? weekly)
        : (historyData?.monthDays ?? weekly);

  const weeklyRows = selectedWeekly.map((row) => {
    const present = Number(row.present ?? 0);
    const late = Number(row.late ?? 0);
    const wfh = Number(row.wfh ?? 0);
    const absent = Number(row.absent ?? 0);
    const totalEmployees = Number(
      row.totalEmployees ?? activeEmployeesCount ?? present + late + wfh + absent,
    );
    const attended = present + late + wfh;
    return {
      ...row,
      present,
      late,
      wfh,
      absent,
      totalEmployees,
      attendancePct:
        row.attendancePct ?? (totalEmployees ? Math.round((attended / totalEmployees) * 100) : 0),
      noData: row.noData ?? totalEmployees === 0,
    };
  });

  const summary = summarizeWeeklyAttendance(weeklyRows);
  const departmentRows = makeDepartmentRows(deptData);
  const departmentTotal = departmentRows.reduce((sum, row) => sum + row.value, 0);
  const activeDepartment =
    activeDepartmentIndex != null && departmentRows[activeDepartmentIndex]
      ? departmentRows[activeDepartmentIndex]
      : null;

  const activityItems = groupActivityItems(activity.map(normalizeActivityItem));
  const filteredActivityItems = activityItems.filter(
    (item) => activityFilter === "all" || item.category === activityFilter,
  );
  const activitySummary = summarizeActivities(activityItems);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. WEEKLY ATTENDANCE CARD */}
      <GlassCard className="lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-lg font-bold tracking-tight text-foreground">Weekly attendance</h3>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>Live HRMS</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {attendanceRange === "7d"
                  ? "Last 7 consecutive days"
                  : attendanceRange === "14d"
                    ? "Last 14 consecutive days"
                    : "Current Nepali (BS) month"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("all")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === "all"
                      ? "bg-white dark:bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Combined
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("bars")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === "bars"
                      ? "bg-white dark:bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Headcount
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("trend")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    viewMode === "trend"
                      ? "bg-white dark:bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Rate %
                </button>
              </div>

              {/* Range Selector */}
              <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAttendanceRange("7d")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    attendanceRange === "7d"
                      ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  7 Days
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceRange("14d")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    attendanceRange === "14d"
                      ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  14 Days
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceRange("month")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    attendanceRange === "month"
                      ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  This Month
                </button>
              </div>
            </div>
          </div>

          {/* Metric Tiles with Icons and Theme Colors */}
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <WeeklySummaryTile
              label="Avg attendance"
              value={`${summary.avgAttendance}%`}
              icon={TrendingUp}
              accent="blue"
              subtext="Period average"
            />
            <WeeklySummaryTile
              label="Total present"
              value={summary.present}
              icon={CheckCircle2}
              accent="emerald"
              subtext="Recorded check-ins"
            />
            <WeeklySummaryTile
              label="Total late"
              value={summary.late}
              icon={Clock}
              accent="amber"
              subtext="Late arrivals"
            />
            <WeeklySummaryTile
              label="Total WFH"
              value={summary.wfh}
              icon={Laptop}
              accent="violet"
              subtext="Remote working"
            />
          </div>
        </div>

        {/* Dual-Axis Chart: Fixes squashed bars and scales headcount gracefully */}
        <ResponsiveContainer width="100%" height={290}>
          <ComposedChart
            data={weeklyRows}
            margin={{ top: 16, right: 10, left: -14, bottom: 6 }}
            barCategoryGap="28%"
          >
            <defs>
              <linearGradient id="presentBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.present} />
              </linearGradient>
              <linearGradient id="lateBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.late} />
              </linearGradient>
              <linearGradient id="wfhBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ddd6fe" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.wfh} />
              </linearGradient>
              <linearGradient id="absentBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fecdd3" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.absent} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.55)" strokeDasharray="4 6" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={<WeeklyAxisTick />}
              interval={0}
              height={38}
            />
            {/* Left Y-Axis for Headcount */}
            <YAxis
              yAxisId="headcount"
              orientation="left"
              axisLine={false}
              tickLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickMargin={6}
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(activeEmployeesCount || 10, dataMax, 4)]}
            />
            {/* Right Y-Axis for Percentage */}
            <YAxis
              yAxisId="percentage"
              orientation="right"
              axisLine={false}
              tickLine={false}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickMargin={6}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.35)", radius: 10 }}
              content={<WeeklyAttendanceTooltip />}
            />

            {(viewMode === "all" || viewMode === "bars") && (
              <>
                <Bar
                  yAxisId="headcount"
                  dataKey="present"
                  stackId="attendance"
                  fill="url(#presentBar)"
                  radius={[0, 0, 6, 6]}
                  isAnimationActive
                  animationDuration={650}
                >
                  {weeklyRows.map((entry) => (
                    <Cell
                      key={`present-${entry.day}-${entry.date}`}
                      className="transition-opacity duration-200 hover:opacity-90"
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="headcount"
                  dataKey="late"
                  stackId="attendance"
                  fill="url(#lateBar)"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                >
                  {weeklyRows.map((entry) => (
                    <Cell key={`late-${entry.day}-${entry.date}`} />
                  ))}
                </Bar>
                <Bar
                  yAxisId="headcount"
                  dataKey="wfh"
                  stackId="attendance"
                  fill="url(#wfhBar)"
                  radius={[0, 0, 0, 0]}
                  isAnimationActive
                  animationDuration={760}
                >
                  {weeklyRows.map((entry) => (
                    <Cell key={`wfh-${entry.day}-${entry.date}`} />
                  ))}
                </Bar>
                <Bar
                  yAxisId="headcount"
                  dataKey="absent"
                  stackId="attendance"
                  fill="url(#absentBar)"
                  radius={[6, 6, 0, 0]}
                  isAnimationActive
                  animationDuration={820}
                >
                  {weeklyRows.map((entry) => (
                    <Cell key={`absent-${entry.day}-${entry.date}`} />
                  ))}
                </Bar>
              </>
            )}

            {(viewMode === "all" || viewMode === "trend") && (
              <Line
                yAxisId="percentage"
                type="monotone"
                dataKey="attendancePct"
                stroke={ATTENDANCE_COLORS.trend}
                strokeWidth={2.5}
                dot={<TrendDot />}
                activeDot={{ r: 5.5, stroke: "#ffffff", strokeWidth: 2, fill: ATTENDANCE_COLORS.trend }}
                isAnimationActive
                animationDuration={900}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-muted-foreground border-t border-border/50 pt-2.5">
          <AttendanceLegend color={ATTENDANCE_COLORS.present} label="Present" />
          <AttendanceLegend color={ATTENDANCE_COLORS.late} label="Late" />
          <AttendanceLegend color={ATTENDANCE_COLORS.wfh} label="WFH" />
          <AttendanceLegend color={ATTENDANCE_COLORS.absent} label="Absent" />
          <span className="ml-auto hidden items-center gap-1.5 text-muted-foreground sm:flex">
            <span className="h-0.5 w-6 rounded-full bg-cyan-400" />
            <span>Attendance % Rate</span>
          </span>
        </div>
      </GlassCard>

      {/* 2. DEPARTMENTS DISTRIBUTION CARD */}
      <GlassCard>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-foreground">Departments</h3>
            <p className="mt-1 text-xs text-muted-foreground">Workforce distribution</p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-bold text-foreground/80 shadow-xs">
            {departmentRows.length} Departments
          </span>
        </div>
        {departmentRows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No data yet</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={235}>
              <PieChart
                role="img"
                aria-label={`Department distribution chart with ${departmentTotal} employees`}
              >
                <defs>
                  {departmentRows.map((row) => (
                    <linearGradient
                      key={row.gradientId}
                      id={row.gradientId}
                      x1="0"
                      y1="0"
                      x2="1"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={lightenHex(row.color, 25)} />
                      <stop offset="60%" stopColor={row.color} />
                      <stop offset="100%" stopColor={darkenHex(row.color, 12)} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={departmentRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={95}
                  paddingAngle={3}
                  cornerRadius={7}
                  activeIndex={activeDepartmentIndex ?? undefined}
                  activeShape={renderActiveDepartmentShape}
                  onMouseEnter={(_, index) => setActiveDepartmentIndex(index)}
                  onMouseLeave={() => setActiveDepartmentIndex(null)}
                  isAnimationActive
                  animationDuration={750}
                >
                  {departmentRows.map((row, i) => (
                    <Cell
                      key={row.name}
                      fill={`url(#${row.gradientId})`}
                      stroke="hsl(var(--background))"
                      strokeWidth={activeDepartmentIndex === i ? 3 : 2}
                      style={{
                        transition: "opacity 180ms ease",
                        opacity:
                          activeDepartmentIndex == null || activeDepartmentIndex === i ? 1 : 0.45,
                        outline: "none",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </Pie>

                {/* DYNAMIC CENTER TEXT: Shows hovered department or total */}
                <text
                  x="50%"
                  y={activeDepartment ? "42%" : "46%"}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground font-black text-2xl sm:text-3xl tracking-tight"
                  style={{ fill: "currentColor" }}
                >
                  {activeDepartment ? activeDepartment.value : departmentTotal}
                </text>
                <text
                  x="50%"
                  y={activeDepartment ? "57%" : "59%"}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[10px] font-bold uppercase tracking-wider"
                  style={{ fill: "hsl(var(--muted-foreground))" }}
                >
                  {activeDepartment ? `${activeDepartment.percentage}% share` : "Employees"}
                </text>
                {activeDepartment && (
                  <text
                    x="50%"
                    y="71%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-extrabold"
                    style={{ fill: activeDepartment.color }}
                  >
                    {activeDepartment.name.length > 15
                      ? activeDepartment.name.slice(0, 13) + "…"
                      : activeDepartment.name}
                  </text>
                )}

                <Tooltip content={<DepartmentTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Enhanced Department List with Workforce Progress Bars */}
            <div
              className="mt-2 space-y-2 max-h-[290px] overflow-y-auto pr-1"
              role="list"
              aria-label="Department employee breakdown"
            >
              {departmentRows.map((department, index) => {
                const isActive = activeDepartmentIndex === index;
                const isMuted = activeDepartmentIndex != null && !isActive;
                return (
                  <button
                    key={department.name}
                    type="button"
                    role="listitem"
                    onMouseEnter={() => setActiveDepartmentIndex(index)}
                    onMouseLeave={() => setActiveDepartmentIndex(null)}
                    onClick={() => navigate({ to: "/admin/employees" })}
                    className={`group flex w-full flex-col gap-1.5 rounded-xl border p-2.5 text-left transition-all duration-200 ${
                      isActive
                        ? "border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/25"
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/40"
                    } ${isMuted ? "opacity-50" : "opacity-100"}`}
                    aria-label={`${department.name}: ${department.value} employees, ${department.percentage}% of total`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                          style={{ backgroundColor: department.color }}
                        />
                        <span className="truncate text-xs font-bold text-foreground">
                          {department.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold tabular-nums text-foreground">
                          {department.value} Staff
                        </span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {department.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar representing department workforce share */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(department.percentage, 4)}%`,
                          backgroundColor: department.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
              <p className="mt-1 text-xs text-muted-foreground">Live HRMS activity timeline</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ActivitySummaryPill label="Today" value={activitySummary.today} />
              <ActivitySummaryPill label="Activities" value={activitySummary.total} />
              <ActivitySummaryPill label="Attendance" value={activitySummary.attendance} />
              <ActivitySummaryPill label="Tasks" value={activitySummary.task} />
              <ActivitySummaryPill label="Leave" value={activitySummary.leave} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Activity filters">
            {ACTIVITY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={activityFilter === filter.value}
                onClick={() => setActivityFilter(filter.value)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all duration-200 ${
                  activityFilter === filter.value
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 shadow-[0_0_18px_rgba(6,182,212,0.14)]"
                    : "border-slate-200 bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        {activityItems.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No activity yet</div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto pr-2 [scrollbar-color:rgba(103,232,249,0.35)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
            <ul className="relative space-y-3 before:absolute before:left-[1.18rem] before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-gradient-to-b before:from-cyan-500/20 before:via-slate-200 before:to-transparent">
              {filteredActivityItems.length ? (
                filteredActivityItems.map((item, index) => (
                  <ActivityTimelineItem
                    key={item.id}
                    item={item}
                    newest={index < 2}
                    onViewDetails={setSelectedActivity}
                    onOpenEmployee={() => navigate({ to: "/admin/employees" })}
                    onOpenTask={() => navigate({ to: "/admin/tasks" })}
                  />
                ))
              ) : (
                <li className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No activity for this filter.
                </li>
              )}
            </ul>
          </div>
        )}
      </GlassCard>
      <ActivityDetailDialog
        item={selectedActivity}
        onOpenChange={(open) => {
          if (!open) setSelectedActivity(null);
        }}
      />
    </div>
  );
}

function summarizeWeeklyAttendance(rows: WeeklyAttendanceDay[]) {
  const present = rows.reduce((sum, row) => sum + Number(row.present ?? 0), 0);
  const late = rows.reduce((sum, row) => sum + Number(row.late ?? 0), 0);
  const wfh = rows.reduce((sum, row) => sum + Number(row.wfh ?? 0), 0);
  const trackedRows = rows.filter((row) => Number(row.totalEmployees ?? 0) > 0);
  const avgAttendance = trackedRows.length
    ? Math.round(
        trackedRows.reduce((sum, row) => sum + Number(row.attendancePct ?? 0), 0) /
          trackedRows.length,
      )
    : 0;
  return { avgAttendance, present, late, wfh };
}

const ACTIVITY_FILTERS: { label: string; value: ActivityFilter }[] = [
  { label: "All", value: "all" },
  { label: "Attendance", value: "attendance" },
  { label: "Tasks", value: "task" },
  { label: "Leave", value: "leave" },
  { label: "Employees", value: "employee" },
];

const ACTIVITY_META: Record<
  ActivityKind,
  {
    icon: typeof BellDot;
    color: string;
    bg: string;
    label: string;
  }
> = {
  attendance_approved: {
    icon: ShieldCheck,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    label: "Attendance Approved",
  },
  attendance_correction: {
    icon: FilePenLine,
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    label: "Attendance Correction Request",
  },
  task_updated: {
    icon: ListChecks,
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    label: "Task Updated",
  },
  task_completed: {
    icon: CheckCircle2,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    label: "Task Completed",
  },
  leave_request: {
    icon: Plane,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    label: "Leave Request",
  },
  employee_added: {
    icon: UserPlus,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    label: "Employee Added",
  },
  announcement: {
    icon: Megaphone,
    color: "#facc15",
    bg: "rgba(250,204,21,0.12)",
    label: "Announcement",
  },
  system: {
    icon: BellDot,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    label: "System",
  },
};

function ActivitySummaryPill({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white/50 px-3 py-2 shadow-sm ${className}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-base font-extrabold leading-none text-slate-800 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function ActivityTimelineItem({
  item,
  newest,
  onViewDetails,
  onOpenEmployee,
  onOpenTask,
}: {
  item: ActivityFeedItem;
  newest: boolean;
  onViewDetails: (item: ActivityFeedItem) => void;
  onOpenEmployee: () => void;
  onOpenTask: () => void;
}) {
  const meta = ACTIVITY_META[item.kind];
  const Icon = meta.icon;
  const absoluteTime = `${formatNepaliDate(item.createdAt, "DD MMM YYYY")} BS, ${format(new Date(item.createdAt), "HH:mm")}`;
  const relativeTime = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  const priority = priorityStyle(item.priority);
  const groupedTitle = item.groupedTitle || item.title;
  const subtitle = item.groupedCount > 1 ? `${item.groupedCount} updates today` : item.message;

  return (
    <li
      className={`group relative flex gap-4 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50/50 ${
        newest
          ? "border-slate-200 bg-white/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
          : "border-slate-200 bg-white/40"
      }`}
    >
      <div className="relative z-10 flex shrink-0 flex-col items-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border shadow-[0_0_18px_currentColor]"
          style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}42` }}
          aria-hidden="true"
        >
          <Icon size={17} />
        </div>
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
          style={{ backgroundColor: priority.color }}
          title={`${priority.label} priority`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{
                  color: meta.color,
                  backgroundColor: meta.bg,
                  borderColor: `${meta.color}38`,
                }}
              >
                {item.badge}
              </span>
              {newest && (
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-600">
                  New
                </span>
              )}
            </div>
            <h4 className="truncate text-sm font-bold text-slate-700">{groupedTitle}</h4>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:justify-end">
            <EmployeeAvatar name={item.employeeName} avatarUrl={item.avatarUrl} />
            <time
              dateTime={item.createdAt}
              title={absoluteTime}
              className="whitespace-nowrap text-xs font-semibold text-muted-foreground"
            >
              {relativeTime}
            </time>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <ActivityAction label="View Details" onClick={() => onViewDetails(item)} />
          <ActivityAction label="Open Employee" onClick={onOpenEmployee} />
          {item.category === "task" && <ActivityAction label="Open Task" onClick={onOpenTask} />}
        </div>
      </div>
    </li>
  );
}

function ActivityAction({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white/50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
    >
      {label}
    </button>
  );
}

function ActivityDetailDialog({
  item,
  onOpenChange,
}: {
  item: ActivityFeedItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const meta = item ? ACTIVITY_META[item.kind] : null;
  const Icon = meta?.icon ?? BellDot;
  const priority = item ? priorityStyle(item.priority) : null;
  const createdAt = item
    ? `${formatNepaliDate(item.createdAt, "DD MMM YYYY")} BS, ${format(new Date(item.createdAt), "HH:mm")}`
    : "";

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden border-border bg-background/95 p-0 sm:max-w-xl">
        {item && meta && priority && (
          <div className="relative">
            <div
              className="absolute inset-x-0 top-0 h-28 opacity-20"
              style={{ background: `linear-gradient(135deg, ${meta.color}, transparent 68%)` }}
            />
            <div className="relative p-6">
              <DialogHeader className="text-left">
                <div className="mb-4 flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_22px_currentColor]"
                    style={{
                      color: meta.color,
                      backgroundColor: meta.bg,
                      borderColor: `${meta.color}42`,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{
                          color: meta.color,
                          backgroundColor: meta.bg,
                          borderColor: `${meta.color}38`,
                        }}
                      >
                        {item.badge}
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{
                          color: priority.color,
                          borderColor: `${priority.color}38`,
                          backgroundColor: `${priority.color}18`,
                        }}
                      >
                        {priority.label} priority
                      </span>
                    </div>
                    <DialogTitle className="mt-2 text-xl font-bold text-foreground">
                      {item.groupedTitle || item.title}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-muted-foreground">
                      {meta.label} from {item.employeeName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Details
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.message || "No extra details were provided."}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ActivityDetailField label="Employee" value={item.employeeName} />
                  <ActivityDetailField label="Time" value={createdAt} />
                  <ActivityDetailField
                    label="Updates"
                    value={item.groupedCount > 1 ? `${item.groupedCount} updates` : "Single update"}
                  />
                  <ActivityDetailField label="Category" value={item.badge} />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActivityDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">{value}</div>
    </div>
  );
}

function EmployeeAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-8 w-8 rounded-full object-cover ring-1 ring-[#f1f0ee]/15"
      />
    );
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-cyan-300/20 via-blue-400/15 to-violet-400/20 text-[11px] font-extrabold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      {initials(name)}
    </div>
  );
}

function normalizeActivityItem(item: any): ActivityFeedItem {
  const title = String(item.title || "System activity");
  const message = String(item.message || "");
  const text = `${title} ${message}`.toLowerCase();
  const kind = detectActivityKind(text);
  const category = activityCategory(kind);
  const createdAt = item.created_at || item.createdAt || new Date().toISOString();
  const employeeName = extractEmployeeName(title, message);
  return {
    id: String(item.id || `${title}-${createdAt}`),
    title,
    message,
    createdAt,
    kind,
    category,
    badge: activityBadge(category),
    priority: detectPriority(text, kind),
    employeeName,
    avatarUrl: item.avatar_url || item.avatarUrl || item.profile_photo_url || null,
    groupedCount: 1,
  };
}

function detectActivityKind(text: string): ActivityKind {
  if (text.includes("correction")) return "attendance_correction";
  if (
    text.includes("attendance") &&
    (text.includes("approved") || text.includes("auto") || text.includes("checkout"))
  )
    return "attendance_approved";
  if (text.includes("completed") && text.includes("task")) return "task_completed";
  if (text.includes("task") || text.includes("moved to") || text.includes("updated"))
    return "task_updated";
  if (text.includes("leave")) return "leave_request";
  if (
    text.includes("employee") &&
    (text.includes("added") || text.includes("approved") || text.includes("joined"))
  )
    return "employee_added";
  if (text.includes("announcement") || text.includes("notice")) return "announcement";
  return "system";
}

function activityCategory(kind: ActivityKind): ActivityFeedItem["category"] {
  if (kind === "attendance_approved" || kind === "attendance_correction") return "attendance";
  if (kind === "task_updated" || kind === "task_completed") return "task";
  if (kind === "leave_request") return "leave";
  if (kind === "employee_added") return "employee";
  return "system";
}

function activityBadge(category: ActivityFeedItem["category"]): ActivityFeedItem["badge"] {
  if (category === "attendance") return "Attendance";
  if (category === "task") return "Task";
  if (category === "leave") return "Leave";
  if (category === "employee") return "Employee";
  return "System";
}

function detectPriority(text: string, kind: ActivityKind): ActivityFeedItem["priority"] {
  if (
    text.includes("urgent") ||
    text.includes("rejected") ||
    text.includes("overdue") ||
    kind === "attendance_correction"
  )
    return "high";
  if (text.includes("pending") || text.includes("request") || kind === "leave_request")
    return "medium";
  return "low";
}

function priorityStyle(priority: ActivityFeedItem["priority"]) {
  if (priority === "high") return { color: "#fb7185", label: "High" };
  if (priority === "medium") return { color: "#f59e0b", label: "Medium" };
  return { color: "#94a3b8", label: "Low" };
}

function groupActivityItems(items: ActivityFeedItem[]) {
  const grouped = new Map<string, ActivityFeedItem>();
  const ordered: ActivityFeedItem[] = [];

  items.forEach((item) => {
    const date = new Date(item.createdAt);
    const key =
      item.kind === "task_updated"
        ? `task:${taskGroupingTitle(item)}:${format(date, "yyyy-MM-dd")}`
        : item.id;

    const existing = grouped.get(key);
    if (existing) {
      existing.groupedCount += 1;
      if (new Date(item.createdAt) > new Date(existing.createdAt)) {
        existing.createdAt = item.createdAt;
      }
      return;
    }

    const next = {
      ...item,
      groupedTitle: item.kind === "task_updated" ? taskGroupingTitle(item) : undefined,
    };
    grouped.set(key, next);
    ordered.push(next);
  });

  return ordered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function taskGroupingTitle(item: ActivityFeedItem) {
  const source = item.title || item.message;
  return (
    source
      .replace(/\bmoved to\b.*$/i, "")
      .replace(/\btask\b/gi, "")
      .replace(/[:|-]\s*(updated|completed|in progress|review).*$/i, "")
      .trim() || item.title
  );
}

function summarizeActivities(items: ActivityFeedItem[]) {
  const todayItems = items.filter((item) => isSameDay(new Date(item.createdAt), new Date()));
  return {
    today: todayItems.length,
    total: items.length,
    attendance: todayItems.filter((item) => item.category === "attendance").length,
    task: todayItems.filter((item) => item.category === "task").length,
    leave: todayItems.filter((item) => item.category === "leave").length,
  };
}

function extractEmployeeName(title: string, message: string) {
  const text = `${title} ${message}`;
  const match = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/);
  return match?.[1] || "AS";
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "AS"
  );
}

function makeDepartmentRows(deptData: any[]): DepartmentRow[] {
  const total = deptData.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  return deptData.map((row, index) => {
    const value = Number(row.value ?? 0);
    const color = getDepartmentColor(row.name, index);
    return {
      name: row.name || "Unassigned",
      value,
      color,
      gradientId: `departmentGradient${index}`,
      percentage: total ? Math.round((value / total) * 100) : 0,
    };
  });
}

function getDepartmentColor(name: string, index: number) {
  const key = String(name || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (key.includes("frontend")) return DEPARTMENT_COLORS.frontend;
  if (key.includes("backend")) return DEPARTMENT_COLORS.backend;
  if (key.includes("admin")) return DEPARTMENT_COLORS.administrator;
  if (key.includes("marketing")) return DEPARTMENT_COLORS.digitalmarketing;
  if (key.includes("uiux") || (key.includes("ui") && key.includes("ux")))
    return DEPARTMENT_COLORS.uiux;
  if (key === "hr" || key.includes("humanresources")) return DEPARTMENT_COLORS.hr;
  if (key.includes("development") || key.includes("developer") || key.includes("engineering"))
    return DEPARTMENT_COLORS.development;
  return COLORS[index % COLORS.length];
}

function renderActiveDepartmentShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="rgba(255,255,255,0.42)"
        strokeWidth={2}
        cornerRadius={8}
        style={{ filter: `drop-shadow(0 0 18px ${payload.color}78)` }}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 8}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={payload.color}
        opacity={0.32}
      />
      {percent > 0.08 && (
        <text
          x={cx}
          y={cy - outerRadius - 18}
          textAnchor="middle"
          fill="rgba(255,255,255,0.78)"
          fontSize={10}
          fontWeight={800}
        >
          {payload.percentage}%
        </text>
      )}
    </g>
  );
}

function DepartmentTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as DepartmentRow | undefined;
  if (!row) return null;

  return (
    <div className="min-w-48 rounded-xl border border-border bg-[#101827]/95 p-3 text-xs text-foreground shadow-[0_18px_60px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
        <span
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]"
          style={{ backgroundColor: row.color, color: row.color }}
        />
        <div>
          <div className="font-bold">{row.name}</div>
          <div className="text-[11px] text-muted-foreground">Department share</div>
        </div>
      </div>
      <TooltipRow label="Employee count" value={row.value} color={row.color} />
      <TooltipRow label="Percentage share" value={`${row.percentage}%`} />
    </div>
  );
}

function lightenHex(hex: string, amount: number) {
  return adjustHex(hex, amount);
}

function darkenHex(hex: string, amount: number) {
  return adjustHex(hex, -amount);
}

function adjustHex(hex: string, amount: number) {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16);
    return Math.max(0, Math.min(255, value + amount))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function WeeklySummaryTile({
  label,
  value,
  icon: Icon,
  accent,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: any;
  accent: "blue" | "emerald" | "amber" | "violet";
  subtext?: string;
}) {
  const styles = {
    blue: {
      border: "border-blue-500/20 hover:border-blue-500/35",
      bg: "bg-blue-50/50 dark:bg-blue-950/20",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    emerald: {
      border: "border-emerald-500/20 hover:border-emerald-500/35",
      bg: "bg-emerald-50/50 dark:bg-emerald-950/20",
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      border: "border-amber-500/20 hover:border-amber-500/35",
      bg: "bg-amber-50/50 dark:bg-amber-950/20",
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    violet: {
      border: "border-violet-500/20 hover:border-violet-500/35",
      bg: "bg-violet-50/50 dark:bg-violet-950/20",
      iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
  }[accent];

  return (
    <div
      className={`rounded-xl border ${styles.border} ${styles.bg} p-3 transition-all duration-200 shadow-xs`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles.iconBg}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="mt-1 text-xl sm:text-2xl font-black tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      {subtext && (
        <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">{subtext}</div>
      )}
    </div>
  );
}

function WeeklyAttendanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as WeeklyAttendanceDay | undefined;
  if (!row) return null;

  return (
    <div className="min-w-56 rounded-xl border border-border bg-card/95 p-3.5 text-xs text-foreground shadow-xl backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between gap-4 border-b border-border/80 pb-2">
        <div>
          <div className="font-bold text-foreground flex items-center gap-1.5">
            <span>{row.day}</span>
            {row.isToday && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                Today
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {row.date ? formatNepaliDate(row.date, "DD MMM YYYY") + " BS" : "Snapshot"}
          </div>
        </div>
        <div className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 font-extrabold text-primary tabular-nums text-xs">
          {row.attendancePct ?? 0}%
        </div>
      </div>
      <TooltipRow label="Total Staff" value={row.totalEmployees ?? 0} />
      <TooltipRow label="Present" value={row.present ?? 0} color={ATTENDANCE_COLORS.present} />
      <TooltipRow label="Late" value={row.late ?? 0} color={ATTENDANCE_COLORS.late} />
      <TooltipRow label="WFH" value={row.wfh ?? 0} color={ATTENDANCE_COLORS.wfh} />
      <TooltipRow label="Absent" value={row.absent ?? 0} color={ATTENDANCE_COLORS.absent} />
      {row.noData && (
        <div className="mt-2 rounded-lg border border-border/70 bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
          No records captured for this day.
        </div>
      )}
    </div>
  );
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="flex items-center gap-2 text-muted-foreground text-xs">
        {color && (
          <span className="h-2 w-2 rounded-full shadow-xs shrink-0" style={{ backgroundColor: color }} />
        )}
        {label}
      </span>
      <strong className="tabular-nums text-foreground font-bold text-xs">{value}</strong>
    </div>
  );
}

function WeeklyAxisTick({ x, y, payload }: any) {
  const row = payload?.payload as WeeklyAttendanceDay | undefined;
  const isToday = row?.isToday;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="middle"
        className={
          isToday
            ? "fill-primary font-black text-[12px]"
            : "fill-muted-foreground font-semibold text-[11px]"
        }
      >
        {payload.value}
      </text>
      {isToday && (
        <g transform="translate(-16,14)">
          <rect width="32" height="15" rx="7.5" className="fill-primary" />
          <text
            x="16"
            y="10.5"
            textAnchor="middle"
            className="fill-primary-foreground text-[8px] font-bold"
          >
            Today
          </text>
        </g>
      )}
    </g>
  );
}

function TrendDot(props: any) {
  const { cx, cy, payload } = props;
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload?.isToday ? 5 : 3.5}
      fill={ATTENDANCE_COLORS.trend}
      stroke="#ffffff"
      strokeWidth={2}
      opacity={payload?.noData ? 0.4 : 1}
      className="drop-shadow-xs"
    />
  );
}

function AttendanceLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
        style={{ backgroundColor: color, color }}
      />
      {label}
    </span>
  );
}
