import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import { GlassCard } from "@/components/GlassCard";
import { ShieldCheck, ShieldX, Loader2, BadgeCheck, Building2, Briefcase, Calendar, Hash } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: "var(--background)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: "radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 50%), radial-gradient(circle at 80% 90%, color-mix(in oklab, oklch(0.6 0.2 240) 35%, transparent), transparent 50%)" }} />

      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-6"><AslenixLogo size="lg" /></div>

        {loading ? (
          <GlassCard className="text-center py-16">
            <Loader2 className="mx-auto animate-spin text-primary" />
            <div className="mt-3 text-sm text-muted-foreground">Verifying employee…</div>
          </GlassCard>
        ) : !data || error ? (
          <InvalidCard reason="QR code not found" />
        ) : !data.is_valid ? (
          <InvalidCard reason={data.qr_status === "revoked" ? "This QR has been revoked" : "QR is inactive or employee suspended"} name={data.full_name} />
        ) : (
          <ValidCard data={data} />
        )}

        <div className="mt-6 text-center text-[11px] text-muted-foreground tracking-wider">
          ASLENIX • SECURE EMPLOYEE VERIFICATION
        </div>
      </div>
    </div>
  );
}

function ValidCard({ data }: { data: VerifyData }) {
  const initials = data.full_name?.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <GlassCard glow="blue" className="overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gradient-brand)" }} />

      <div className="flex items-center justify-center gap-2 mb-5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "color-mix(in oklab, #10b981 20%, transparent)", border: "1px solid color-mix(in oklab, #10b981 40%, transparent)" }}>
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300 tracking-wider">QR VERIFIED</span>
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        {data.avatar_url ? (
          <img src={data.avatar_url} alt={data.full_name} className="h-24 w-24 rounded-full object-cover ring-4 ring-primary/40" />
        ) : (
          <div className="h-24 w-24 rounded-full flex items-center justify-center text-white text-2xl font-bold" style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }}>{initials}</div>
        )}
        <h1 className="mt-4 text-2xl font-bold flex items-center gap-1.5">
          {data.full_name}
          <BadgeCheck size={20} className="text-primary" />
        </h1>
        <div className="text-sm text-muted-foreground">{data.job_position || "—"}</div>
        <div className="mt-1 text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}>{data.department || "Unassigned"}</div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Detail icon={<Hash size={14} />} label="Employee ID" value={data.employee_code || "—"} mono />
        <Detail icon={<Briefcase size={14} />} label="Role" value={(data.role || "employee").replace("_", " ")} className="capitalize" />
        <Detail icon={<Building2 size={14} />} label="Department" value={data.department || "—"} />
        <Detail icon={<Calendar size={14} />} label="Joined" value={data.joining_date ? new Date(data.joining_date).toLocaleDateString() : "—"} />
      </div>

      <div className="mt-5 p-3 rounded-xl text-center text-sm" style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)", border: "1px solid color-mix(in oklab, var(--primary) 25%, transparent)" }}>
        This employee is verified by <span className="font-bold gradient-text">ASLENIX</span>.
      </div>
    </GlassCard>
  );
}

function InvalidCard({ reason, name }: { reason: string; name?: string }) {
  return (
    <GlassCard className="text-center py-10">
      <div className="mx-auto h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "color-mix(in oklab, #ef4444 20%, transparent)", border: "1px solid color-mix(in oklab, #ef4444 40%, transparent)" }}>
        <ShieldX className="text-red-400" size={28} />
      </div>
      <h1 className="mt-4 text-xl font-bold text-red-300">Invalid QR Code</h1>
      <p className="mt-2 text-sm text-muted-foreground">{reason}</p>
      {name && <p className="mt-3 text-xs text-muted-foreground">Employee: {name}</p>}
      <div className="mt-5 text-[11px] text-muted-foreground">Contact ASLENIX HR if you believe this is an error.</div>
    </GlassCard>
  );
}

function Detail({ icon, label, value, mono, className }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "color-mix(in oklab, var(--card) 60%, transparent)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className={`mt-1 text-sm font-medium truncate ${mono ? "font-mono" : ""} ${className || ""}`}>{value}</div>
    </div>
  );
}
