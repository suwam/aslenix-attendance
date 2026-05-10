import logoUrl from "@/assets/aslenix-logo.png";

export function AslenixLogo({ size = "md", showText = true }: { size?: "sm" | "md" | "lg"; showText?: boolean }) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative ${dim} flex items-center justify-center shrink-0`}>
        <img src={logoUrl} alt="ASLENIX" className="h-full w-full object-contain relative z-10 drop-shadow-[0_0_12px_rgba(255,40,90,0.45)]" />
        <span className="absolute inset-0 rounded-full" style={{ background: "var(--gradient-brand)", filter: "blur(16px)", opacity: 0.45, zIndex: 0 }} />
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
