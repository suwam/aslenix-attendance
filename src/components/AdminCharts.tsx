import { useState } from "react";
import { BellDot } from "lucide-react";
import { format } from "date-fns";
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
  uiux: "#fb7185",
  hr: "#60a5fa",
  marketing: "#34d399",
  development: "#f59e0b",
};

type WeeklyAttendanceDay = {
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

type DepartmentRow = {
  name: string;
  value: number;
  color: string;
  gradientId: string;
  percentage: number;
};

export default function AdminCharts({
  weekly,
  deptData,
  activity,
}: {
  weekly: WeeklyAttendanceDay[];
  deptData: any[];
  activity: any[];
}) {
  const [activeDepartmentIndex, setActiveDepartmentIndex] = useState<number | null>(null);
  const weeklyRows = weekly.map((row) => {
    const present = Number(row.present ?? 0);
    const late = Number(row.late ?? 0);
    const wfh = Number(row.wfh ?? 0);
    const absent = Number(row.absent ?? 0);
    const totalEmployees = Number(row.totalEmployees ?? present + late + wfh + absent);
    const attended = present + late + wfh;
    return {
      ...row,
      present,
      late,
      wfh,
      absent,
      totalEmployees,
      attendancePct: row.attendancePct ?? (totalEmployees ? Math.round((attended / totalEmployees) * 100) : 0),
      noData: row.noData ?? totalEmployees === 0,
    };
  });
  const summary = summarizeWeeklyAttendance(weeklyRows);
  const departmentRows = makeDepartmentRows(deptData);
  const departmentTotal = departmentRows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard className="lg:col-span-2">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Weekly attendance</h3>
              <p className="mt-1 text-xs text-muted-foreground">Last 7 days by attendance status</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              Live HRMS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <WeeklySummaryTile label="Avg attendance" value={`${summary.avgAttendance}%`} tone="blue" />
            <WeeklySummaryTile label="Total present" value={summary.present} tone="present" />
            <WeeklySummaryTile label="Total late" value={summary.late} tone="late" />
            <WeeklySummaryTile label="Total WFH" value={summary.wfh} tone="wfh" />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={weeklyRows} margin={{ top: 18, right: 10, left: -18, bottom: 8 }} barCategoryGap="28%">
            <defs>
              <linearGradient id="presentBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.present} />
              </linearGradient>
              <linearGradient id="lateBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.late} />
              </linearGradient>
              <linearGradient id="wfhBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.wfh} />
              </linearGradient>
              <linearGradient id="absentBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor={ATTENDANCE_COLORS.absent} />
              </linearGradient>
              <filter id="todayGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#67e8f9" floodOpacity="0.55" />
              </filter>
            </defs>
            <CartesianGrid vertical={false} stroke="oklch(1 0 0 / 0.07)" strokeDasharray="4 8" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={<WeeklyAxisTick />}
              interval={0}
              height={38}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              stroke="oklch(0.76 0.03 250)"
              fontSize={11}
              tickMargin={8}
              allowDecimals={false}
            />
            <Tooltip cursor={{ fill: "oklch(1 0 0 / 0.045)", radius: 12 }} content={<WeeklyAttendanceTooltip />} />
            <Bar dataKey="present" stackId="attendance" fill="url(#presentBar)" radius={[0, 0, 7, 7]} isAnimationActive animationDuration={650}>
              {weeklyRows.map((entry) => <Cell key={`present-${entry.day}`} className="transition-opacity duration-200 hover:opacity-90" filter={entry.isToday ? "url(#todayGlow)" : undefined} />)}
            </Bar>
            <Bar dataKey="late" stackId="attendance" fill="url(#lateBar)" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={700}>
              {weeklyRows.map((entry) => <Cell key={`late-${entry.day}`} filter={entry.isToday ? "url(#todayGlow)" : undefined} />)}
            </Bar>
            <Bar dataKey="wfh" stackId="attendance" fill="url(#wfhBar)" radius={[0, 0, 0, 0]} isAnimationActive animationDuration={760}>
              {weeklyRows.map((entry) => <Cell key={`wfh-${entry.day}`} filter={entry.isToday ? "url(#todayGlow)" : undefined} />)}
            </Bar>
            <Bar dataKey="absent" stackId="attendance" fill="url(#absentBar)" radius={[7, 7, 0, 0]} minPointSize={weeklyRows.some((row) => row.noData) ? 3 : 0} isAnimationActive animationDuration={820}>
              {weeklyRows.map((entry) => (
                <Cell
                  key={`absent-${entry.day}`}
                  stroke={entry.isToday ? "rgba(255,255,255,0.75)" : entry.noData ? "rgba(255,255,255,0.22)" : "transparent"}
                  strokeWidth={entry.isToday ? 1.5 : entry.noData ? 1 : 0}
                  strokeDasharray={entry.noData ? "3 3" : undefined}
                  filter={entry.isToday ? "url(#todayGlow)" : undefined}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="attendancePct"
              yAxisId={0}
              stroke={ATTENDANCE_COLORS.trend}
              strokeWidth={2}
              dot={<TrendDot />}
              activeDot={{ r: 5, stroke: "#06111f", strokeWidth: 2, fill: ATTENDANCE_COLORS.trend }}
              isAnimationActive
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-muted-foreground">
          <AttendanceLegend color={ATTENDANCE_COLORS.present} label="Present" />
          <AttendanceLegend color={ATTENDANCE_COLORS.late} label="Late" />
          <AttendanceLegend color={ATTENDANCE_COLORS.wfh} label="WFH" />
          <AttendanceLegend color={ATTENDANCE_COLORS.absent} label="Absent" />
          <span className="ml-auto hidden items-center gap-1.5 text-cyan-100/80 sm:flex">
            <span className="h-px w-7 bg-cyan-300" />
            Attendance trend
          </span>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Departments</h3>
            <p className="mt-1 text-xs text-muted-foreground">Employee distribution</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-[11px] font-bold text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {departmentRows.length} Departments
          </span>
        </div>
        {departmentRows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No data yet</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={248}>
              <PieChart role="img" aria-label={`Department distribution chart with ${departmentTotal} employees`}>
                <defs>
                  {departmentRows.map((row) => (
                    <linearGradient key={row.gradientId} id={row.gradientId} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={lightenHex(row.color, 28)} />
                      <stop offset="58%" stopColor={row.color} />
                      <stop offset="100%" stopColor={darkenHex(row.color, 10)} />
                    </linearGradient>
                  ))}
                  <filter id="departmentSliceGlow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodOpacity="0.36" />
                  </filter>
                </defs>
                <Pie
                  data={departmentRows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={96}
                  paddingAngle={2.5}
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
                      stroke="rgba(8,13,28,0.88)"
                      strokeWidth={activeDepartmentIndex === i ? 4 : 3}
                      style={{
                        filter: activeDepartmentIndex === i ? `drop-shadow(0 0 14px ${row.color}66)` : `drop-shadow(0 0 7px ${row.color}24)`,
                        transition: "filter 180ms ease, opacity 180ms ease",
                        opacity: activeDepartmentIndex == null || activeDepartmentIndex === i ? 1 : 0.58,
                        outline: "none",
                      }}
                    />
                  ))}
                </Pie>
                <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="30" fontWeight="800">
                  {departmentTotal}
                </text>
                <text x="50%" y="59%" textAnchor="middle" dominantBaseline="middle" fill="rgba(226,232,240,0.62)" fontSize="11" fontWeight="700" letterSpacing="0.8">
                  Employees
                </text>
                <Tooltip content={<DepartmentTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 space-y-2" role="list" aria-label="Department employee breakdown">
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
                    onFocus={() => setActiveDepartmentIndex(index)}
                    onBlur={() => setActiveDepartmentIndex(null)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                      isActive
                        ? "border-white/18 bg-white/[0.075] shadow-[0_10px_28px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]"
                        : "border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.055]"
                    } ${isMuted ? "opacity-55" : "opacity-100"}`}
                    aria-label={`${department.name}: ${department.value} employees, ${department.percentage}% of total`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]"
                      style={{ backgroundColor: department.color, color: department.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white/90">{department.name}</span>
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.12em] text-white/38">
                        {department.percentage}% of workforce
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-extrabold tabular-nums text-white">{department.value}</span>
                      <span className="block text-[10px] font-semibold text-muted-foreground">Employees</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <h3 className="text-lg font-semibold mb-4">Recent activity</h3>
        {activity.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No activity yet</div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((n) => (
              <li key={n.id} className="py-3 flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--gradient-brand-soft)" }}
                >
                  <BellDot size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{n.message}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatNepaliDate(n.created_at, "DD MMM")} BS, {format(new Date(n.created_at), "HH:mm")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function summarizeWeeklyAttendance(rows: WeeklyAttendanceDay[]) {
  const present = rows.reduce((sum, row) => sum + Number(row.present ?? 0), 0);
  const late = rows.reduce((sum, row) => sum + Number(row.late ?? 0), 0);
  const wfh = rows.reduce((sum, row) => sum + Number(row.wfh ?? 0), 0);
  const trackedRows = rows.filter((row) => Number(row.totalEmployees ?? 0) > 0);
  const avgAttendance = trackedRows.length
    ? Math.round(trackedRows.reduce((sum, row) => sum + Number(row.attendancePct ?? 0), 0) / trackedRows.length)
    : 0;
  return { avgAttendance, present, late, wfh };
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
  const key = String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  if (key.includes("uiux") || (key.includes("ui") && key.includes("ux"))) return DEPARTMENT_COLORS.uiux;
  if (key === "hr" || key.includes("humanresources")) return DEPARTMENT_COLORS.hr;
  if (key.includes("marketing")) return DEPARTMENT_COLORS.marketing;
  if (key.includes("development") || key.includes("developer") || key.includes("engineering")) return DEPARTMENT_COLORS.development;
  return COLORS[index % COLORS.length];
}

function renderActiveDepartmentShape(props: any) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
  } = props;

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
    <div className="min-w-48 rounded-xl border border-white/10 bg-[#101827]/95 p-3 text-xs text-white shadow-[0_18px_60px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: row.color, color: row.color }} />
        <div>
          <div className="font-bold">{row.name}</div>
          <div className="text-[11px] text-white/50">Department share</div>
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
    return Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

function WeeklySummaryTile({ label, value, tone }: { label: string; value: string | number; tone: "blue" | "present" | "late" | "wfh" }) {
  const toneClass = {
    blue: "from-cyan-300/16 to-blue-400/8 text-cyan-100",
    present: "from-blue-400/18 to-blue-400/6 text-blue-100",
    late: "from-amber-300/18 to-amber-400/6 text-amber-100",
    wfh: "from-violet-300/18 to-violet-400/6 text-violet-100",
  }[tone];

  return (
    <div className={`rounded-lg border border-white/10 bg-gradient-to-br ${toneClass} px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/48">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums leading-none">{value}</div>
    </div>
  );
}

function WeeklyAttendanceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as WeeklyAttendanceDay | undefined;
  if (!row) return null;

  return (
    <div className="min-w-52 rounded-xl border border-white/10 bg-[#101827]/95 p-3 text-xs text-white shadow-[0_18px_60px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-white/10 pb-2">
        <div>
          <div className="font-semibold">{row.day}{row.isToday ? " · Today" : ""}</div>
          <div className="text-[11px] text-white/50">{row.date ? formatNepaliDate(row.date, "DD MMM YYYY") + " BS" : "Weekly snapshot"}</div>
        </div>
        <div className="rounded-full bg-cyan-300/10 px-2 py-1 font-bold text-cyan-100 tabular-nums">{row.attendancePct ?? 0}%</div>
      </div>
      <TooltipRow label="Total employees" value={row.totalEmployees ?? 0} />
      <TooltipRow label="Present" value={row.present ?? 0} color={ATTENDANCE_COLORS.present} />
      <TooltipRow label="Late" value={row.late ?? 0} color={ATTENDANCE_COLORS.late} />
      <TooltipRow label="WFH" value={row.wfh ?? 0} color={ATTENDANCE_COLORS.wfh} />
      <TooltipRow label="Absent" value={row.absent ?? 0} color={ATTENDANCE_COLORS.absent} />
      <TooltipRow label="Attendance percentage" value={`${row.attendancePct ?? 0}%`} />
      {row.noData && <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/58">No attendance records captured for this day.</div>}
    </div>
  );
}

function TooltipRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="flex items-center gap-2 text-white/62">
        {color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
        {label}
      </span>
      <strong className="tabular-nums text-white">{value}</strong>
    </div>
  );
}

function WeeklyAxisTick({ x, y, payload }: any) {
  const row = payload?.payload as WeeklyAttendanceDay | undefined;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fill={row?.isToday ? "#e0f7ff" : "oklch(0.76 0.03 250)"} fontSize={11} fontWeight={row?.isToday ? 800 : 600}>
        {payload.value}
      </text>
      {row?.isToday && (
        <g transform="translate(-18,16)">
          <rect width="36" height="16" rx="8" fill="rgba(103,232,249,0.14)" stroke="rgba(103,232,249,0.38)" />
          <text x="18" y="11" textAnchor="middle" fill="#cffafe" fontSize="8" fontWeight="800">
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
      r={payload?.isToday ? 4.5 : 3}
      fill={ATTENDANCE_COLORS.trend}
      stroke={payload?.isToday ? "#ffffff" : "#07111f"}
      strokeWidth={payload?.isToday ? 2 : 1.5}
      opacity={payload?.noData ? 0.55 : 1}
      filter={payload?.isToday ? "url(#todayGlow)" : undefined}
    />
  );
}

function AttendanceLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]" style={{ backgroundColor: color, color }} />
      {label}
    </span>
  );
}
