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
  Lock,
  Briefcase,
  Mail,
  Check,
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between p-4 sm:p-6 md:p-8 antialiased">
      <div className="w-full max-w-[450px] mx-auto my-auto flex flex-col items-center space-y-4">
        {/* Official Header */}
        <header className="flex items-center justify-between w-full pb-3 border-b border-slate-200">
          <AslenixLogo size="sm" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Verified Identity</span>
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

        {/* Glossy Terms & Conditions */}
        <div className="relative w-full rounded-2xl p-4 text-left text-slate-600 space-y-2.5 overflow-hidden backdrop-blur-xl bg-white/75 border border-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
              Terms &amp; Conditions
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Official Notice</span>
          </div>

          <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
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

        {/* Official Footer */}
        <footer className="text-center pt-1 pb-2 space-y-1 w-full">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Lock size={12} className="text-emerald-600 shrink-0" />
            <span>Official ASLENIX Employee Verification</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ASLENIX Tech &amp; Solution Pvt. Ltd. &bull; Registered Office: Kathmandu, Nepal
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
    <div className="w-full space-y-3.5">
      {/* Verification Status Banner */}
      <div className="w-full rounded-2xl bg-emerald-50/90 border border-emerald-200 p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                QR Verified Employee
              </div>
              <div className="text-[11px] text-emerald-800 font-medium">
                {verifiedTimeFormatted}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">
            <Check size={12} className="text-emerald-700" />
            Active
          </span>
        </div>
      </div>

      {/* Main Employee ID Card */}
      <div className="relative w-full rounded-3xl bg-white border border-slate-200/90 p-6 overflow-hidden shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
        {/* Official ASLENIX Logo Gradient Ribbon */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ background: "linear-gradient(90deg, #21d4fd, #8b5cf6 48%, #ff2d6f)" }}
        />

        {/* Brand Gradient Background Glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{ background: "var(--gradient-brand)" }}
        />

        {/* Profile Avatar */}
        <div className="relative mx-auto flex justify-center mt-2">
          <div
            className="relative p-[3px] rounded-full shadow-xs"
            style={{ background: "linear-gradient(135deg, #21d4fd, #8b5cf6 48%, #ff2d6f)" }}
          >
            {data.avatar_url ? (
              <img
                src={data.avatar_url}
                alt={data.full_name}
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover bg-white ring-2 ring-white"
              />
            ) : (
              <div
                className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full text-slate-900 font-extrabold text-2xl sm:text-3xl tracking-wide ring-2 ring-white shadow-inner"
                style={{ background: "var(--gradient-brand)" }}
              >
                {initials}
              </div>
            )}

            {/* Verification Check Badge */}
            <div
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white ring-3 ring-white shadow-sm"
              title="Verified by ASLENIX"
            >
              <CheckCircle2 size={16} strokeWidth={2.75} />
            </div>
          </div>
        </div>

        {/* Name & Official Designation */}
        <div className="relative mt-4 text-center">
          <h1 className="flex items-center justify-center gap-1.5 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
            <span>{data.full_name}</span>
            <BadgeCheck size={22} className="text-[#ff2d6f] shrink-0" />
          </h1>

          <p className="mt-1 text-sm sm:text-base font-semibold text-slate-600">
            {data.job_position || "Employee"}
          </p>

          <div className="mt-2.5 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <Building2 size={12} className="text-slate-500" />
              <span>{data.department || "General"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 4 Information Modules */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
        <InfoModule
          icon={<IdCard size={16} className="text-[#8b5cf6]" />}
          label="Employee ID"
          value={data.employee_code || "—"}
        />
        <InfoModule
          icon={<Briefcase size={16} className="text-[#ff2d6f]" />}
          label="Role"
          value={displayRole}
        />
        <InfoModule
          icon={<Building2 size={16} className="text-[#21d4fd]" />}
          label="Department"
          value={data.department || "—"}
        />
        <InfoModule
          icon={<Calendar size={16} className="text-emerald-600" />}
          label="Date of Joining"
          value={formattedJoinDate}
        />
      </div>

      {/* Verification Details Panel */}
      <div className="w-full rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
              <ShieldCheck size={16} />
            </div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Official Record Authentication
            </h3>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            Approved Member
          </span>
        </div>

        {/* Real Metadata Rows */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Account Status</span>
            <span className="font-semibold text-emerald-700">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Scanned Verification</span>
            <span className="font-semibold text-slate-800">{verifiedTimeFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Credential Issued</span>
            <span className="font-semibold text-slate-800">{issuedDateFormatted}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Reference Code</span>
            <span className="font-semibold text-slate-800">
              {data.employee_code || qrToken.slice(0, 12).toUpperCase()}
            </span>
          </div>
        </div>

        <p className="pt-2 text-xs text-slate-500 leading-relaxed border-t border-slate-100 text-left">
          This digital profile confirms the employee information registered in the official ASLENIX Tech &amp; Solution system.
        </p>
      </div>
    </div>
  );
}

function InfoModule({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors text-left">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-50 border border-slate-100 shrink-0">
          {icon}
        </div>
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900 leading-snug break-words">
        {value}
      </div>
    </div>
  );
}

function LoadingIdentityCard() {
  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center shadow-xs">
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "#8b5cf6", borderTopColor: "transparent" }}
        />
        <ShieldCheck size={24} className="text-[#ff2d6f]" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900">
        Verifying Employee Record...
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Checking official ASLENIX employee directory
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
    <div className={`w-full bg-white rounded-3xl border ${borderColor} p-6 sm:p-8 text-center shadow-xs`}>
      {/* Status Icon */}
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${bgColor} border ${borderColor} ${accentColor}`}
      >
        {isRevoked ? <ShieldX size={28} /> : <ShieldAlert size={28} />}
      </div>

      {/* Title */}
      <h2 className="mt-4 text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
        {title}
      </h2>

      {name && (
        <div className="mt-2 inline-block text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
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
