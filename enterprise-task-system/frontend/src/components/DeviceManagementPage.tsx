import { useEffect, useMemo, useState } from "react";
import { Check, Laptop, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { hrmsApi } from "../api/hrmsApi";
import type { DeviceManagementPayload, EmployeeDevice, EmployeeSummary, PendingDeviceRequest } from "../types/device";

function employeeName(value: EmployeeSummary | string) {
  return typeof value === "string" ? value : value.name;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DeviceManagementPage() {
  const [payload, setPayload] = useState<DeviceManagementPayload>({ devices: [], pendingRequests: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const data = await hrmsApi.deviceManagement();
    setPayload(data);
  }

  useEffect(() => {
    load().catch((loadError: Error) => setError(loadError.message));
  }, []);

  const requestsByEmployee = useMemo(() => {
    const map = new Map<string, PendingDeviceRequest[]>();
    payload.pendingRequests.forEach((request) => {
      const key = typeof request.employeeId === "string" ? request.employeeId : request.employeeId._id;
      map.set(key, [...(map.get(key) || []), request]);
    });
    return map;
  }, [payload.pendingRequests]);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">HR</p>
            <h1 className="mt-2 text-3xl font-bold">Device Management</h1>
            <p className="mt-1 text-sm text-slate-400">Approve, replace, or remove employee attendance devices.</p>
          </div>
          <button
            type="button"
            onClick={() => load().catch((loadError: Error) => setError(loadError.message))}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-400"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div>}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric label="Registered Devices" value={payload.devices.length} icon={Laptop} />
          <Metric label="Active Devices" value={payload.devices.filter((device) => device.status === "Active").length} icon={ShieldCheck} />
          <Metric label="Pending Requests" value={payload.pendingRequests.length} icon={RefreshCw} />
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_0.8fr_1.4fr] gap-4 border-b border-slate-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Employee Name</span>
            <span>Registered Device</span>
            <span>Browser</span>
            <span>Operating System</span>
            <span>Last Login</span>
            <span>Status</span>
            <span>Pending Device Requests</span>
          </div>

          {payload.devices.map((device) => {
            const employeeId = typeof device.employeeId === "string" ? device.employeeId : device.employeeId._id;
            const requests = requestsByEmployee.get(employeeId) || [];
            return (
              <DeviceRow
                key={device._id}
                device={device}
                requests={requests}
                busy={busy}
                onApprove={(requestId) => run(`approve-${requestId}`, () => hrmsApi.approveDevice(requestId))}
                onReject={(requestId) => run(`reject-${requestId}`, () => hrmsApi.rejectDevice(requestId))}
                onReplace={(requestId) => run(`replace-${device._id}-${requestId}`, () => hrmsApi.replaceDevice(device._id, requestId))}
                onRemove={() => run(`remove-${device._id}`, () => hrmsApi.removeDevice(device._id))}
              />
            );
          })}

          {payload.devices.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-400">No registered devices found.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function DeviceRow({
  device,
  requests,
  busy,
  onApprove,
  onReject,
  onReplace,
  onRemove,
}: {
  device: EmployeeDevice;
  requests: PendingDeviceRequest[];
  busy: string | null;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onReplace: (requestId: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr_1fr_0.8fr_1.4fr] gap-4 border-b border-slate-800 px-5 py-4 text-sm last:border-b-0">
      <span className="font-semibold">{employeeName(device.employeeId)}</span>
      <span className="break-all text-slate-300">{device.deviceName}</span>
      <span className="text-slate-300">{device.browser}</span>
      <span className="text-slate-300">{device.operatingSystem}</span>
      <span className="text-slate-300">{formatDate(device.lastLogin)}</span>
      <span>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${device.status === "Active" ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
          {device.status}
        </span>
      </span>
      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request._id} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
            <p className="font-semibold">{request.deviceName}</p>
            <p className="mt-1 text-xs text-slate-400">
              {request.browser} · {request.operatingSystem} · {formatDate(request.requestedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton label="Approve" icon={Check} disabled={Boolean(busy)} onClick={() => onApprove(request._id)} />
              <ActionButton label="Reject" icon={X} disabled={Boolean(busy)} onClick={() => onReject(request._id)} />
              <ActionButton label="Replace" icon={RefreshCw} disabled={Boolean(busy)} onClick={() => onReplace(request._id)} />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={onRemove}
          disabled={Boolean(busy)}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
        >
          <Trash2 size={14} />
          Remove Device
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Laptop }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon size={18} className="text-cyan-300" />
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Check;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold hover:border-cyan-400 disabled:opacity-60"
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
