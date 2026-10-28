import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoMarkUrl from "@/assets/aslenix-mark.png";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  IdCard,
  LockKeyhole,
  UserCheck,
  Briefcase,
  Loader2,
  Mail,
  ExternalLink,
  Sparkles,
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
    let isMounted = true;

    async function verify() {
      setLoading(true);
      setError(null);

      try {
        // 1. Try secure RPC
        const { data: rows, error: rpcErr } = await supabase.rpc("verify_employee_qr", {
          _token: qrToken,
        });

        if (rows && rows.length > 0) {
          if (isMounted) setData((rows[0] as VerifyData) ?? null);
          return;
        }

        // 2. Fallback: lookup by employee_code or qr_token
        const { data: profiles, error: selectErr } = await supabase
          .from("profiles")
          .select(
            "user_id, employee_code, full_name, department, position, joining_date, avatar_url, approval_status, qr_status, is_suspended, qr_generated_at",
          )
          .or(`employee_code.ilike.${qrToken},qr_token.eq.${qrToken}`)
          .limit(1);

        if (profiles && profiles.length > 0) {
          const emp = profiles[0];

          // Fetch role from user_roles
          let resolvedRole = "employee";
          if (emp.user_id) {
            const { data: roleRow } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", emp.user_id)
              .maybeSingle();
            if (roleRow?.role) resolvedRole = roleRow.role;
          }

          if (isMounted) {
            setData({
              employee_code: emp.employee_code,
              full_name: emp.full_name?.trim() || "Employee",
              department: emp.department,
              job_position: emp.position,
              joining_date: emp.joining_date,
              avatar_url: emp.avatar_url,
              approval_status: emp.approval_status,
              qr_status: (emp.qr_status as any) || "inactive",
              role: resolvedRole,
              qr_generated_at: emp.qr_generated_at,
              is_valid:
                emp.qr_status === "active" &&
                emp.approval_status === "approved" &&
                !emp.is_suspended,
            });
          }
        } else {
          if (isMounted) {
            setError(rpcErr ? rpcErr.message : selectErr ? selectErr.message : "Employee not found");
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to verify employee record");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [qrToken]);

  return (
    <div className="relative min-h-screen bg-[#0B1020] text-[#F7F8FC] flex flex-col justify-between p-3.5 sm:p-6 md:p-8 antialiased selection:bg-[#69E8F5] selection:text-[#0B1020]">
      {/* Subtle futuristic background lighting */}
      <div
        className="pointer-events-none fixed -top-24 left-1/2 -translate-x-1/2 h-[380px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(105,232,245,0.08)_0%,rgba(167,139,250,0.05)_40%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-24 left-1/2 -translate-x-1/2 h-[340px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(16,201,154,0.06)_0%,transparent_65%)] blur-3xl"
        aria-hidden="true"
      />

      {/* Subtle precision technical grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[440px] mx-auto my-auto flex flex-col items-center space-y-3.5 sm:space-y-4">
        {/* A. Compact Brand Header */}
        <header className="flex items-center justify-between w-full pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-[#17152F] border border-white/10 flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(105,232,245,0.15)]">
              <img src={logoMarkUrl} alt="ASLENIX" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-extrabold tracking-[0.14em] text-[#F7F8FC] leading-none">
                ASLENIX
              </span>
              <span className="text-[9px] font-bold tracking-[0.24em] text-[#8791A8] uppercase leading-tight mt-0.5">
                TECH & SOLUTION
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#17152F] border border-white/10 text-[10px] font-mono tracking-wider text-[#69E8F5] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10C99A] animate-pulse" />
            <span>IDENTITY PASS</span>
          </div>
        </header>

        {/* Dynamic Card States */}
        {loading ? (
          <LoadingIdentityCard />
        ) : !data || error ? (
          <InvalidIdentityCard
            status="not_found"
            title="Unable to Verify Employee"
            description="No active employee record matches this verification token. The QR code may be invalid, expired, or unrecognized."
          />
        ) : !data.is_valid ? (
          <InvalidIdentityCard
            status={data.qr_status === "revoked" ? "revoked" : "inactive"}
            name={data.full_name}
            title={
              data.qr_status === "revoked"
                ? "Credential Revoked"
                : "Employee Account Inactive"
            }
            description={
              data.qr_status === "revoked"
                ? "This employee credential has been officially revoked by ASLENIX administration."
                : "The employee profile associated with this QR code is currently inactive or awaiting approval."
            }
          />
        ) : (
          <ValidIdentityCard data={data} qrToken={qrToken} />
        )}

        {/* F. Official Verification Footer */}
        <footer className="text-center pt-2 pb-1 space-y-1 w-full">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#8791A8]">
            <LockKeyhole size={11} className="text-[#69E8F5] shrink-0" />
            <span>ASLENIX SECURE EMPLOYEE VERIFICATION</span>
          </div>
          <p className="text-[10px] text-[#8791A8]/70 leading-relaxed max-w-xs mx-auto">
            Official digital verification portal &bull; ASLENIX Tech &amp; Solution
          </p>
        </footer>
      </div>
    </div>
  );
}

function ValidIdentityCard({
  data,
  qrToken,
}: {
  data: VerifyData;
  qrToken: string;
}) {
  const [verifiedTime] = useState(() => new Date());

  const initials =
    data.full_name
      ?.split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AS";

  const formattedJoinDate = data.joining_date
    ? `${formatNepaliDate(data.joining_date, "DD MMMM YYYY")} BS`
    : "—";

  const verifiedTimeFormatted = formatVerificationTimestamp(verifiedTime);
  const issuedDateFormatted = formatCredentialDate(data.qr_generated_at);
  const displayRole = formatRoleName(data.role, data.job_position);

  return (
    <div className="w-full space-y-3.5 sm:space-y-4">
      {/* B. Verification Hero */}
      <div className="w-full rounded-2xl bg-[#17152F]/90 border border-[#10C99A]/30 p-3 sm:p-3.5 shadow-[0_4px_20px_-4px_rgba(16,201,154,0.15)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10C99A]/15 border border-[#10C99A]/40 text-[#10C99A]">
              <ShieldCheck size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-extrabold tracking-[0.12em] text-[#10C99A] uppercase leading-none">
                QR VERIFIED
              </span>
              <span className="text-[10px] font-mono text-[#8791A8] mt-0.5">
                {verifiedTimeFormatted}
              </span>
            </div>
          </div>

          {/* Segmented Technical Verification Line */}
          <div className="flex items-center gap-1" title="Cryptographically verified">
            <span className="h-1.5 w-2.5 rounded-xs bg-[#10C99A]" />
            <span className="h-1.5 w-2.5 rounded-xs bg-[#10C99A]" />
            <span className="h-1.5 w-2.5 rounded-xs bg-[#10C99A]" />
            <span className="h-1.5 w-2.5 rounded-xs bg-[#10C99A]/40" />
          </div>
        </div>
      </div>

      {/* C. Signature Employee Identity Card (The Centerpiece) */}
      <div className="relative w-full rounded-3xl bg-gradient-to-b from-[#17152F] to-[#0F1426] border border-white/10 p-5 sm:p-6 overflow-hidden shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {/* Subtle technical background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]"
          aria-hidden="true"
        />

        {/* Technical Corner Crosshair Accents */}
        <span className="absolute top-3 left-3 text-[10px] font-mono text-[#69E8F5]/40 select-none">+</span>
        <span className="absolute top-3 right-3 text-[10px] font-mono text-[#69E8F5]/40 select-none">+</span>
        <span className="absolute bottom-3 left-3 text-[10px] font-mono text-[#69E8F5]/40 select-none">+</span>
        <span className="absolute bottom-3 right-3 text-[10px] font-mono text-[#69E8F5]/40 select-none">+</span>

        {/* Avatar & Cyan-Violet Orbital Ring */}
        <div className="relative mx-auto flex justify-center">
          <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-[#69E8F5] via-[#A78BFA] to-[#10C99A] shadow-[0_0_20px_rgba(105,232,245,0.25)]">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.full_name}
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover bg-[#0B1020]"
              />
            ) : (
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-[#0B1020] text-[#F7F8FC] font-extrabold text-2xl sm:text-3xl tracking-wider">
                {initials}
              </div>
            )}

            {/* Verification Checkmark Badge attached to Avatar */}
            <div
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[#10C99A] text-slate-950 ring-3 ring-[#17152F] shadow-md"
              title="Verified Active Member"
            >
              <CheckCircle2 size={16} strokeWidth={2.75} />
            </div>
          </div>
        </div>

        {/* Name & Official Designation */}
        <div className="mt-4 text-center">
          <h1 className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-black text-[#F7F8FC] tracking-tight text-balance">
            <span>{data.full_name}</span>
            <BadgeCheck size={22} className="text-[#69E8F5] shrink-0" />
          </h1>

          <p className="mt-1 text-sm sm:text-base font-semibold text-[#A78BFA] tracking-wide">
            {data.job_position || "Employee"}
          </p>

          <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
            {/* Department Tech-Capsule */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-[#69E8F5]/10 text-[#69E8F5] border border-[#69E8F5]/30">
              <Building2 size={11} />
              <span>{data.department || "General"}</span>
            </span>

            {/* Technical ID Pill */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-white/5 text-slate-300 border border-white/10">
              <span>ID // {data.employee_code || "—"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* D. Employee Information Grid (4 Compact Modules) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
        <InfoModule
          icon={<IdCard size={15} className="text-[#69E8F5]" />}
          label="EMPLOYEE ID"
          value={data.employee_code || "—"}
          mono
        />
        <InfoModule
          icon={<Briefcase size={15} className="text-[#A78BFA]" />}
          label="ROLE"
          value={displayRole}
        />
        <InfoModule
          icon={<Building2 size={15} className="text-[#69E8F5]" />}
          label="DEPARTMENT"
          value={data.department || "—"}
        />
        <InfoModule
          icon={<Calendar size={15} className="text-[#10C99A]" />}
          label="JOIN DATE"
          value={formattedJoinDate}
        />
      </div>

      {/* E. Verification Integrity Panel */}
      <div className="w-full rounded-2xl bg-[#17152F]/80 border border-[#10C99A]/25 p-4 sm:p-4.5 space-y-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#10C99A]/15 border border-[#10C99A]/40 text-[#10C99A]">
              <ShieldCheck size={18} />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#10C99A]">
                IDENTITY STATUS
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#F7F8FC]">
                Verified by ASLENIX
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#10C99A]/20 text-[#10C99A] border border-[#10C99A]/40">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10C99A] animate-pulse" />
            Active
          </span>
        </div>

        {/* Technical metadata list */}
        <div className="pt-2.5 border-t border-white/[0.08] space-y-1.5 text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#8791A8]">Status</span>
            <span className="font-semibold text-[#10C99A]">Validated Active Member</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#8791A8]">Last Verified</span>
            <span className="font-semibold text-[#F7F8FC]">{verifiedTimeFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#8791A8]">Credential Issued</span>
            <span className="font-semibold text-[#F7F8FC]">{issuedDateFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#8791A8]">Verification Ref</span>
            <span className="font-semibold text-[#69E8F5]">
              {data.employee_code ? `ASL-ID // ${data.employee_code}` : `ASL-ID // ${qrToken.slice(0, 10).toUpperCase()}`}
            </span>
          </div>
        </div>

        {/* Subtle security reassurance text */}
        <p className="pt-2 text-[11px] text-[#8791A8] leading-relaxed border-t border-white/[0.06] text-left">
          This digital profile confirms the employee information associated with this verification link in the official ASLENIX system.
        </p>
      </div>
    </div>
  );
}

function InfoModule({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl bg-[#17152F]/80 border border-white/[0.08] hover:border-white/20 transition-colors text-left backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/5 border border-white/10 shrink-0">
          {icon}
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8791A8]">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-xs sm:text-sm font-bold text-[#F7F8FC] leading-snug break-words ${
          mono ? "font-mono tracking-tight text-[#69E8F5]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingIdentityCard() {
  return (
    <div className="w-full bg-[#17152F]/90 rounded-3xl border border-white/10 p-8 sm:p-10 text-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-[#69E8F5]/20 border-t-[#69E8F5] animate-spin" />
        <div className="h-10 w-10 rounded-full bg-[#69E8F5]/10 flex items-center justify-center text-[#69E8F5]">
          <ShieldCheck size={20} />
        </div>
      </div>
      <h3 className="mt-5 text-sm sm:text-base font-bold font-mono tracking-wider text-[#F7F8FC] uppercase">
        Authenticating Digital ID
      </h3>
      <p className="mt-1 text-xs text-[#8791A8]">
        Connecting to ASLENIX Digital Identity Registry…
      </p>
    </div>
  );
}

function InvalidIdentityCard({
  status,
  title,
  description,
  name,
}: {
  status: "not_found" | "revoked" | "inactive";
  title: string;
  description: string;
  name?: string;
}) {
  const isRevoked = status === "revoked";
  const isNotFound = status === "not_found";

  const accentColor = isRevoked ? "text-rose-400" : isNotFound ? "text-amber-400" : "text-amber-400";
  const borderColor = isRevoked
    ? "border-rose-500/30"
    : isNotFound
      ? "border-amber-500/30"
      : "border-amber-500/30";
  const bgColor = isRevoked
    ? "bg-rose-500/10"
    : isNotFound
      ? "bg-amber-500/10"
      : "bg-amber-500/10";

  return (
    <div className={`w-full bg-[#17152F]/90 rounded-3xl border ${borderColor} p-6 sm:p-8 text-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] backdrop-blur-md`}>
      {/* Status Icon */}
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${bgColor} border ${borderColor} ${accentColor}`}
      >
        {isRevoked ? <ShieldX size={28} /> : <ShieldAlert size={28} />}
      </div>

      {/* Title */}
      <h2 className="mt-4 text-lg sm:text-xl font-black text-[#F7F8FC] tracking-tight">
        {title}
      </h2>

      {name && (
        <div className="mt-2 inline-block text-xs font-mono font-semibold text-[#8791A8] bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          Employee: {name}
        </div>
      )}

      {/* Description */}
      <p className="mt-3 text-xs sm:text-sm text-[#8791A8] leading-relaxed max-w-sm mx-auto">
        {description}
      </p>

      {/* Support contact info */}
      <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col items-center gap-1.5 text-xs text-[#8791A8]">
        <div className="flex items-center gap-1.5 font-medium text-slate-300">
          <Mail size={13} className="text-[#69E8F5]" />
          <span>info.aslenix.np@gmail.com</span>
        </div>
        <span className="text-[11px] text-[#8791A8]/80">
          Please contact ASLENIX administration if you believe this is an error.
        </span>
      </div>
    </div>
  );
}

function formatRoleName(role?: string | null, position?: string | null): string {
  if (role === "super_admin") return "Administrator";
  if (role === "admin") return "Admin";
  if (role === "team_lead") return "Team Lead";
  if (role === "employee") return "Employee";
  if (position?.toLowerCase().includes("intern")) return "Intern";
  return "Employee";
}

function formatVerificationTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCredentialDate(value: string | Date | null): string {
  if (!value) return "Verified in System";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Verified in System";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
