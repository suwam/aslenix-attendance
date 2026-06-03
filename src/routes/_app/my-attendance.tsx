import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { AttendanceLocationLinks } from "@/components/AttendanceLocationLinks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatWorkHours } from "@/lib/work-hours";
import { CalendarDays, Edit3, History, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/my-attendance")({ component: MyAttendance });

function MyAttendance() {
  const { user, profile } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [form, setForm] = useState({
    checkIn: "",
    checkOut: "",
    status: "present",
    workLocation: "Office",
    reason: "",
  });
  const isWeeklyOff = isWeeklyOffDate(date);

  const attendance = useMemo(() => rows[0] ?? null, [rows]);
  const summary = useMemo(() => {
    if (isWeeklyOff && !attendance) {
      return {
        status: "Weekly off",
        variant: "accent",
        checkIn: "—",
        checkOut: "—",
        hours: "—",
      };
    }

    if (!attendance) {
      return {
        status: "Absent",
        variant: "destructive",
        checkIn: "—",
        checkOut: "—",
        hours: "—",
      };
    }

    return {
      status: attendance.is_early_checkout
        ? "Early checkout"
        : attendance.is_late
          ? "Late"
          : attendance.status?.replace("_", " ") || "Present",
      variant: attendance.is_late || attendance.is_early_checkout ? "warning" : "success",
      checkIn: attendance.check_in_time ? format(new Date(attendance.check_in_time), "HH:mm") : "—",
      checkOut: attendance.check_out_time ? format(new Date(attendance.check_out_time), "HH:mm") : "—",
      hours: attendance.work_hours ? formatWorkHours(attendance.work_hours) : "—",
    };
  }, [attendance, isWeeklyOff]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from("attendance").select("*").eq("user_id", user.id).eq("date", date).order("date", { ascending: false }),
      supabase
        .from("attendance_correction_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([attendanceResult, requestResult]) => {
      setRows(attendanceResult.data ?? []);
      setRequests(requestResult.data ?? []);
      setLoading(false);
    });
  }, [user, date]);

  const openRequest = () => {
    if (!attendance) return toast.error("Select a day with an attendance record");
    setForm({
      checkIn: toDateTimeInput(attendance.check_in_time),
      checkOut: toDateTimeInput(attendance.check_out_time),
      status: attendance.status || "present",
      workLocation: attendance.work_location || "Office",
      reason: "",
    });
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    if (!user || !profile || !attendance) return;
    if (!form.reason.trim()) return toast.error("Reason for correction is required");
    setSaving(true);
    const { error } = await supabase.from("attendance_correction_requests").insert({
      attendance_id: attendance.id,
      user_id: user.id,
      employee_name: profile.full_name,
      requested_check_in_time: fromDateTimeInput(form.checkIn),
      requested_check_out_time: fromDateTimeInput(form.checkOut),
      requested_status: form.status as any,
      requested_work_location: form.workLocation,
      reason: form.reason.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Correction request submitted");
    setRequestOpen(false);
    const { data } = await supabase
      .from("attendance_correction_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
  };

  const loadHistory = async () => {
    if (!attendance) return toast.info("No attendance record selected");
    setHistoryOpen(true);
    const { data, error } = await supabase
      .from("attendance_audit_logs")
      .select("*")
      .eq("attendance_id", attendance.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setHistory(data ?? []);
  };

  return (
    <>
      <PageHeader title="My Attendance" subtitle="Your attendance for the selected day" />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-48">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!attendance} onClick={loadHistory}>
            <History size={14} className="mr-1" />
            History
          </Button>
          <Button disabled={!attendance} onClick={openRequest} className="neon-button rounded-xl">
            <Edit3 size={14} className="mr-1" />
            Request Correction
          </Button>
        </div>
      </div>

      <div className="grid gap-3 mb-5 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</div>
          <div className="mt-3">
            <StatusPill status={summary.status} variant={summary.variant} />
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Check-in</div>
          <div className="mt-3 text-lg font-semibold">{summary.checkIn}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Check-out</div>
          <div className="mt-3 text-lg font-semibold">{summary.checkOut}</div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Hours</div>
          <div className="mt-3 text-lg font-semibold">{summary.hours}</div>
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : rows.length === 0 && isWeeklyOff ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
              <CalendarDays size={22} />
            </div>
            <div className="text-lg font-semibold text-accent">{WEEKLY_OFF_LABEL}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Saturday is weekly off. No attendance record is required.
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Date</th>
                  <th className="p-4">Check-in</th>
                  <th className="p-4">Check-out</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Audit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">{format(new Date(r.date), "EEE, MMM d")}</td>
                    <td className="p-4 tabular-nums">
                      {r.check_in_time ? format(new Date(r.check_in_time), "HH:mm") : "—"}
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.check_out_time ? format(new Date(r.check_out_time), "HH:mm") : "—"}
                    </td>
                    <td className="p-4">
                      <AttendanceLocationLinks
                        checkInLatitude={r.check_in_latitude}
                        checkInLongitude={r.check_in_longitude}
                        checkInAccuracyMeters={r.check_in_accuracy_meters}
                        checkOutLatitude={r.check_out_latitude}
                        checkOutLongitude={r.check_out_longitude}
                        checkOutAccuracyMeters={r.check_out_accuracy_meters}
                      />
                    </td>
                    <td className="p-4 tabular-nums">
                      {r.work_hours ? formatWorkHours(r.work_hours) : "—"}
                    </td>
                    <td className="p-4">
                      <StatusPill
                        status={r.is_early_checkout ? "Early checkout" : r.is_late ? "Late" : r.status?.replace("_", " ")}
                        variant={r.is_late || r.is_early_checkout ? "warning" : r.status ? "success" : "destructive"}
                      />
                    </td>
                    <td className="p-4">{r.is_edited ? <EditedBadge /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {requests.length > 0 && (
        <GlassCard className="mt-5">
          <div className="mb-3 text-sm font-semibold text-white">Correction requests</div>
          <div className="space-y-2">
            {requests.slice(0, 4).map((request) => (
              <div key={request.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-white">{format(new Date(request.created_at), "MMM d, yyyy HH:mm")}</div>
                  <div className="text-xs text-muted-foreground">{request.reason}</div>
                </div>
                <RequestBadge status={request.status} />
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-background/95 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Attendance Correction</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correct check-in">
              <Input type="datetime-local" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            </Field>
            <Field label="Correct check-out">
              <Input type="datetime-local" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            </Field>
            <Field label="Correct status">
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["present", "late", "absent", "leave", "half_day", "wfh"].map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Work location">
              <Input value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Example: I accidentally checked out at 10:19 AM and need HR review." className="min-h-28" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={saving} className="neon-button rounded-xl">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-background/95 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attendance History</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-center text-muted-foreground">
              No previous modifications.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-white">Edited by {item.edited_by_name}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(item.created_at), "MMM d, yyyy HH:mm")}</div>
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

function StatusPill({
  status,
  variant,
}: {
  status: string;
  variant: "success" | "warning" | "destructive" | "accent";
}) {
  const classes =
    variant === "success"
      ? "bg-success/15 text-success"
      : variant === "warning"
        ? "bg-warning/15 text-warning"
        : variant === "destructive"
          ? "bg-destructive/15 text-destructive"
          : "bg-accent/15 text-accent";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${classes}`}>
      {status}
    </span>
  );
}

function EditedBadge() {
  return (
    <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
      Edited
    </span>
  );
}

function RequestBadge({ status }: { status: string }) {
  const classes =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  return <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
