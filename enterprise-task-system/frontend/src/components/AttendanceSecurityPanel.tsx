import { useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, ShieldAlert, TimerReset, X } from "lucide-react";
import { hrmsApi } from "../api/hrmsApi";
import type { AttendanceAction, AttendanceBlockedError, EmployeeDevice, PendingDeviceRequest } from "../types/device";

const actions: Array<{ label: AttendanceAction; icon: typeof LogIn }> = [
  { label: "Check In", icon: LogIn },
  { label: "Check Out", icon: LogOut },
  { label: "Break Start", icon: Coffee },
  { label: "Break End", icon: TimerReset },
];

export function AttendanceSecurityPanel() {
  const [activeDevice, setActiveDevice] = useState<EmployeeDevice | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingDeviceRequest[]>([]);
  const [busyAction, setBusyAction] = useState<AttendanceAction | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDeviceStatus() {
    const data = await hrmsApi.myDeviceStatus();
    setActiveDevice(data.activeDevice);
    setPendingRequests(data.pendingRequests);
  }

  useEffect(() => {
    hrmsApi.registerLoginDevice().finally(loadDeviceStatus);
  }, []);

  async function submitAttendance(action: AttendanceAction) {
    setBusyAction(action);
    setMessage(null);
    try {
      await hrmsApi.attendance(action);
      setMessage(`${action} recorded successfully.`);
    } catch (error) {
      const blockedError = error as AttendanceBlockedError;
      if (blockedError.code === "DEVICE_NOT_REGISTERED") {
        setBlocked(true);
      } else {
        setMessage(blockedError.message);
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Secure Attendance</p>
          <h2 className="mt-2 text-2xl font-bold">Registered device required</h2>
          <p className="mt-1 text-sm text-slate-400">Only the active HR-approved device can perform attendance actions.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="text-slate-400">Active device</p>
          <p className="font-semibold">{activeDevice?.deviceName || "Not registered"}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => submitAttendance(label)}
            disabled={busyAction !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon size={18} />
            {busyAction === label ? "Processing..." : label}
          </button>
        ))}
      </div>

      {pendingRequests.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          New device request pending HR approval. Login remains available, but attendance is blocked on that device.
        </div>
      )}

      {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}

      {blocked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-950 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-red-500/15 p-2 text-red-300">
                  <ShieldAlert size={22} />
                </span>
                <h3 className="text-xl font-bold">Attendance Blocked</h3>
              </div>
              <button type="button" onClick={() => setBlocked(false)} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-300">This device is not registered for your account.</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">Please use your registered device or contact HR.</p>
            <button
              type="button"
              onClick={() => setBlocked(false)}
              className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
