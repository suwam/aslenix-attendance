import { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { AslenixLogo } from "@/components/AslenixLogo";

export type QRProfile = {
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  employee_code: string | null;
  qr_token: string | null;
  qr_status: "active" | "inactive" | "revoked";
  approval_status: string;
  avatar_url: string | null;
};

export function buildVerifyUrl(token: string | null) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/verify-employee/${token ?? ""}`;
}

export function buildQRPayload(p: QRProfile) {
  // QR encodes the verification URL — scanning opens the public verify page.
  return buildVerifyUrl(p.qr_token);
}

export const EmployeeQRCard = forwardRef<HTMLDivElement, { profile: QRProfile; size?: number }>(
  function EmployeeQRCard({ profile, size = 160 }, ref) {
    const disabled = profile.qr_status !== "active";
    const initials = profile.full_name?.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    return (
      <div
        ref={ref}
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(140deg, oklch(0.16 0.04 260 / 0.95), oklch(0.10 0.02 260 / 0.95))",
          border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
          boxShadow: "var(--shadow-neon-red), var(--shadow-glass)",
          width: 320,
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: "var(--gradient-brand)" }} />
        <div className="relative flex items-center justify-between">
          <AslenixLogo size="sm" />
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold"
            style={{
              background: disabled ? "color-mix(in oklab, #ef4444 25%, transparent)" : "color-mix(in oklab, #10b981 25%, transparent)",
              color: disabled ? "#fca5a5" : "#86efac",
            }}
          >
            {profile.qr_status}
          </span>
        </div>

        <div className="relative mt-4 flex items-center gap-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/50" />
          ) : (
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-white text-base font-bold" style={{ background: "var(--gradient-brand)" }}>
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{profile.full_name}</div>
            <div className="text-[11px] text-white/60 truncate">{profile.position || "—"}</div>
            <div className="text-[10px] text-white/40 truncate">{profile.department || "Unassigned"}</div>
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-wider text-white/40">Employee ID</div>
            <div className="text-sm font-mono text-white truncate">{profile.employee_code || "—"}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/40 mt-2">Email</div>
            <div className="text-[10px] text-white/70 truncate">{profile.email}</div>
          </div>
          <div className="rounded-lg bg-white p-2 shrink-0" style={{ filter: disabled ? "grayscale(1) opacity(0.5)" : undefined }}>
            <QRCodeCanvas
              value={buildQRPayload(profile)}
              size={size}
              level="H"
              includeMargin={false}
            />
          </div>
        </div>

        <div className="relative mt-3 text-[9px] text-white/30 text-center tracking-wider">
          ASLENIX • DIGITAL EMPLOYEE ID
        </div>
      </div>
    );
  }
);
