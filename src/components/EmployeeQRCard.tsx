import { forwardRef, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import JsBarcode from "jsbarcode";
import { AslenixLogo } from "@/components/AslenixLogo";
import { Barcode, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export type CodeDisplayType = "barcode" | "qr";

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
  is_suspended: boolean;
};

export function buildVerifyUrl(token: string | null) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/verify-employee/${token ?? ""}`;
}

export function buildQRPayload(p: QRProfile) {
  // QR encodes the verification URL — scanning opens the public verify page.
  return buildVerifyUrl(p.qr_token);
}

export interface EmployeeQRCardProps {
  profile: QRProfile;
  size?: number;
  defaultType?: CodeDisplayType;
  type?: CodeDisplayType;
  onTypeChange?: (type: CodeDisplayType) => void;
  showToggle?: boolean;
}

export const EmployeeQRCard = forwardRef<HTMLDivElement, EmployeeQRCardProps>(
  function EmployeeQRCard(
    {
      profile,
      size = 160,
      defaultType = "barcode",
      type: controlledType,
      onTypeChange,
      showToggle = true,
    },
    ref,
  ) {
    const [internalType, setInternalType] = useState<CodeDisplayType>(defaultType);
    const activeType = controlledType ?? internalType;

    const setType = (newType: CodeDisplayType) => {
      if (controlledType === undefined) {
        setInternalType(newType);
      }
      onTypeChange?.(newType);
    };

    const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

    const disabled =
      profile.qr_status !== "active" ||
      profile.approval_status !== "approved" ||
      profile.is_suspended;

    const initials = profile.full_name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    const barcodeValue = (
      profile.employee_code ||
      (profile.qr_token ? `ASL-${profile.qr_token.slice(0, 6).toUpperCase()}` : "ASL-00000")
    ).replace(/[^\x20-\x7E]/g, "").trim() || "ASL-00000";

    useEffect(() => {
      if (activeType !== "barcode" || !barcodeCanvasRef.current || typeof window === "undefined") {
        return;
      }
      try {
        JsBarcode(barcodeCanvasRef.current, barcodeValue, {
          format: "CODE128",
          lineColor: "#0f172a",
          background: "#ffffff",
          width: size < 140 ? 1.4 : 1.8,
          height: size < 140 ? 38 : 52,
          displayValue: true,
          text: barcodeValue,
          font: "monospace",
          fontOptions: "600",
          fontSize: size < 140 ? 11 : 13,
          textMargin: 3,
          margin: 6,
        });
      } catch (err) {
        console.warn("Failed to generate barcode:", err);
      }
    }, [activeType, barcodeValue, size]);

    return (
      <div
        ref={ref}
        className="rounded-2xl p-5 relative overflow-hidden select-none transition-all"
        style={{
          background: "var(--card)",
          border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)",
          boxShadow: "var(--shadow-neon-red), var(--shadow-glass)",
          width: 320,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="relative flex items-center justify-between">
          <AslenixLogo size="sm" />
          <div className="flex items-center gap-1.5">
            {showToggle && (
              <div
                className="flex items-center bg-background/80 backdrop-blur-sm rounded-full p-0.5 border border-border/60 text-[10px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  title="Generate as Barcode"
                  onClick={() => setType("barcode")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer",
                    activeType === "barcode"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Barcode className="h-3 w-3" />
                  <span>Barcode</span>
                </button>
                <button
                  type="button"
                  title="Generate as QR Code"
                  onClick={() => setType("qr")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer",
                    activeType === "qr"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <QrCode className="h-3 w-3" />
                  <span>QR</span>
                </button>
              </div>
            )}
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold"
              style={{
                background: disabled
                  ? "color-mix(in oklab, #ef4444 25%, transparent)"
                  : "color-mix(in oklab, #10b981 25%, transparent)",
                color: disabled ? "#fca5a5" : "#86efac",
              }}
            >
              {profile.qr_status}
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex items-center gap-3">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/50"
            />
          ) : (
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-foreground text-base font-bold"
              style={{ background: "var(--gradient-brand)" }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-foreground font-semibold truncate">{profile.full_name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {profile.position || "—"}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {profile.department || "Unassigned"}
            </div>
          </div>
        </div>

        {activeType === "barcode" ? (
          <div className="relative mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px] px-0.5">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Employee ID
                </span>
                <span className="font-mono text-foreground font-semibold">
                  {profile.employee_code || "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-medium">
                  Email
                </span>
                <span className="text-[10px] text-muted-foreground max-w-[150px] truncate block">
                  {profile.email}
                </span>
              </div>
            </div>

            <div
              className="rounded-xl bg-white p-2.5 flex items-center justify-center overflow-hidden border border-black/10 shadow-sm"
              style={{ filter: disabled ? "grayscale(1) opacity(0.5)" : undefined }}
            >
              <canvas ref={barcodeCanvasRef} className="max-w-full h-auto block" />
            </div>
          </div>
        ) : (
          <div className="relative mt-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                Employee ID
              </div>
              <div className="text-sm font-mono text-foreground truncate">
                {profile.employee_code || "—"}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">
                Email
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{profile.email}</div>
            </div>
            <div
              className="rounded-lg bg-[#f1f0ee] p-2 shrink-0"
              style={{ filter: disabled ? "grayscale(1) opacity(0.5)" : undefined }}
            >
              <QRCodeCanvas
                value={buildQRPayload(profile)}
                size={size}
                level="H"
                includeMargin={false}
              />
            </div>
          </div>
        )}

        <div className="relative mt-3 text-[9px] text-muted-foreground text-center tracking-wider">
          ASLENIX • DIGITAL EMPLOYEE ID
        </div>
      </div>
    );
  },
);
