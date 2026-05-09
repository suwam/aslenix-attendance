import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlassCard({
  children,
  className,
  glow,
}: {
  children: ReactNode;
  className?: string;
  glow?: "red" | "blue" | "none";
}) {
  return (
    <div
      className={cn("glass rounded-2xl p-6 relative", className)}
      style={
        glow === "red"
          ? { boxShadow: "var(--shadow-neon-red), var(--shadow-glass)" }
          : glow === "blue"
          ? { boxShadow: "var(--shadow-neon-blue), var(--shadow-glass)" }
          : undefined
      }
    >
      {children}
    </div>
  );
}
