import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { AttendanceLocationLinks } from "@/components/AttendanceLocationLinks";
import { BSDateInput, BSDateTimeInput } from "@/components/BSDateInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatWorkHours } from "@/lib/work-hours";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";
import { CalendarClock, Clock3, FileText, History, Loader2, MapPin, Search, Edit3, ShieldCheck, UserRound } from "lucide-react";
import { format } from "date-fns";
import { isWeeklyOffDate } from "@/lib/weekly-off";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/attendance")({ component: AttendancePage });

const ATTENDANCE_STATUSES = ["present", "late", "absent", "leave", "half_day", "wfh"] as const;

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: (typeof ATTENDANCE_STATUSES)[number];
  work_hours: number | null;
  work_location?: string | null;
  is_late: boolean;
  is_early_checkout: boolean;
  is_edited?: boolean;
  check_in_latitude?: number | null;
  check_in_longitude?: number | null;
  check_in_accuracy_meters?: number | null;
  check_out_latitude?: number | null;
  check_out_longitude?: number | null;
  check_out_accuracy_meters?: number | null;
};

type EmployeeRow = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  avatar_url: string | null;
  attendance?: AttendanceRecord;
};

type AuditLog = {
  id: string;
  attendance_id: string;
  employee_name: string;
  original_value: Record<string, unknown>;
  updated_value: Record<string, unknown>;
  edited_by_name: string;
  reason: string;
  source: string;
  created_at: string;
};

type CorrectionRequest = {
  id: string;
  attendance_id: string;
  employee_name: string;
  requested_check_in_time: string | null;
  requested_check_out_time: string | null;
  requested_status: (typeof ATTENDANCE_STATUSES)[number] | null;
  requested_work_location: string | null;
  reason: string;
  status: string;
  created_at: string;
  attendance_date: string | null;
};

type EditForm = {
  checkIn: string;
  checkOut: string;
  status: (typeof ATTENDANCE_STATUSES)[number];
  workLocation: string;
  reason: string;
};

