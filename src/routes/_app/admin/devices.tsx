import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Laptop, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/devices")({ component: DeviceManagementPage });

type EmployeeSummary = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type EmployeeDevice = {
  _id: string;
  employeeId: EmployeeSummary | string;
  deviceFingerprint: string;
  browser: string;
  operatingSystem: string;
  deviceName: string;
  status: "Active" | "Inactive";
  registeredAt: string;
  lastLogin: string;
};

type PendingDeviceRequest = {
  _id: string;
  employeeId: EmployeeSummary | string;
  deviceFingerprint: string;
  browser: string;
  operatingSystem: string;
  deviceName: string;
  requestedAt: string;
  status: "Pending" | "Approved" | "Rejected";
};

type DevicePayload = {
  devices: EmployeeDevice[];
  pendingRequests: PendingDeviceRequest[];
};

const API_BASE = import.meta.env.VITE_TASK_API_BASE || "http://localhost:4000/api";

async function deviceRequest<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }

  return response.json() as Promise<T>;
}

function DeviceManagementPage() {
  const [payload, setPayload] = useState<DevicePayload>({ devices: [], pendingRequests: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await deviceRequest<DevicePayload>("/devices");
      setPayload(data);
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
      const key = typeof request.employeeId === "string" ? request.employeeId : request.employeeId._id;
      map.set(key, [...(map.get(key) || []), request]);
    });
    return map;
  }, [payload.pendingRequests]);

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

      <GlassCard className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Employee Devices</h2>
            <p className="text-sm text-muted-foreground">Only active registered devices can check in, check out, or manage breaks.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Employee Name</th>
                <th className="px-5 py-3">Registered Device</th>
                <th className="px-5 py-3">Browser</th>
                <th className="px-5 py-3">Operating System</th>
                <th className="px-5 py-3">Last Login</th>
                <th className="px-5 py-3">Device Status</th>
                <th className="px-5 py-3">Pending Device Requests</th>
              </tr>
            </thead>
            <tbody>
              {payload.devices.map((device) => {
                const employeeId = typeof device.employeeId === "string" ? device.employeeId : device.employeeId._id;
                const requests = requestsByEmployee.get(employeeId) || [];
                return (
                  <tr key={device._id} className="border-b border-border/40 align-top last:border-b-0">
                    <td className="px-5 py-4 font-semibold text-foreground">{employeeName(device.employeeId)}</td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <div className="font-medium text-foreground">{device.deviceName}</div>
                      <div className="mt-1 max-w-[220px] truncate text-xs">{device.deviceFingerprint}</div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{device.browser}</td>
                    <td className="px-5 py-4 text-muted-foreground">{device.operatingSystem}</td>
                    <td className="px-5 py-4 text-muted-foreground">{formatDate(device.lastLogin)}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          device.status === "Active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {device.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-3">
                        {requests.length === 0 && <span className="text-sm text-muted-foreground">No pending requests</span>}
                        {requests.map((request) => (
                          <div key={request._id} className="rounded-xl border border-border/60 bg-background/60 p-3">
                            <div className="font-semibold text-foreground">{request.deviceName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {request.browser} · {request.operatingSystem} · {formatDate(request.requestedAt)}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  runAction(
                                    `approve-${request._id}`,
                                    () => deviceRequest(`/devices/requests/${request._id}/approve`, { method: "POST" }),
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
                                    `reject-${request._id}`,
                                    () => deviceRequest(`/devices/requests/${request._id}/reject`, { method: "POST" }),
                                    "Device request rejected",
                                  )
                                }
                                disabled={Boolean(busy)}
                              >
                                <X size={14} className="mr-1" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  runAction(
                                    `replace-${device._id}-${request._id}`,
                                    () =>
                                      deviceRequest(`/devices/${device._id}/replace`, {
                                        method: "POST",
                                        body: JSON.stringify({ requestId: request._id }),
                                      }),
                                    "Existing device replaced",
                                  )
                                }
                                disabled={Boolean(busy)}
                              >
                                <RefreshCw size={14} className="mr-1" />
                                Replace
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            runAction(
                              `remove-${device._id}`,
                              () => deviceRequest(`/devices/${device._id}`, { method: "DELETE" }),
                              "Device removed",
                            )
                          }
                          disabled={Boolean(busy)}
                        >
                          <Trash2 size={14} className="mr-1" />
                          Remove Device
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && payload.devices.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">No registered devices found.</div>
        )}
        {loading && <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading devices...</div>}
      </GlassCard>
    </div>
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

function employeeName(value: EmployeeSummary | string) {
  return typeof value === "string" ? value : value.name;
}

function formatDate(value: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
