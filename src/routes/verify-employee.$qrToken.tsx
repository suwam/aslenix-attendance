import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
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
  AlertCircle,
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
        // First try the secure RPC
        const { data: rows, error: rpcErr } = await supabase.rpc("verify_employee_qr", {
          _token: qrToken,
        });

        if (rows && rows.length > 0) {
          if (isMounted) setData((rows[0] as VerifyData) ?? null);
          return;
        }

        // Fallback: lookup by employee_code or qr_token
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
    <div className="relative min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-6 md:p-8 antialiased selection:bg-cyan-500 selection:text-white">
      {/* Subtle corporate ambient background */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.06),transparent_55%),radial-gradient(circle_at_50%_100%,rgba(99,102,241,0.04),transparent_55%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[490px] mx-auto my-auto flex flex-col items-center">
        {/* Company Branding */}
        <div className="mb-5 sm:mb-6 flex justify-center">
          <AslenixLogo size="md" />
        </div>

        {/* Dynamic Card Content */}
        {loading ? (
          <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.03)] p-10 text-center">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-cyan-600" />
            <h3 className="mt-4 text-base font-bold text-slate-800">Verifying Digital ID</h3>
            <p className="mt-1 text-xs text-slate-500">Checking official ASLENIX employee registry…</p>
          </div>
        ) : !data || error ? (
          <InvalidIdentityCard
            status="not_found"
            title="Unable to Verify Employee"
            description="No active employee record matches this verification token. The QR code may be invalid or expired."
          />
        ) : !data.is_valid ? (
          <InvalidIdentityCard
            status={data.qr_status === "revoked" ? "revoked" : "inactive"}
            name={data.full_name}
            title={
              data.qr_status === "revoked"
                ? "Employee Credential Revoked"
                : "Employee Account Inactive"
            }
            description={
              data.qr_status === "revoked"
                ? "This employee credential has been officially revoked by ASLENIX administration."
                : "The employee profile associated with this QR code is currently inactive or awaiting approval."
            }
          />
        ) : (
          <ValidIdentityCard data={data} />
        )}

        {/* Global Security Disclaimer Footer */}
        <div className="mt-6 text-center max-w-sm px-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <LockKeyhole size={12} className="text-slate-400 shrink-0" />
            Official ASLENIX Employee Verification
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            This digital profile confirms the employee information registered in the ASLENIX Tech & Solution system.
          </p>
        </div>
      </div>
    </div>
  );
}

function ValidIdentityCard({ data }: { data: VerifyData }) {
  const [verifiedTime] = useState(() => new Date());

  const initials = data.full_name
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
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden transition-all duration-300">
      {/* Top Security Accent Strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500" />

      <div className="p-5 sm:p-7">
        {/* Top Status Bar: Badge & Timestamp */}
        <div className="flex items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span className="tracking-wide">QR VERIFIED</span>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Clock size={12} className="text-slate-400 shrink-0" />
            <span>{verifiedTimeFormatted}</span>
          </div>
        </div>

        {/* Employee Profile Header */}
        <div className="mt-6 flex flex-col items-center text-center">
          <div className="relative">
            {/* Avatar Ring */}
            <div className="p-1 rounded-full bg-gradient-to-tr from-cyan-500/25 via-indigo-500/15 to-emerald-500/35 ring-1 ring-slate-200/80 shadow-xs">
              {data.avatar_url ? (
                <img
                  src={data.avatar_url}
                  alt={data.full_name}
                  className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover shadow-inner"
                />
              ) : (
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-slate-900 text-white font-extrabold text-2xl sm:text-3xl tracking-wider shadow-inner">
                  {initials}
                </div>
              )}
            </div>

            {/* Verification Checkmark Badge attached to Avatar */}
            <div
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white shadow-sm"
              title="Verified by ASLENIX"
            >
              <CheckCircle2 size={16} strokeWidth={2.5} />
            </div>
          </div>

          {/* Full Name */}
          <h1 className="mt-4 flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
            <span>{data.full_name}</span>
            <BadgeCheck size={22} className="text-cyan-600 shrink-0" />
          </h1>

          {/* Official Designation */}
          <p className="mt-1 text-sm sm:text-base font-semibold text-slate-600">
            {data.job_position || "Employee"}
          </p>

          {/* Department Badge */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80">
            <Building2 size={12} className="text-slate-500" />
            <span>{data.department || "General"}</span>
          </div>
        </div>

        {/* 4 Core Employee Information Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          <InfoCard
            icon={<IdCard size={18} />}
            label="EMPLOYEE ID"
            value={data.employee_code || "—"}
            mono
          />
          <InfoCard
            icon={<Briefcase size={18} />}
            label="ROLE"
            value={displayRole}
          />
          <InfoCard
            icon={<Building2 size={18} />}
            label="DEPARTMENT"
            value={data.department || "—"}
          />
          <InfoCard
            icon={<Calendar size={18} />}
            label="JOIN DATE"
            value={formattedJoinDate}
          />
        </div>

        {/* Consolidated Verification Status Card */}
        <div className="mt-5 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/30 p-4 sm:p-4.5 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                  Identity Verification
                </div>
                <div className="text-xs font-medium text-emerald-700">
                  Confirmed active team member
                </div>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Active
            </span>
          </div>

          <div className="mt-3.5 pt-3 border-t border-emerald-100 flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Credential Issued
            </span>
            <span className="font-semibold text-slate-700">{issuedDateFormatted}</span>
          </div>

          <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
            This digital profile confirms the employee information associated with this verification link in the ASLENIX system.
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
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
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-2xs hover:bg-slate-50 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200/90 text-slate-700 shadow-2xs">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </div>
        <div
          className={`mt-0.5 truncate text-sm font-semibold text-slate-900 ${
            mono ? "font-mono text-[13px] tracking-tight" : ""
          }`}
        >
          {value}
        </div>
      </div>
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

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_-15px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.03)] overflow-hidden">
      {/* Top Alert Accent Line */}
      <div
        className={`h-1.5 w-full ${isRevoked ? "bg-red-500" : "bg-amber-500"}`}
      />

      <div className="p-6 sm:p-8 text-center">
        {/* Status Icon */}
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isRevoked
              ? "bg-red-50 text-red-600 border border-red-200/80"
              : "bg-amber-50 text-amber-600 border border-amber-200/80"
          }`}
        >
          {isRevoked ? <ShieldX size={28} /> : <ShieldAlert size={28} />}
        </div>

        {/* Title */}
        <h2 className="mt-4 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>

        {name && (
          <div className="mt-1.5 inline-block text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-0.5 rounded-full">
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
            <Mail size={13} className="text-slate-400" />
            <span>info.aslenix.np@gmail.com</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Please contact ASLENIX administration if you believe this is an error.
          </span>
        </div>
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
