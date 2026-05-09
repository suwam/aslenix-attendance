import { ReactNode } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
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
  label, value, icon: Icon, accent = "red", hint, delay = 0,
}: {
  label: string; value: ReactNode; icon: any; accent?: "red" | "blue" | "green" | "amber";
  hint?: string; delay?: number;
}) {
  const colors: Record<string, string> = {
    red: "var(--neon-red)",
    blue: "var(--neon-blue)",
    green: "var(--success)",
    amber: "var(--warning)",
  };
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <GlassCard className="overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
            <div className="text-3xl font-bold mt-2 tabular-nums">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in oklab, ${colors[accent]} 22%, transparent)`, color: colors[accent] }}>
            <Icon size={20} />
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
