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
import { CalendarDays, Edit3, History, Info, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { isWeeklyOffDate, WEEKLY_OFF_LABEL } from "@/lib/weekly-off";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/my-attendance")({ component: MyAttendance });

type CorrectionType =
  | "wrong_time"
  | "late_checkin"
  | "early_checkout"
  | "status_correction"
  | "location_correction"
  | "missed_checkin"
  | "missed_checkout";

const CORRECTION_TYPES: Array<{ value: CorrectionType; label: string }> = [
  { value: "wrong_time", label: "Wrong Time" },
  { value: "late_checkin", label: "Late Check-in" },
  { value: "early_checkout", label: "Early Check-out" },
  { value: "status_correction", label: "Status Correction" },
  { value: "location_correction", label: "Location Correction" },
  { value: "missed_checkin", label: "Missed Check-in" },
  { value: "missed_checkout", label: "Missed Check-out" },
];

const ATTENDANCE_STATUSES = ["present", "late", "absent", "leave", "half_day", "wfh"] as const;
const WORK_LOCATIONS = ["Office", "WFH", "Remote", "Client Site", "Field Work"] as const;
const MAX_REASON_LENGTH = 500;

function MyAttendance() {
  const { user, profile } = useAuth();
  const [bsDate, setBsDate] = useState(formatBsInput());
  const date = bsInputToAdDateString(bsDate) ?? format(new Date(), "yyyy-MM-dd");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    correctionType: "wrong_time" as CorrectionType,
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

    const display = getAttendanceStatusDisplay(attendance);

    return {
      status: display.status,
      variant: display.variant,
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
    const correctionType = getSuggestedCorrectionType(attendance);
    setForm({
      correctionType,
      checkIn: "",
      checkOut: "",
      status: getSuggestedStatus(attendance, correctionType),
      workLocation: attendance.work_location || "Office",
      reason: "",
    });
    setErrors({});
    setRequestOpen(true);
  };

  const selectCorrectionType = (correctionType: CorrectionType) => {
    setForm((current) => ({
      ...current,
      correctionType,
      status: attendance ? getSuggestedStatus(attendance, correctionType) : current.status,
    }));
    setErrors((current) => ({ ...current, correctionType: "", correctionField: "" }));
  };

  const submitRequest = async () => {
    if (!user || !profile || !attendance) return;
    const nextErrors = validateCorrectionForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    const { error } = await supabase.from("attendance_correction_requests").insert({
      attendance_id: attendance.id,
      user_id: user.id,
      employee_name: profile.full_name,
      requested_check_in_time: shouldSubmitCheckIn(form.correctionType) ? fromDateTimeInput(form.checkIn) : null,
      requested_check_out_time: shouldSubmitCheckOut(form.correctionType) ? fromDateTimeInput(form.checkOut) : null,
      requested_status: form.correctionType === "status_correction" ? (form.status as any) : null,
      requested_work_location: form.correctionType === "location_correction" ? form.workLocation : null,
      reason: `${getCorrectionTypeLabel(form.correctionType)}: ${form.reason.trim()}`,
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
        <div className="max-w-56">
          <BSDateInput value={bsDate} onChange={setBsDate} />
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            BS date
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!attendance}
            onClick={loadHistory}
            className="h-9 rounded-lg px-3 text-xs"
          >
            <History size={13} className="mr-1.5" />
            History
          </Button>
          <Button
            size="sm"
            disabled={!attendance}
            onClick={openRequest}
            className="neon-button h-9 rounded-lg px-3 text-xs"
          >
            <Edit3 size={13} className="mr-1.5" />
            Correction
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
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="p-4">{formatNepaliDate(r.date, "ddd DD, MMMM YYYY")} BS</td>
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
                      <StatusPill {...getAttendanceStatusDisplay(r)} />
                    </td>
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-background/95 p-0 sm:max-w-2xl">
          <div className="border-b border-white/10 px-6 py-5">
            <DialogHeader>
              <DialogTitle>Request Attendance Correction</DialogTitle>
              <div className="text-sm text-muted-foreground">
                Submit a focused correction request for HR/Admin review.
              </div>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            <CorrectionSection>
              <Field label="Reason Type *" error={errors.correctionType}>
                <Select value={form.correctionType} onValueChange={(value) => selectCorrectionType(value as CorrectionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CORRECTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CorrectionSection>

            <CorrectionSection>
              <div className="mb-3 text-sm font-semibold text-white">Current Attendance Record</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ReadOnlyValue label="Check-in" value={formatTimeDisplay(attendance?.check_in_time)} />
                <ReadOnlyValue label="Check-out" value={formatTimeDisplay(attendance?.check_out_time)} />
                <ReadOnlyValue label="Status" value={attendance ? getAttendanceStatusDisplay(attendance).status : "—"} />
                <ReadOnlyValue label="Location" value={attendance?.work_location || "Office"} />
              </div>
            </CorrectionSection>

            <CorrectionSection>
              <div className="mb-4">
                <div className="text-sm font-semibold text-white">Requested Correction</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Only the fields required for {getCorrectionTypeLabel(form.correctionType)} are shown.
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {shouldShowCheckIn(form.correctionType) && (
                  <Field label="New Check-in Time" error={errors.correctionField}>
                    <BSDateTimeInput
                      value={form.checkIn}
                      onChange={(value) => {
                        setForm({ ...form, checkIn: value });
                        setErrors((current) => ({ ...current, correctionField: "" }));
                      }}
                    />
                  </Field>
                )}
                {shouldShowCheckOut(form.correctionType) && (
                  <Field label="New Check-out Time" error={errors.correctionField}>
                    <BSDateTimeInput
                      value={form.checkOut}
                      onChange={(value) => {
                        setForm({ ...form, checkOut: value });
                        setErrors((current) => ({ ...current, correctionField: "" }));
                      }}
                    />
                  </Field>
                )}
                {form.correctionType === "status_correction" && (
                  <Field label="New Status" error={errors.correctionField}>
                    <Select
                      value={form.status}
                      onValueChange={(status) => {
                        setForm({ ...form, status });
                        setErrors((current) => ({ ...current, correctionField: "" }));
                      }}
                    >
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
                )}
                {form.correctionType === "location_correction" && (
                  <Field label="New Work Location" error={errors.correctionField}>
                    <Select
                      value={form.workLocation}
                      onValueChange={(workLocation) => {
                        setForm({ ...form, workLocation });
                        setErrors((current) => ({ ...current, correctionField: "" }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WORK_LOCATIONS.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            </CorrectionSection>

            <CorrectionSection>
              <div className="mb-3">
                <div className="text-sm font-semibold text-white">Correction Details</div>
              </div>
              <Field label="Reason *" error={errors.reason}>
                <Textarea
                  value={form.reason}
                  maxLength={MAX_REASON_LENGTH}
                  onChange={(e) => {
                    setForm({ ...form, reason: e.target.value });
                    setErrors((current) => ({ ...current, reason: "" }));
                  }}
                  placeholder="Please explain why this attendance correction is required."
                  className="min-h-28 resize-y"
                />
              </Field>
              <div className="mt-2 text-right text-xs text-muted-foreground">
                {form.reason.length}/{MAX_REASON_LENGTH}
              </div>
            </CorrectionSection>

            <div className="flex gap-3 rounded-xl border border-accent/20 bg-accent/10 p-3 text-sm text-muted-foreground">
              <Info size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>This request will be reviewed by HR/Admin before attendance records are updated.</span>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between border-t border-white/10 bg-black/20 px-6 py-4 sm:justify-between">
            <Button variant="outline" onClick={() => setRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={saving} className="neon-button rounded-xl">
              {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
              Submit Correction Request
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

function getAttendanceStatusDisplay(attendance: any): {
  status: string;
  variant: "success" | "warning" | "destructive" | "accent";
} {
  const correctedStatus = attendance?.status?.replace("_", " ") || "Present";
  const hasWarningStatus = attendance?.status !== "present" && (attendance?.is_late || attendance?.is_early_checkout);

  return {
    status: hasWarningStatus ? (attendance?.is_early_checkout ? "Early checkout" : "Late") : correctedStatus,
    variant: hasWarningStatus ? "warning" : attendance?.status ? "success" : "destructive",
  };
}

function RequestBadge({ status }: { status: string }) {
  const classes =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  return (
    <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>
      {formatRequestStatus(status)}
    </span>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function CorrectionSection({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_oklch(1_0_0/.06)]">
      {children}
    </section>
  );
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatTimeDisplay(value?: string | null) {
  return value ? format(new Date(value), "hh:mm a") : "—";
}

function formatRequestStatus(status: string) {
  if (status === "approved") return "Completed";
  return status;
}

function getSuggestedCorrectionType(attendance: any): CorrectionType {
  if (attendance?.is_late) return "late_checkin";
  if (attendance?.is_early_checkout) return "early_checkout";
  return "wrong_time";
}

function getSuggestedStatus(attendance: any, correctionType: CorrectionType) {
  if (correctionType === "late_checkin" || correctionType === "early_checkout") return "present";
  return attendance?.status || "present";
}

function getCorrectionTypeLabel(correctionType: CorrectionType) {
  return CORRECTION_TYPES.find((type) => type.value === correctionType)?.label || "Correction";
}

function shouldShowCheckIn(correctionType: CorrectionType) {
  return correctionType === "wrong_time" || correctionType === "late_checkin" || correctionType === "missed_checkin";
}

function shouldShowCheckOut(correctionType: CorrectionType) {
  return correctionType === "wrong_time" || correctionType === "early_checkout" || correctionType === "missed_checkout";
}

function shouldSubmitCheckIn(correctionType: CorrectionType) {
  return shouldShowCheckIn(correctionType);
}

function shouldSubmitCheckOut(correctionType: CorrectionType) {
  return shouldShowCheckOut(correctionType);
}

function validateCorrectionForm(form: {
  correctionType: CorrectionType;
  checkIn: string;
  checkOut: string;
  status: string;
  workLocation: string;
  reason: string;
}) {
  const errors: Record<string, string> = {};
  if (!form.correctionType) errors.correctionType = "Reason type is required.";

  if (form.correctionType === "wrong_time" && !form.checkIn && !form.checkOut) {
    errors.correctionField = "Enter a new check-in time or check-out time.";
  } else if ((form.correctionType === "late_checkin" || form.correctionType === "missed_checkin") && !form.checkIn) {
    errors.correctionField = "New check-in time is required.";
  } else if ((form.correctionType === "early_checkout" || form.correctionType === "missed_checkout") && !form.checkOut) {
    errors.correctionField = "New check-out time is required.";
  } else if (form.correctionType === "status_correction" && !form.status) {
    errors.correctionField = "New status is required.";
  } else if (form.correctionType === "location_correction" && !form.workLocation) {
    errors.correctionField = "New work location is required.";
  }

  if (!form.reason.trim()) errors.reason = "Reason is required.";
  if (form.reason.length > MAX_REASON_LENGTH) errors.reason = `Reason must be ${MAX_REASON_LENGTH} characters or less.`;
  return errors;
}
