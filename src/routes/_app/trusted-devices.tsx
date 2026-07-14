import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Laptop, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useDeviceStatus } from "@/hooks/use-device-status";
import { logTrustedDeviceEvent } from "@/lib/trusted-devices";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/trusted-devices")({ component: TrustedDevicesPage });

type Device = {
  id: string;
  device_name: string;
  device_fingerprint: string;
  browser: string;
  operating_system: string;
  status: "Active" | "Inactive";
  registered_at: string;
  last_login: string;
  passkey?: { credential_id: string } | null;
};

type AuditLog = {
  id: string;
  action: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

function TrustedDevicesPage() {
  const { user } = useAuth();
  const { localFingerprint, setupBiometrics, checkDevice } = useDeviceStatus();
  const [devices, setDevices] = useState<Device[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [maxDevices, setMaxDevices] = useState(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const load = async () => {
    if (!user) return;
    const [{ data: deviceRows, error: deviceError }, { data: passkeyRows }, { data: logRows }, { data: settings }] = await Promise.all([
      (supabase as any)
        .from("employee_devices")
        .select("id,device_name,device_fingerprint,browser,operating_system,status,registered_at,last_login")
        .eq("employee_id", user.id)
        .eq("status", "Active")
        .order("last_login", { ascending: false }),
      (supabase as any)
        .from("device_passkeys")
        .select("device_fingerprint,credential_id")
        .eq("employee_id", user.id),
      (supabase as any)
        .from("trusted_device_audit_logs")
        .select("id,action,created_at,metadata")
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("device_security_settings")
        .select("max_trusted_devices")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (deviceError) {
      toast.error(deviceError.message);
      return;
    }

    const passkeyMap = new Map((passkeyRows ?? []).map((row: any) => [row.device_fingerprint, row]));
    setDevices((deviceRows ?? []).map((device: Device) => ({ ...device, passkey: passkeyMap.get(device.device_fingerprint) ?? null })));
    setLogs((logRows ?? []) as AuditLog[]);
    setMaxDevices(Number(settings?.max_trusted_devices ?? 2));
  };

  useEffect(() => {
    load();
  }, [user]);

  const renameDevice = async (device: Device) => {
    if (!user || !nameDraft.trim()) return;
    setBusy(device.id);
    try {
      const { error } = await (supabase as any)
        .from("employee_devices")
        .update({ device_name: nameDraft.trim() })
        .eq("id", device.id)
        .eq("employee_id", user.id);
      if (error) throw error;
      await logTrustedDeviceEvent({
        employeeId: user.id,
        deviceId: device.id,
        deviceFingerprint: device.device_fingerprint,
        action: "renamed",
        metadata: { from: device.device_name, to: nameDraft.trim() },
      });
      toast.success("Device renamed");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to rename device");
    } finally {
      setBusy(null);
    }
  };

  const removeDevice = async (device: Device) => {
    if (!user) return;
    setBusy(device.id);
    try {
      const { error } = await (supabase as any)
        .from("employee_devices")
        .update({
          status: "Inactive",
          removed_at: new Date().toISOString(),
          removed_by: user.id,
          removal_reason: "Removed by employee",
        })
        .eq("id", device.id)
        .eq("employee_id", user.id);
      if (error) throw error;
      await (supabase as any)
        .from("device_passkeys")
        .delete()
        .eq("employee_id", user.id)
        .eq("device_fingerprint", device.device_fingerprint);
      await logTrustedDeviceEvent({
        employeeId: user.id,
        deviceId: device.id,
        deviceFingerprint: device.device_fingerprint,
        action: "removed",
      });
      toast.success("Device removed");
      if (device.device_fingerprint === localFingerprint) {
        sessionStorage.removeItem("device_prompted");
      }
      await load();
      await checkDevice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove device");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Trusted Devices" subtitle="Manage devices allowed to access attendance and passkey verification." />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Trusted Devices" value={`${devices.length}/${maxDevices}`} />
        <Metric label="Passkeys Registered" value={String(devices.filter((device) => device.passkey).length)} />
        <Metric label="Security Status" value={devices.every((device) => device.passkey) ? "Ready" : "Needs setup"} />
      </div>

      <div className="grid gap-4">
        {devices.map((device) => (
          <GlassCard key={device.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Laptop size={20} />
                </div>
                <div className="min-w-0">
                  {editing === device.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"
                      />
                      <Button size="sm" onClick={() => renameDevice(device)} disabled={busy === device.id}>Save</Button>
                    </div>
                  ) : (
                    <h2 className="truncate text-lg font-semibold text-foreground">{device.device_name}</h2>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">{device.operating_system} · {device.browser}</p>
                  <p className="mt-1 max-w-xl truncate font-mono text-xs text-muted-foreground">{device.device_fingerprint}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge ok={Boolean(device.passkey)} text={device.passkey ? "Passkey registered" : "Passkey missing"} />
                {device.device_fingerprint === localFingerprint && !device.passkey && (
                  <Button size="sm" onClick={() => setupBiometrics().then(load)} disabled={busy === device.id}>
                    <ShieldCheck size={14} className="mr-1" />
                    Setup Passkey
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { setEditing(device.id); setNameDraft(device.device_name); }}>
                  <Pencil size={14} className="mr-1" />
                  Rename
                </Button>
                <Button size="sm" variant="outline" onClick={() => removeDevice(device)} disabled={busy === device.id}>
                  <Trash2 size={14} className="mr-1" />
                  Remove
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-3">
              <Detail label="Registered" value={formatDate(device.registered_at)} />
              <Detail label="Last Login" value={formatDate(device.last_login)} />
              <Detail label="Credential ID" value={device.passkey?.credential_id || "Not registered"} />
            </div>
          </GlassCard>
        ))}

        {devices.length === 0 && (
          <GlassCard className="py-12 text-center text-sm text-muted-foreground">No trusted devices found.</GlassCard>
        )}
      </div>

      <GlassCard className="p-5">
        <h2 className="text-lg font-semibold text-foreground">Device Audit Log</h2>
        <div className="mt-4 space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
              <div className="font-semibold capitalize text-foreground">{log.action.replaceAll("_", " ")}</div>
              <div className="text-sm text-muted-foreground">{formatDate(log.created_at)}</div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No device audit events yet.</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
    </GlassCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
      <ShieldCheck size={13} className="mr-1" />
      {text}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
