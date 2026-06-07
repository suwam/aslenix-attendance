import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import { GlassCard } from "@/components/GlassCard";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import {
  ShieldCheck,
  ShieldX,
  Loader2,
  BadgeCheck,
  Building2,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Fingerprint,
  Hash,
  IdCard,
  LockKeyhole,
  Radio,
  Sparkles,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/verify-employee/$qrToken")({
  component: VerifyEmployeePage,
});

type VerifyData = {
  employee_code: string | null;
  full_name: string;
  department: string | null;
  job_position: string | null;
  joining_date: string | null;
  avatar_url: string | null;
  approval_status: string;
  qr_status: "active" | "inactive" | "revoked";
  role: string | null;
  qr_generated_at: string | null;
  is_valid: boolean;
};

function VerifyEmployeePage() {
  const { qrToken } = Route.useParams();
  const [data, setData] = useState<VerifyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase.rpc("verify_employee_qr", { _token: qrToken });
      if (error) setError(error.message);
      else setData((rows?.[0] as VerifyData) ?? null);
      setLoading(false);
    })();
  }, [qrToken]);

  return (
    <div
      className="verify-employee-screen min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
    >
      <div className="verification-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="verification-grid" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <AslenixLogo size="lg" />
        </div>

        {loading ? (
          <GlassCard className="text-center py-16">
            <Loader2 className="mx-auto animate-spin text-primary" />
            <div className="mt-3 text-sm text-muted-foreground">Verifying employee…</div>
          </GlassCard>
        ) : !data || error ? (
          <InvalidCard reason="QR code not found" />
        ) : !data.is_valid ? (
          <InvalidCard
            reason={
              data.qr_status === "revoked"
                ? "This QR has been revoked"
                : "QR is inactive or employee suspended"
            }
            name={data.full_name}
          />
        ) : (
          <ValidCard data={data} />
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/55">
          <LockKeyhole size={13} className="text-cyan-300/70" />
          ASLENIX Secure Employee Verification
        </div>
      </div>
    </div>
  );
}

function ValidCard({ data }: { data: VerifyData }) {
  const [verifiedAt] = useState(() => new Date());
  const initials = data.full_name
    ?.split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const joinedDate = data.joining_date
    ? `${formatNepaliDate(data.joining_date, "DD MMMM YYYY")} BS`
    : "—";
  const generatedDate = formatDateTime(data.qr_generated_at);
  const verifiedTimestamp = formatDateTime(verifiedAt);

  return (
    <GlassCard className="verification-card animate-card-float overflow-hidden rounded-[28px] p-5 sm:p-7">
      <div className="verification-card-sheen" aria-hidden="true" />

      <div className="relative z-10">
        <div className="flex flex-col items-center text-center">
          <div className="verified-security-badge">
            <ShieldCheck size={20} />
            <span>QR VERIFIED</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5 text-[11px] font-medium text-cyan-100/75">
            <Clock3 size={13} className="text-cyan-300" />
            Verified {verifiedTimestamp}
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center text-center">
          <div className="relative">
            <div className="employee-photo-ring">
              {data.avatar_url ? (
                <img
                  src={data.avatar_url}
                  alt={data.full_name}
                  className="h-32 w-32 rounded-full object-cover sm:h-36 sm:w-36"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0b1024,#18213c)] text-4xl font-black text-white sm:h-36 sm:w-36">
                  {initials}
                </div>
              )}
            </div>
            <div className="verification-check-pulse absolute -right-1 bottom-3 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200/60 bg-emerald-400 text-slate-950 shadow-[0_0_28px_rgba(52,211,153,.72)]">
              <CheckCircle2 size={24} strokeWidth={3} />
            </div>
          </div>

          <h1 className="mt-5 flex max-w-full items-center justify-center gap-2 text-balance text-3xl font-black leading-tight text-white drop-shadow-[0_0_26px_rgba(34,211,238,.2)] sm:text-4xl">
            {data.full_name}
            <BadgeCheck className="shrink-0 text-cyan-300 drop-shadow-[0_0_16px_rgba(34,211,238,.65)]" size={25} />
          </h1>
          <div className="mt-2 text-sm font-medium text-cyan-100/70">{data.job_position || "Employee"}</div>
          <div className="department-pill mt-4">
            <Building2 size={14} />
            {data.department || "Unassigned"}
          </div>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Detail icon={<Hash size={18} />} label="Employee ID" value={data.employee_code || "—"} mono />
          <Detail
            icon={<Briefcase size={18} />}
            label="Role"
            value={(data.role || "employee").replace("_", " ")}
            className="capitalize"
          />
          <Detail icon={<Building2 size={18} />} label="Department" value={data.department || "—"} />
          <Detail icon={<Calendar size={18} />} label="Join Date" value={joinedDate} />
        </div>

        <div className="verification-status-card mt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 shadow-[inset_0_0_18px_rgba(52,211,153,.16)]">
              <UserCheck size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100/45">
                Verification Status
              </div>
              <div className="mt-1 text-lg font-extrabold text-white">Verified</div>
            </div>
            <Radio className="text-emerald-300" size={19} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatusMetric label="Employee" value="Active" />
            <StatusMetric label="Last Verified" value={generatedDate} />
          </div>
        </div>

        <div className="trust-banner mt-5">
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 shadow-[inset_0_0_20px_rgba(255,255,255,.08)]">
              <ShieldCheck size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">
                This employee is officially verified by ASLENIX
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/55">
                <Fingerprint size={12} />
                Secure identity signal
              </div>
            </div>
            <div className="hidden items-center gap-1 sm:flex" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,.95)]" />
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.95)]" />
              <span className="h-2 w-2 rounded-full bg-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,.95)]" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/50">
          <LockKeyhole size={13} className="text-emerald-300/80" />
          ASLENIX Secure Employee Verification
        </div>
      </div>
    </GlassCard>
  );
}

function InvalidCard({ reason, name }: { reason: string; name?: string }) {
  return (
    <GlassCard className="text-center py-10">
      <div
        className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
        style={{
          background: "color-mix(in oklab, #ef4444 20%, transparent)",
          border: "1px solid color-mix(in oklab, #ef4444 40%, transparent)",
        }}
      >
        <ShieldX className="text-red-400" size={28} />
      </div>
      <h1 className="mt-4 text-xl font-bold text-red-300">Invalid QR Code</h1>
      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      {name && <p className="mt-3 text-xs text-muted-foreground">Employee: {name}</p>}
      <div className="mt-5 text-[11px] text-muted-foreground">
        Contact ASLENIX HR if you believe this is an error.
      </div>
    </GlassCard>
  );
}

function Detail({
  icon,
  label,
  value,
  mono,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="verification-info-card group">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 shadow-[inset_0_0_18px_rgba(34,211,238,.1)] transition-colors group-hover:bg-fuchsia-300/10 group-hover:text-fuchsia-100">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/45">{label}</div>
        <div className={`mt-1 truncate text-sm font-bold text-white ${mono ? "font-mono" : ""} ${className || ""}`}>
          {value}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-cyan-100/30 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-200" />
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-100/45">{label}</div>
      <div className="mt-1 truncate text-sm font-extrabold text-emerald-200">{value}</div>
    </div>
  );
}

function formatDateTime(value: string | Date | null) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
