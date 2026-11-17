import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "red",
  hint,
  to,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon: any;
  accent?: "red" | "blue" | "green" | "amber";
  hint?: string;
  delay?: number;
  to?: string;
  onClick?: () => void;
}) {
  const colors: Record<string, string> = {
    red: "var(--neon-red)",
    blue: "var(--neon-blue)",
    green: "var(--success)",
    amber: "var(--warning)",
  };

  const isInteractive = Boolean(to || onClick);

  const cardContent = (
    <GlassCard
      className={`metric-card-${accent} overflow-hidden p-5 sm:p-6 transition-all duration-200 ${
        isInteractive
          ? "hover:-translate-y-1 hover:shadow-md hover:border-primary/40 cursor-pointer group"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold group-hover:text-foreground transition-colors">
            {label}
          </div>
          <div className="text-3xl font-extrabold mt-2 tabular-nums text-foreground tracking-tight">
            {value}
          </div>
          {hint && (
            <div className="text-xs text-muted-foreground/90 font-medium mt-1">{hint}</div>
          )}
        </div>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-white/80 dark:bg-card/80 shadow-xs transition-transform duration-200 group-hover:scale-110"
          style={{
            background: `color-mix(in srgb, ${colors[accent]} 18%, transparent)`,
            color: colors[accent],
          }}
        >
          <Icon size={20} />
        </div>
      </div>
    </GlassCard>
  );

  if (to) {
    return (
      <Link to={to} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left p-0 border-0 bg-transparent"
      >
        {cardContent}
      </button>
    );
  }

  return <div>{cardContent}</div>;
}