function AttendancePage() {
  const { user, isAdmin } = useAuth();
  const [bsDate, setBsDate] = useState(formatBsInput());
  const date = bsInputToAdDateString(bsDate) ?? format(new Date(), "yyyy-MM-dd");
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyRow, setHistoryRow] = useState<EmployeeRow | null>(null);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [form, setForm] = useState<EditForm>({
    checkIn: "",
    checkOut: "",
    status: "present",
    workLocation: "Office",
    reason: "",
  });
  const isWeeklyOff = isWeeklyOffDate(date);

  const load = async () => {
    setLoading(true);
    const [{ data: att }, { data: profs }, { data: roleRows }, correctionsResult] = await Promise.all([
      supabase.from("attendance").select("*").eq("date", date),
      supabase.from("profiles").select("*").eq("approval_status", "approved"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
      supabase.rpc("get_admin_attendance_correction_requests"),
    ]);
    if (correctionsResult.error) toast.error(`Unable to load correction requests: ${correctionsResult.error.message}`);
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeProfiles = ((profs ?? []) as EmployeeRow[])
      .filter((profile) => !adminUserIds.has(profile.user_id))
      .sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, { sensitivity: "base" }),
      );
    const map = new Map(((att ?? []) as AttendanceRecord[]).map((a) => [a.user_id, a]));
    const merged = employeeProfiles.map((p) => ({ ...p, attendance: map.get(p.user_id) }));
    setRows(merged);
    setCorrectionRequests(
      ((correctionsResult.data ?? []) as CorrectionRequest[]).filter(
        (request) => request.status === "pending" && request.attendance_date === date,
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [date]);

  const stats = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.attendance && ["present", "wfh", "late"].includes(r.attendance.status)).length;
    const late = rows.filter((r) => r.attendance?.is_late).length;
    const absent = rows.filter((r) => !r.attendance).length;
    const wfh = rows.filter((r) => r.attendance?.status === "wfh").length;
    return { total, present, late, absent, wfh };
  }, [rows]);

  const filtered = rows.filter(
    (r) => !search || r.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const startEdit = (row: EmployeeRow, request?: CorrectionRequest) => {
    if (!row.attendance) return toast.error("No attendance record exists for this date");
    setEditing(row);
    setForm({
      checkIn: toDateTimeInput(request?.requested_check_in_time ?? row.attendance.check_in_time),
      checkOut: toDateTimeInput(request?.requested_check_out_time ?? row.attendance.check_out_time),
      status: request?.requested_status || row.attendance.status || "present",
      workLocation: request?.requested_work_location || row.attendance.work_location || "Office",
      reason: request ? `Employee correction request: ${request.reason}` : "",
    });
  };

  const startEditFromRequest = (request: CorrectionRequest) => {
    const row = rows.find((item) => item.attendance?.id === request.attendance_id);
    if (!row) return toast.error("Attendance record for this request is not visible on the selected date");
    startEdit(row, request);
  };

  const loadHistory = async (row: EmployeeRow) => {
    if (!row.attendance) return toast.info("No edit history for absent records");
    setHistoryRow(row);
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from("attendance_audit_logs")
      .select("*")
      .eq("attendance_id", row.attendance.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setHistory(((data ?? []) as unknown as AuditLog[]).map(normalizeAuditLog));
    setHistoryLoading(false);
  };

  const requestSave = () => {
    if (!form.reason.trim()) return toast.error("Reason for change is required");
    if (!editing?.attendance) return toast.error("Select an attendance record first");
    setConfirming(true);
  };

  const saveEdit = async () => {
    if (!editing?.attendance || !user) return;
    setSaving(true);
    const { error } = await supabase.rpc("apply_admin_attendance_edit", {
      _attendance_id: editing.attendance.id,
      _check_in_time: fromDateTimeInput(form.checkIn),
      _check_out_time: fromDateTimeInput(form.checkOut),
      _status: form.status,
      _work_location: form.workLocation,
      _reason: form.reason,
    });
    setSaving(false);
    setConfirming(false);
    if (error) return toast.error(error.message);
    toast.success(`Attendance updated for ${editing.full_name}`);
    setEditing(null);
    await load();
  };

  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily attendance overview and correction history" />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total employees" value={stats.total} />
          <StatCard label="Present" value={stats.present} tone="text-success" />
          <StatCard label="Late" value={stats.late} tone="text-warning" />
          <StatCard label="Absent" value={stats.absent} tone="text-destructive" />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-52">
            <BSDateInput value={bsDate} onChange={setBsDate} />
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              BS date
            </div>
          </div>
          <div className="relative max-w-md flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee..." className="pl-9" />
          </div>
        </div>
      </div>

      {correctionRequests.length > 0 && (
        <GlassCard className="mb-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <CalendarClock size={19} className="text-primary" />
                Pending correction requests
              </div>
              <div className="text-sm text-muted-foreground">
                Open a request to edit attendance with the employee reason already attached to the audit log.
              </div>
            </div>
            <Pill className="bg-warning/15 text-warning" label={`${correctionRequests.length} pending`} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {correctionRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{request.employee_name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Requested {format(new Date(request.created_at), "HH:mm")} · {request.reason}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => startEditFromRequest(request)} className="neon-button rounded-lg">
                    <Edit3 size={14} className="mr-1" />
                    Review edit
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <DiffRow label="Requested check-in" value={formatTime(request.requested_check_in_time)} />
                  <DiffRow label="Requested check-out" value={formatTime(request.requested_check_out_time)} />
                  <DiffRow label="Requested status" value={request.requested_status?.replace("_", " ") || "No change"} />
                  <DiffRow label="Requested location" value={request.requested_work_location || "No change"} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Check-in</th>
                  <th className="p-4">Check-out</th>
                  <th className="p-4">Work location</th>
                  <th className="p-4">Map</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: "var(--gradient-brand)" }}>
                            {initials(r.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-medium">
                            <span>{r.full_name}</span>
                            {r.attendance?.is_edited && <EditedBadge />}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{r.department || "-"}</td>
                    <td className="p-4 tabular-nums">{formatTime(r.attendance?.check_in_time)}</td>
                    <td className="p-4 tabular-nums">{formatTime(r.attendance?.check_out_time)}</td>
                    <td className="p-4">{r.attendance?.work_location || "-"}</td>
                    <td className="p-4">
                      <AttendanceLocationLinks
                        checkInLatitude={r.attendance?.check_in_latitude}
                        checkInLongitude={r.attendance?.check_in_longitude}
                        checkInAccuracyMeters={r.attendance?.check_in_accuracy_meters}
                        checkOutLatitude={r.attendance?.check_out_latitude}
                        checkOutLongitude={r.attendance?.check_out_longitude}
                        checkOutAccuracyMeters={r.attendance?.check_out_accuracy_meters}
                      />
                    </td>
                    <td className="p-4 tabular-nums">{r.attendance?.work_hours ? formatWorkHours(r.attendance.work_hours) : "-"}</td>
                    <td className="p-4">
                      <StatusPill status={r.attendance?.status} late={r.attendance?.is_late} earlyCheckout={r.attendance?.is_early_checkout} weeklyOff={isWeeklyOff} />
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {isAdmin && (
                          <Button
                            size="icon"
                            disabled={!r.attendance}
                            onClick={() => startEdit(r)}
                            className="neon-button h-9 w-9 rounded-lg"
                            title="Edit attendance"
                            aria-label={`Edit attendance for ${r.full_name}`}
                          >
                            <Edit3 size={15} />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={!r.attendance} onClick={() => loadHistory(r)}>
                          <History size={14} className="mr-1" />
                          History
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-background/95 p-0 shadow-[0_0_80px_-28px_oklch(0.65_0.27_22)] sm:max-w-4xl">
          <div className="relative overflow-hidden rounded-t-xl border-b border-white/10 bg-[radial-gradient(circle_at_20%_0%,oklch(0.65_0.27_22/.22),transparent_34%),radial-gradient(circle_at_90%_10%,oklch(0.6_0.25_260/.24),transparent_36%),oklch(1_0_0/.035)] p-5 sm:p-6">
            <DialogHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                    <ShieldCheck size={13} />
                    Audit protected edit
                  </div>
                  <DialogTitle className="text-2xl">Edit Attendance</DialogTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Review the original record, apply the correction, and preserve the reason in history.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Record date</div>
                  <div className="mt-1 font-semibold text-white">{formatNepaliDate(date, "ddd DD, MMMM YYYY")} BS</div>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[1.1fr_1.5fr]">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center gap-3">
                  {editing?.avatar_url ? (
                    <img src={editing.avatar_url} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: "var(--gradient-brand)" }}>
                      {initials(editing?.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{editing?.full_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{editing?.email}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <EditSnapshot icon={<Clock3 size={15} />} label="Original check-in" value={formatTime(editing?.attendance?.check_in_time)} />
                  <EditSnapshot icon={<Clock3 size={15} />} label="Original check-out" value={formatTime(editing?.attendance?.check_out_time)} />
                  <EditSnapshot icon={<MapPin size={15} />} label="Original location" value={editing?.attendance?.work_location || "-"} />
                  <EditSnapshot icon={<UserRound size={15} />} label="Original status" value={editing?.attendance?.status?.replace("_", " ") || "-"} />
                </div>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4 shadow-[inset_0_1px_0_oklch(1_0_0/.08)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Corrected values</div>
                    <div className="text-xs text-muted-foreground">These values will become the active attendance record.</div>
                  </div>
                  <Pill className="bg-primary/15 text-primary" label="live edit" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Check-in time">
                    <BSDateTimeInput value={form.checkIn} onChange={(value) => setForm({ ...form, checkIn: value })} />
                  </Field>
                  <Field label="Check-out time">
                    <BSDateTimeInput value={form.checkOut} onChange={(value) => setForm({ ...form, checkOut: value })} />
                  </Field>
                  <Field label="Work location">
                    <Input value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} placeholder="Office, WFH, Client site..." />
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as EditForm["status"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {ATTENDANCE_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setForm({ ...form, status })}
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        form.status === status
                          ? "border-primary/40 bg-primary/15 text-white shadow-[0_0_26px_-14px_oklch(0.65_0.27_22)]"
                          : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {status.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-warning/20 bg-warning/[0.045] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <FileText size={16} className="text-warning" />
                Reason for audit history
              </div>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Explain why this record is being corrected"
                className="min-h-28 border-warning/20 bg-black/25"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 bg-black/20 px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={requestSave} className="neon-button rounded-xl">
              Review changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="w-[calc(100vw-2rem)] border-white/10 bg-background/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm attendance update</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3 text-warning">
              <ShieldCheck size={18} />
              This update will write an audit log and mark the record as edited.
            </div>
            <DiffRow label="Check-in" value={form.checkIn || "-"} />
            <DiffRow label="Check-out" value={form.checkOut || "-"} />
            <DiffRow label="Status" value={form.status.replace("_", " ")} />
            <DiffRow label="Work location" value={form.workLocation || "-"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button onClick={saveEdit} disabled={saving} className="neon-button rounded-xl">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyRow)} onOpenChange={(open) => !open && setHistoryRow(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-background/95 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attendance History</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">{historyRow?.full_name} · {date}</div>
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-center text-muted-foreground">
              No previous modifications.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-white">{item.source === "employee_request" ? "Correction request approved" : "Admin edit"}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(item.created_at), "MMM d, yyyy HH:mm")}</div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Edited by {item.edited_by_name}</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Snapshot title="Original" value={item.original_value} />
                    <Snapshot title="Updated" value={item.updated_value} />
                  </div>
                  <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm">
                    <span className="text-muted-foreground">Reason: </span>
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatCard({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <GlassCard className="p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
      <div className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EditedBadge() {
  return (
    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
      Edited
    </span>
  );
}

function DiffRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function EditSnapshot({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        <span>{label}</span>
      </div>
      <span className="text-right text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function Snapshot({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded-lg bg-black/20 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1 text-xs">
        {["check_in_time", "check_out_time", "status", "work_location", "work_hours"].map((key) => (
          <div key={key} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{key.replaceAll("_", " ")}</span>
            <span className="text-right text-white">{formatSnapshotValue(key, value[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({
  status,
  late,
  earlyCheckout,
  weeklyOff,
}: {
  status?: string;
  late?: boolean;
  earlyCheckout?: boolean;
  weeklyOff?: boolean;
}) {
  if (!status && weeklyOff) return <Pill className="bg-accent/15 text-accent" label="Weekly off" />;
  if (!status) return <Pill className="bg-destructive/15 text-destructive" label="Absent" />;
  if (earlyCheckout) return <Pill className="bg-warning/15 text-warning" label="Early checkout" />;
  const map: Record<string, string> = {
    present: "bg-success/15 text-success",
    late: "bg-warning/15 text-warning",
    leave: "bg-muted text-muted-foreground",
    half_day: "bg-warning/15 text-warning",
    wfh: "bg-accent/15 text-accent",
    absent: "bg-destructive/15 text-destructive",
  };
  return <Pill className={map[late ? "late" : status] || "bg-muted"} label={late ? "Late" : status.replace("_", " ")} />;
}

function Pill({ className, label }: { className: string; label: string }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${className}`}>{label}</span>;
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatTime(value?: string | null) {
  return value ? format(new Date(value), "HH:mm") : "-";
}

function formatSnapshotValue(key: string, value: unknown) {
  if (!value) return "-";
  if (key.endsWith("_time")) return format(new Date(String(value)), "HH:mm");
  if (key === "work_hours") return formatWorkHours(Number(value));
  return String(value).replace("_", " ");
}

function normalizeAuditLog(value: AuditLog): AuditLog {
  return {
    ...value,
    original_value: value.original_value || {},
    updated_value: value.updated_value || {},
  };
}

function initials(name?: string) {
  return (name || "")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
