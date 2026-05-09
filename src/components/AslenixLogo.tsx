import { Zap } from "lucide-react";

export function AslenixLogo({ size = "md", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const dim = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative ${dim} rounded-xl flex items-center justify-center`} style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }}>
        <Zap className="text-white" strokeWidth={2.5} size={size === "lg" ? 22 : size === "sm" ? 14 : 18} />
        <span className="absolute inset-0 rounded-xl animate-pulse-glow" style={{ background: "var(--gradient-brand)", filter: "blur(12px)", opacity: 0.5, zIndex: -1 }} />
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`${text} font-bold gradient-text tracking-tight`} style={{ fontFamily: "var(--font-display)" }}>ASLENIX</span>
          <span className="text-[9px] font-medium text-muted-foreground tracking-[0.25em] uppercase">Attendance</span>
        </div>
      )}
    </div>
  );
}
