import { BellDot } from "lucide-react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { GlassCard } from "@/components/GlassCard";

const COLORS = [
  "oklch(0.65 0.27 22)",
  "oklch(0.6 0.25 260)",
  "oklch(0.72 0.18 155)",
  "oklch(0.82 0.17 75)",
  "oklch(0.7 0.2 320)",
  "oklch(0.65 0.2 200)",
];

export default function AdminCharts({
  weekly,
  deptData,
  activity,
}: {
  weekly: any[];
  deptData: any[];
  activity: any[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <GlassCard className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Weekly attendance</h3>
          <span className="text-xs text-muted-foreground">Last 7 days</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weekly}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
            <XAxis dataKey="day" stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <YAxis stroke="oklch(0.7 0.03 250)" fontSize={12} />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.025 265)",
                border: "1px solid oklch(1 0 0 / 0.1)",
                borderRadius: 12,
              }}
            />
            <Bar dataKey="present" stackId="a" fill="oklch(0.6 0.25 260)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="late" stackId="a" fill="oklch(0.82 0.17 75)" />
            <Bar dataKey="wfh" stackId="a" fill="oklch(0.72 0.18 155)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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
                }}
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
                  {format(new Date(n.created_at), "MMM d, HH:mm")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
