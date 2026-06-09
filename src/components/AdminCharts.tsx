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

export default function AdminCharts({
  weekly,
  deptData,
  activity,
}: {
  weekly: WeeklyAttendanceDay[];
  deptData: any[];
  activity: any[];
}) {
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
        <h3 className="text-lg font-semibold mb-4">Departments</h3>
        {deptData.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={deptData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
              >
                {deptData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.025 265)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                  color: "white",
                }}
                itemStyle={{ color: "white" }}
                labelStyle={{ color: "white" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="mt-2 space-y-1.5">
          {deptData.slice(0, 5).map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {d.name}
              </div>
              <span className="text-muted-foreground tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
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
