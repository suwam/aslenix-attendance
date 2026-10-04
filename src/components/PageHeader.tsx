import { ReactNode } from "react";
import { GlassCard } from "@/components/GlassCard";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "red",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: any;
  accent?: "red" | "blue" | "green" | "amber";
  hint?: string;
  delay?: number;
}) {
  const colors: Record<string, string> = {
    red: "var(--neon-red)",
    blue: "var(--neon-blue)",
    green: "var(--success)",
    amber: "var(--warning)",
  };
  return (
    <div>
      <GlassCard className={`metric-card-${accent} overflow-hidden p-5 sm:p-6`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {label}
            </div>
            <div className="text-3xl font-bold mt-2 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/75 shadow-sm"
            style={{
              background: `color-mix(in oklab, ${colors[accent]} 22%, transparent)`,
              color: colors[accent],
            }}
          >
            <Icon size={20} />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
