import logoMarkUrl from "@/assets/aslenix-mark.png";

export function AslenixLogo({
  size = "md",
  showText = true,
}: {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}) {
  const dim = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  return (
    <div className="flex items-center gap-2.5">
      <div className={`relative ${dim} flex items-center justify-center shrink-0`}>
        <img
          src={logoMarkUrl}
          alt="ASLENIX"
          className="relative z-10 h-full w-full object-contain drop-shadow-[0_0_12px_rgba(255,40,90,0.45)]"
          width={size === "lg" ? 48 : size === "sm" ? 32 : 40}
          height={size === "lg" ? 48 : size === "sm" ? 32 : 40}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: "var(--gradient-brand)",
            filter: "blur(16px)",
            opacity: 0.45,
            zIndex: 0,
          }}
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-none items-center">
          <span
            className={`${text} font-bold tracking-[0.1em] text-[#0F172A]`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            ASLENIX
          </span>
          <span className="text-[9px] font-bold text-[#1E293B] tracking-[0.2em] uppercase mt-1">
            TECH & SOLUTION
          </span>
        </div>
      )}
    </div>
  );
}
