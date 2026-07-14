import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Laptop, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/admin/devices")({ component: DeviceManagementPage });

type EmployeeSummary = {
  id: string;
  name: string;
  email: string;
  department?: string | null;
};

type EmployeeDevice = {
  id: string;
  employee_id: string;
  employee?: EmployeeSummary;
  device_fingerprint: string;
  browser: string;
  operating_system: string;
  device_name: string;
  status: "Active" | "Inactive";
  registered_at: string;
  last_login: string;
};

type PendingDeviceRequest = {
  id: string;
  employee_id: string;
  employee?: EmployeeSummary;
  device_fingerprint: string;
  browser: string;
  operating_system: string;
  device_name: string;
  requested_at: string;
  status: "Pending" | "Approved" | "Rejected";
};

type DevicePayload = {
  devices: EmployeeDevice[];
  pendingRequests: PendingDeviceRequest[];
};

function DeviceManagementPage() {
  const [payload, setPayload] = useState<DevicePayload>({ devices: [], pendingRequests: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: deviceRows, error: devicesError }, { data: requestRows, error: requestsError }] = await Promise.all([
        (supabase as any)
          .from("employee_devices")
          .select("id,employee_id,device_fingerprint,browser,operating_system,device_name,status,registered_at,last_login")
          .eq("status", "Active")
          .order("last_login", { ascending: false }),
        (supabase as any)
          .from("pending_device_requests")
          .select("id,employee_id,device_fingerprint,browser,operating_system,device_name,requested_at,status")
          .eq("status", "Pending")
          .order("requested_at", { ascending: false }),
      ]);

      if (devicesError) throw devicesError;
      if (requestsError) throw requestsError;

      const devices = (deviceRows ?? []) as EmployeeDevice[];
      const pendingRequests = (requestRows ?? []) as PendingDeviceRequest[];
      const employeeIds = [
        ...new Set([...devices.map((device) => device.employee_id), ...pendingRequests.map((request) => request.employee_id)]),
      ];

      const { data: profiles, error: profilesError } = employeeIds.length
        ? await supabase
            .from("profiles")
            .select("user_id,full_name,email,department")
            .in("user_id", employeeIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profiles ?? []).map((profile) => [
          profile.user_id,
          {
            id: profile.user_id,
            name: profile.full_name,
            email: profile.email,
            department: profile.department,
          },
        ]),
      );

      setPayload({
        devices: devices.map((device) => ({ ...device, employee: profileMap.get(device.employee_id) })),
        pendingRequests: pendingRequests.map((request) => ({ ...request, employee: profileMap.get(request.employee_id) })),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load devices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestsByEmployee = useMemo(() => {
    const map = new Map<string, PendingDeviceRequest[]>();
    payload.pendingRequests.forEach((request) => {
      map.set(request.employee_id, [...(map.get(request.employee_id) || []), request]);
    });
    return map;
  }, [payload.pendingRequests]);

  const visibleRows = useMemo(() => {
    const rows: Array<{ device?: EmployeeDevice; requests: PendingDeviceRequest[]; employeeId: string }> = payload.devices.map(
      (device) => ({
        device,
        requests: requestsByEmployee.get(device.employee_id) || [],
        employeeId: device.employee_id,
      }),
    );

    payload.pendingRequests.forEach((request) => {
      if (!rows.some((row) => row.employeeId === request.employee_id)) {
        rows.push({ requests: [request], employeeId: request.employee_id });
      }
    });

    return rows;
  }, [payload.devices, payload.pendingRequests, requestsByEmployee]);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const activeDevices = payload.devices.filter((device) => device.status === "Active").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Device Management" subtitle="Approve, replace, and remove employee attendance devices" />

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={Laptop} label="Registered Devices" value={payload.devices.length} />
        <Metric icon={ShieldCheck} label="Active Devices" value={activeDevices} />
        <Metric icon={RefreshCw} label="Pending Requests" value={payload.pendingRequests.length} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Employee Devices</h2>
            <p className="text-sm text-muted-foreground">Only active registered devices can check in, check out, or manage breaks.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4">
          {visibleRows.map(({ device, requests, employeeId }) => {
            const firstRequest = requests[0];
            const employee = device?.employee || firstRequest?.employee;
            return (
              <GlassCard key={device?.id || employeeId} className="p-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.95fr)_minmax(0,2.2fr)_auto] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {employeeInitials(employee, employeeId)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-foreground">{employeeName(employee, employeeId)}</h3>
                        {employee?.email && <p className="mt-1 truncate text-xs text-muted-foreground">{employee.email}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Detail label="Registered Device" value={device?.device_name || "No active registered device"} subvalue={device?.device_fingerprint} />
                    <Detail label="Browser" value={device?.browser || "-"} />
                    <Detail label="Operating System" value={device?.operating_system || "-"} />
                    <Detail label="Last Login" value={device ? formatDate(device.last_login) : "Never"} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {device ? <StatusBadge status={device.status} /> : <span className="text-sm text-muted-foreground">Unregistered</span>}
                    {device?.status === "Active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          runAction(
                            `remove-${device.id}`,
                            () => removeDevice(device.id),
                            "Device removed",
                          )
                        }
                        disabled={Boolean(busy)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-border/50 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pending Device Requests</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{requests.length}</span>
                  </div>

                  {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests</p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((request) => (
                        <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-primary/40 bg-muted/30 px-4 py-3">
                          <div className="min-w-[220px]">
                            <div className="font-semibold text-foreground">{request.device_name}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {request.browser} · {request.operating_system} · {formatDate(request.requested_at)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                runAction(
                                  `approve-${request.id}`,
                                  () => approveRequest(request),
                                  "New device approved",
                                )
                              }
                              disabled={Boolean(busy)}
                            >
                              <Check size={14} className="mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                runAction(
                                  `reject-${request.id}`,
                                  () => rejectRequest(request.id),
                                  "Device request rejected",
                                )
                              }
                              disabled={Boolean(busy)}
                            >
                              <X size={14} className="mr-1" />
                              Reject
                            </Button>
                            {device && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  runAction(
                                    `replace-${device.id}-${request.id}`,
                                    () => approveRequest(request),
                                    "Existing device replaced",
                                  )
                                }
                                disabled={Boolean(busy)}
                              >
                                <RefreshCw size={14} className="mr-1" />
                                Replace
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>

        {!loading && visibleRows.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No registered devices found.</div>
        )}
        {loading && <div className="py-12 text-center text-sm text-muted-foreground">Loading devices...</div>}
      </section>
    </div>
  );
}

async function approveRequest(request: PendingDeviceRequest) {
  const now = new Date().toISOString();
  const { error: inactiveError } = await (supabase as any)
    .from("employee_devices")
    .update({ status: "Inactive" })
    .eq("employee_id", request.employee_id)
    .eq("status", "Active");

  if (inactiveError) throw inactiveError;

  const { error: upsertError } = await (supabase as any).from("employee_devices").upsert(
    {
      employee_id: request.employee_id,
      device_fingerprint: request.device_fingerprint,
      browser: request.browser,
      operating_system: request.operating_system,
      device_name: request.device_name,
      status: "Active",
      registered_at: now,
      last_login: now,
    },
    { onConflict: "employee_id,device_fingerprint" },
  );

  if (upsertError) throw upsertError;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: requestError } = await (supabase as any)
    .from("pending_device_requests")
    .update({ status: "Approved", reviewed_at: now, reviewed_by: user?.id ?? null })
    .eq("id", request.id);

  if (requestError) throw requestError;
}

async function rejectRequest(requestId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await (supabase as any)
    .from("pending_device_requests")
    .update({ status: "Rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id ?? null })
    .eq("id", requestId);

  if (error) throw error;
}

async function removeDevice(deviceId: string) {
  const { error } = await (supabase as any)
    .from("employee_devices")
    .update({ status: "Inactive" })
    .eq("id", deviceId);

  if (error) throw error;
}

function Detail({ label, value, subvalue }: { label: string; value: string; subvalue?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">{value}</p>
      {subvalue && <p className="mt-1 truncate text-xs text-muted-foreground">{subvalue}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: EmployeeDevice["status"] }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        status === "Active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Laptop; label: string; value: number }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon size={18} className="text-primary" />
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">{value}</p>
    </GlassCard>
  );
}

function employeeName(value: EmployeeSummary | undefined, fallback: string) {
  return value?.name || fallback;
}

function employeeInitials(value: EmployeeSummary | undefined, fallback: string) {
  const name = employeeName(value, fallback);
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDate(value: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
