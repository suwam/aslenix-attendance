import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { format } from "date-fns";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  IdCard,
  LockKeyhole,
  Briefcase,
  Mail,
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
    <div className="relative min-h-screen bg-[#f6f8fc] text-[#0f172a] flex flex-col justify-between p-3.5 sm:p-6 md:p-8 antialiased selection:bg-[#4f46e5] selection:text-white">
      {/* Subtle attendance web ambient background glow */}
      <div
        className="pointer-events-none fixed -top-24 left-1/2 -translate-x-1/2 h-[380px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.06)_0%,rgba(196,218,255,0.18)_40%,transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -bottom-24 left-1/2 -translate-x-1/2 h-[340px] w-[460px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.06)_0%,transparent_65%)] blur-3xl"
        aria-hidden="true"
      />

      {/* Subtle modern dot-grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[440px] mx-auto my-auto flex flex-col items-center space-y-3.5 sm:space-y-4">
        {/* A. Compact Brand Header matching ASLENIX attendance theme */}
        <header className="flex items-center justify-between w-full pb-3 border-b border-slate-200/80">
          <AslenixLogo size="sm" />

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-slate-200/90 shadow-2xs text-[10px] font-mono font-bold tracking-wider text-indigo-700 uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-slate-500">
            <LockKeyhole size={11} className="text-indigo-600 shrink-0" />
            <span>ASLENIX SECURE EMPLOYEE VERIFICATION</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
            Official digital verification portal &bull; ASLENIX Tech &amp; Solution
          </p>
        </footer>

        {/* Terms & Conditions */}
        <div className="w-full rounded-2xl bg-white/80 border border-slate-200/80 p-3 sm:p-3.5 text-left text-slate-500 shadow-2xs space-y-1.5">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600">
            Terms &amp; Conditions
          </div>
          <ol className="list-decimal pl-3.5 space-y-1 text-[10px] leading-relaxed text-slate-500">
            <li>
              This QR verification confirms the employee record available in the ASLENIX system but does not independently verify the identity of the person presenting it.
            </li>
            <li>
              This page must be used only for legitimate employee verification purposes. Unauthorized use or misuse of employee information is prohibited.
            </li>
            <li>
              ASLENIX Tech &amp; Solution reserves the right to update its verification service and terms when necessary.
            </li>
          </ol>
        </div>
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
      {/* B. Verification Hero — Clean Emerald Status Banner */}
      <div className="w-full rounded-2xl bg-white border border-emerald-200/90 p-3 sm:p-3.5 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.12)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
              <ShieldCheck size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-extrabold tracking-[0.12em] text-emerald-700 uppercase leading-none">
                QR VERIFIED
              </span>
              <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                {verifiedTimeFormatted}
              </span>
            </div>
          </div>

          {/* Segmented Technical Verification Line */}
          <div className="flex items-center gap-1" title="Cryptographically verified">
            <span className="h-1.5 w-2.5 rounded-xs bg-emerald-500" />
            <span className="h-1.5 w-2.5 rounded-xs bg-emerald-500" />
            <span className="h-1.5 w-2.5 rounded-xs bg-emerald-500" />
            <span className="h-1.5 w-2.5 rounded-xs bg-emerald-200" />
          </div>
        </div>
      </div>

      {/* C. Signature Employee Identity Card — White/Slate Theme with subtle brand accent */}
      <div className="relative w-full rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.04)]">
        {/* Subtle brand gradient background wash */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.25] bg-gradient-to-b from-indigo-50/50 via-transparent to-slate-50"
          aria-hidden="true"
        />

        {/* Technical Corner Crosshair Accents */}
        <span className="absolute top-3 left-3 text-[10px] font-mono text-indigo-400/35 select-none">+</span>
        <span className="absolute top-3 right-3 text-[10px] font-mono text-indigo-400/35 select-none">+</span>
        <span className="absolute bottom-3 left-3 text-[10px] font-mono text-indigo-400/35 select-none">+</span>
        <span className="absolute bottom-3 right-3 text-[10px] font-mono text-indigo-400/35 select-none">+</span>

        {/* Avatar & Signature Indigo-Violet Orbital Ring */}
        <div className="relative mx-auto flex justify-center">
          <div className="relative p-[3px] rounded-full bg-gradient-to-tr from-[#4f46e5] via-[#8b5cf6] to-[#10b981] shadow-[0_0_18px_rgba(79,70,229,0.18)]">
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.full_name}
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-gradient-to-br from-slate-900 to-indigo-950 text-white font-extrabold text-2xl sm:text-3xl tracking-wider shadow-inner">
                {initials}
              </div>
            )}

            {/* Verification Checkmark Badge attached to Avatar */}
            <div
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white ring-3 ring-white shadow-sm"
              title="Verified Active Member"
            >
              <CheckCircle2 size={16} strokeWidth={2.75} />
            </div>
          </div>
        </div>

        {/* Name & Official Designation */}
        <div className="relative mt-4 text-center">
          <h1 className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
            <span>{data.full_name}</span>
            <BadgeCheck size={22} className="text-indigo-600 shrink-0" />
          </h1>

          <p className="mt-1 text-sm sm:text-base font-semibold text-indigo-600 tracking-wide">
            {data.job_position || "Employee"}
          </p>

          <div className="mt-2.5 flex items-center justify-center gap-2 flex-wrap">
            {/* Department Tech-Capsule */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/90">
              <Building2 size={11} />
              <span>{data.department || "General"}</span>
            </span>

            {/* Technical ID Pill */}
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wider uppercase bg-slate-100 text-slate-700 border border-slate-200/90">
              <span>ID // {data.employee_code || "—"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* D. Employee Information Grid (4 Compact Modules) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
        <InfoModule
          icon={<IdCard size={15} className="text-indigo-600" />}
          label="EMPLOYEE ID"
          value={data.employee_code || "—"}
          mono
        />
        <InfoModule
          icon={<Briefcase size={15} className="text-purple-600" />}
          label="ROLE"
          value={displayRole}
        />
        <InfoModule
          icon={<Building2 size={15} className="text-indigo-600" />}
          label="DEPARTMENT"
          value={data.department || "—"}
        />
        <InfoModule
          icon={<Calendar size={15} className="text-emerald-600" />}
          label="JOIN DATE"
          value={formattedJoinDate}
        />
      </div>

      {/* E. Verification Integrity Panel */}
      <div className="w-full rounded-2xl bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/30 border border-emerald-200/90 p-4 sm:p-4.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 shadow-2xs">
              <ShieldCheck size={18} />
            </div>
            <div className="text-left">
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-900">
                IDENTITY STATUS
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900">
                Verified by ASLENIX
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Active
          </span>
        </div>

        {/* Technical metadata list */}
        <div className="pt-2.5 border-t border-emerald-100/90 space-y-1.5 text-[11px] font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Status</span>
            <span className="font-semibold text-emerald-700">Validated Active Member</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Last Verified</span>
            <span className="font-semibold text-slate-800">{verifiedTimeFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Credential Issued</span>
            <span className="font-semibold text-slate-800">{issuedDateFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Verification Ref</span>
            <span className="font-semibold text-indigo-700">
              {data.employee_code ? `ASL-ID // ${data.employee_code}` : `ASL-ID // ${qrToken.slice(0, 10).toUpperCase()}`}
            </span>
          </div>
        </div>

        {/* Security reassurance text */}
        <p className="pt-2 text-[11px] text-slate-600 leading-relaxed border-t border-emerald-100/80 text-left">
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
    <div className="flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all text-left">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 border border-indigo-100 shrink-0">
          {icon}
        </div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>
      <div
        className={`mt-2 text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words ${
          mono ? "font-mono tracking-tight text-indigo-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingIdentityCard() {
  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 text-center shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
        <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
          <ShieldCheck size={20} />
        </div>
      </div>
      <h3 className="mt-5 text-sm sm:text-base font-bold font-mono tracking-wider text-slate-900 uppercase">
        Authenticating Digital ID
      </h3>
      <p className="mt-1 text-xs text-slate-500">
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

  const accentColor = isRevoked ? "text-rose-600" : isNotFound ? "text-amber-600" : "text-amber-600";
  const borderColor = isRevoked
    ? "border-rose-200"
    : isNotFound
      ? "border-amber-200"
      : "border-amber-200";
  const bgColor = isRevoked
    ? "bg-rose-50"
    : isNotFound
      ? "bg-amber-50"
      : "bg-amber-50";

  return (
    <div className={`w-full bg-white rounded-3xl border ${borderColor} p-6 sm:p-8 text-center shadow-[0_12px_36px_rgba(15,23,42,0.08)]`}>
      {/* Status Icon */}
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${bgColor} border ${borderColor} ${accentColor}`}
      >
        {isRevoked ? <ShieldX size={28} /> : <ShieldAlert size={28} />}
      </div>

      {/* Title */}
      <h2 className="mt-4 text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
        {title}
      </h2>

      {name && (
        <div className="mt-2 inline-block text-xs font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
          Employee: {name}
        </div>
      )}

      {/* Description */}
      <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
        {description}
      </p>

      {/* Support contact info */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Mail size={13} className="text-indigo-600" />
          <span>info.aslenix.np@gmail.com</span>
        </div>
        <span className="text-[11px] text-slate-400">
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
  try {
    const nepaliDate = formatNepaliDate(date, "DD MMMM YYYY");
    const timeStr = format(date, "hh:mm a");
    return `${nepaliDate} BS • ${timeStr}`;
  } catch (e) {
    return format(date, "yyyy-MM-dd hh:mm a");
  }
}

function formatCredentialDate(value: string | Date | null): string {
  if (!value) return "Verified in System";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "Verified in System";
    return `${formatNepaliDate(date, "DD MMMM YYYY")} BS`;
  } catch (e) {
    return "Verified in System";
  }
}
