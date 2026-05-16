import { ReactNode } from "react";
import { AslenixLogo } from "@/components/AslenixLogo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full opacity-30"
        style={{ background: "var(--neon-red)", filter: "blur(120px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-96 w-96 rounded-full opacity-30"
        style={{ background: "var(--neon-blue)", filter: "blur(120px)" }}
      />

      <div className="glass-strong rounded-3xl p-8 sm:p-10 w-full max-w-md relative z-10">
        <div className="flex justify-center mb-7">
          <AslenixLogo size="lg" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-center">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground text-center mt-2">{subtitle}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}
