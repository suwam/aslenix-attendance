import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BSDateInput } from "@/components/BSDateInput";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Check,
  X,
  Edit3,
  AlertTriangle,
  Trash2,
  ArrowLeftRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { bsInputToAdDateString, formatNepaliDate } from "@/lib/nepali-calendar";

export const Route = createFileRoute("/_app/admin/leaves")({ component: LeavesPage });

function LeavesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [allRows, setAllRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [editingLeave, setEditingLeave] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ start_date: "", end_date: "" });
  const [editBusy, setEditBusy] = useState(false);

  const [conflictLeave, setConflictLeave] = useState<any | null>(null);
  const [resolutionComment, setResolutionComment] = useState("");
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolving, setResolving] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: leaves, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setAllRows([]);
      setFilteredRows([]);
      setLoading(false);
      return;
    }

    const normalizedLeaves = (leaves ?? []).map((l) => {
      const lowerStatus = String(l.status || "").toLowerCase();
      return {
        ...l,
        status:
          lowerStatus === "approved" ||
          lowerStatus === "rejected" ||
          lowerStatus === "pending" ||
          lowerStatus === "cancelled" ||
          lowerStatus === "half_day_approved"
            ? lowerStatus
            : "pending",
      };
    });

    const requestUserIds = [...new Set(normalizedLeaves.map((l) => l.user_id))];
    const { data: roleRows } = requestUserIds.length
      ? await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", requestUserIds)
          .in("role", ["admin", "super_admin", "hr_manager"])
      : { data: [] };
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    const employeeLeaves = normalizedLeaves.filter((leave) => !adminUserIds.has(leave.user_id));

    // Fetch conflicting attendance records
    let minDate = "";
    let maxDate = "";
    employeeLeaves.forEach((l) => {
      if (!minDate || l.start_date < minDate) minDate = l.start_date;
      if (!maxDate || l.end_date > maxDate) maxDate = l.end_date;
    });

    let attendanceRecords: any[] = [];
    if (requestUserIds.length && minDate && maxDate) {
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .in("user_id", requestUserIds)
        .gte("date", minDate)
        .lte("date", maxDate);
      attendanceRecords = data ?? [];
    }

    // Fetch conflict audit logs
    let auditLogs: any[] = [];
    const leaveIds = employeeLeaves.map((l) => l.id);
    if (leaveIds.length) {
      const { data } = await supabase
        .from("leave_conflict_audit_logs")
        .select("*")
        .in("leave_id", leaveIds);
      auditLogs = data ?? [];
    }

    const ids = [...new Set(employeeLeaves.map((l) => l.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, department")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));

    const mappedLeaves = employeeLeaves.map((l) => {
      const duration = l.is_half_day
        ? 0.5
        : Math.max(1, differenceInDays(new Date(l.end_date), new Date(l.start_date)) + 1);

      const conflicts = attendanceRecords.filter((a) => {
        const isWorkStatus = ["present", "late", "wfh", "half_day", "half_day_present"].includes(
          a.status,
        );
        return (
          a.user_id === l.user_id && a.date >= l.start_date && a.date <= l.end_date && isWorkStatus
        );
      });

      const conflictLog = auditLogs.find((log) => log.leave_id === l.id) || null;

      return {
        ...l,
        profile: map.get(l.user_id),
        duration,
        conflicts,
        conflictLog,
      };
    });

    setAllRows(mappedLeaves);

    let filtered = mappedLeaves;
    if (tab !== "all") filtered = filtered.filter((l) => l.status === tab);
    setFilteredRows(filtered);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tab]);

  const decide = async (leave: any, status: "approved" | "rejected") => {
    if (status === "approved" && leave.conflicts && leave.conflicts.length > 0) {
      setConflictLeave(leave);
      setResolutionComment(comments[leave.id] || "");
      setResolutionReason("");
      return;
    }

    setBusy(leave.id);
    const rpcName = status === "approved" ? "approve_leave_request" : "reject_leave_request";
    const { error } = await supabase.rpc(rpcName, {
      p_leave_id: leave.id,
      p_admin_id: user?.id || "",
      p_comment: comments[leave.id] || "",
    });

    setBusy(null);
    if (error) return toast.error(error.message);

    toast.success(`Leave ${status}`);
    load();
  };

  const handleResolveConflict = async (action: string) => {
    if (!conflictLeave) return;
    if (!resolutionReason.trim()) {
      return toast.error("Please provide a reason for the audit log");
    }

    if (action === "delete_attendance_approve_leave") {
      const confirmDelete = window.confirm(
        "Are you sure you want to soft delete the recorded attendance for this employee? This action is reversible by administrators.",
      );
      if (!confirmDelete) return;
    } else if (action === "keep_attendance_reject_leave") {
      const confirmReject = window.confirm(
        "Are you sure you want to reject this leave request and keep the existing attendance records?",
      );
      if (!confirmReject) return;
    } else if (action === "convert_to_half_day_leave") {
      const confirmHalf = window.confirm(
        "Are you sure you want to convert this to half-day present attendance and half-day approved leave?",
      );
      if (!confirmHalf) return;
    }

    setResolving(true);
    const { error } = await supabase.rpc("resolve_leave_attendance_conflict", {
      p_leave_id: conflictLeave.id,
      p_admin_id: user?.id || "",
      p_action: action,
      p_comment: resolutionComment,
      p_reason: resolutionReason,
    });
    setResolving(false);

    if (error) return toast.error(error.message);

    toast.success("Conflict resolved successfully");
    setConflictLeave(null);
    setResolutionComment("");
    setResolutionReason("");
    load();
  };

  const handleRevertConflict = async (leaveId: string) => {
    const confirmRevert = window.confirm(
      "Are you sure you want to revert this conflict resolution? This will restore the leave request to pending and revert all attendance changes.",
    );
    if (!confirmRevert) return;

    setRevertingId(leaveId);
    const { error } = await supabase.rpc("revert_leave_conflict_resolution", {
      p_leave_id: leaveId,
      p_admin_id: user?.id || "",
    });
    setRevertingId(null);

    if (error) return toast.error(error.message);

    toast.success("Conflict resolution reverted");
    load();
  };

  const submitModification = async () => {
    if (!editingLeave) return;
    const startDate = bsInputToAdDateString(editForm.start_date);
    const endDate = bsInputToAdDateString(
      editingLeave.is_half_day ? editForm.start_date : editForm.end_date,
    );
    if (!startDate || (!editingLeave.is_half_day && !endDate))
      return toast.error("Enter valid BS dates in YYYY-MM-DD format");

    setEditBusy(true);
    const { error } = await supabase.rpc("modify_leave_request", {
      p_leave_id: editingLeave.id,
      p_admin_id: user?.id || "",
      p_new_start: startDate,
      p_new_end: endDate as string,
    });
    setEditBusy(false);

    if (error) return toast.error(error.message);
    toast.success("Leave dates modified successfully");
    setEditingLeave(null);
    load();
  };

  const TABS: Array<{ k: typeof tab; label: string }> = [
    { k: "pending", label: "Pending" },
    { k: "approved", label: "Approved" },
    { k: "rejected", label: "Rejected" },
    { k: "all", label: "All" },
  ];

  const summary = useMemo(
    () => ({
      pending: allRows.filter((row) => row.status === "pending").length,
      approved: allRows.filter((row) => row.status === "approved").length,
      rejected: allRows.filter((row) => row.status === "rejected").length,
      all: allRows.length,
    }),
    [allRows],
  );

  const statusPill = (status: string) => {
    if (status === "approved") return "bg-success/15 text-success";
    if (status === "rejected") return "bg-destructive/15 text-destructive";
    return "bg-warning/15 text-warning";
  };

  const formatLeaveType = (type: string) => type.replace(/_/g, " ");

  const requestedAgo = (date: string) =>
    formatDistanceToNowStrict(new Date(date), { addSuffix: true });

  const formatBsDate = (date: string) => `${formatNepaliDate(date, "DD MMM YYYY")} BS`;

  return (
    <>
      <PageHeader title="Leave Requests" subtitle="Review and approve employee time-off requests" />

      <div className="grid gap-3 mb-5 md:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`group rounded-3xl border border-border p-4 text-left transition-all ${
              tab === t.k
                ? "bg-card shadow-[0_16px_40px_-24px_rgba(255,255,255,0.6)]"
                : "bg-transparent hover:border-border"
            }`}
          >
            <div className="text-sm font-semibold text-foreground">{t.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{summary[t.k]} requests</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : filteredRows.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          No leave requests.
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((r) => (
            <GlassCard key={r.id} className="p-6">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_0.85fr]">
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {r.profile?.avatar_url ? (
                        <img
                          src={r.profile.avatar_url}
                          className="h-14 w-14 rounded-2xl object-cover"
                          alt={r.profile?.full_name || "Avatar"}
                        />
                      ) : (
                        <div
                          className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-semibold text-foreground"
                          style={{ background: "var(--gradient-brand)" }}
                        >
                          {r.profile?.full_name
                            ?.split(" ")
                            .map((s: string) => s[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-lg font-semibold truncate">
                          {r.profile?.full_name || "Unknown"}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {r.profile?.department || "No department"} ·{" "}
                          {r.profile?.email || "No email"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === "pending" && r.conflicts && r.conflicts.length > 0 && (
                        <span className="rounded-full bg-destructive/15 border border-destructive/30 text-destructive px-3 py-1 text-[11px] font-bold uppercase animate-pulse flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Attendance Conflict
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusPill(r.status)}`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase text-muted-foreground">
                        {formatBsDate(r.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Leave type
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatLeaveType(r.leave_type)}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Dates
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatNepaliDate(r.start_date, "DD MMM")} → {formatBsDate(r.end_date)}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Duration
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {r.is_half_day
                          ? `Half Day ${r.half_day_session ? `(${r.half_day_session === "morning" ? "Morning" : "Afternoon"})` : ""}`
                          : `${r.duration} day${r.duration === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>

                  {r.reason && (
                    <div className="rounded-3xl bg-card p-4 text-sm leading-6 text-muted-foreground">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Reason
                      </div>
                      <p className="mt-2 text-base text-foreground">{r.reason}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-card p-5">
                    <div className="text-sm font-semibold text-foreground">Request details</div>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>Submitted</span>
                        <span className="font-semibold text-foreground">
                          {requestedAgo(r.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Requested by</span>
                        <span className="font-semibold text-foreground">
                          {r.profile?.full_name || "Employee"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Approval</span>
                        <span className="font-semibold text-foreground">
                          {r.status === "pending" ? "Waiting" : "Completed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {r.status === "pending" ? (
                    <div className="rounded-3xl bg-card p-5">
                      <div className="mb-3 text-sm font-semibold text-foreground">
                        Review controls
                      </div>
                      <Textarea
                        placeholder="Add a comment (optional)"
                        value={comments[r.id] || ""}
                        onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))}
                        rows={3}
                      />
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Button
                          size="sm"
                          disabled={busy === r.id}
                          onClick={() => decide(r, "approved")}
                          className="neon-button rounded-xl"
                        >
                          <Check size={14} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => decide(r, "rejected")}
                          className="rounded-xl"
                        >
                          <X size={14} className="mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl bg-card p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">Review summary</div>
                        {r.status === "approved" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs"
                            onClick={() => {
                              setEditingLeave(r);
                              setEditForm({ start_date: "", end_date: "" });
                            }}
                          >
                            <Edit3 size={13} className="mr-1.5" />
                            Edit Dates
                          </Button>
                        )}
                      </div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Comment
                          </div>
                          <p className="mt-2 text-foreground">
                            {r.admin_comment || "No admin note provided."}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Date updated</span>
                          <span className="font-semibold text-foreground">
                            {formatBsDate(r.updated_at || r.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conflict Resolution Audit Trail */}
              {r.conflictLog && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <RotateCcw size={14} className="text-primary" />
                      Conflict Resolution Audit Trail
                    </div>
                    {revertingId === r.id ? (
                      <Button size="sm" variant="ghost" disabled className="h-8 text-xs">
                        <Loader2 size={12} className="animate-spin mr-1.5" />
                        Reverting...
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevertConflict(r.id)}
                        className="h-8 rounded-lg text-xs border-destructive/20 hover:border-destructive/40 hover:bg-destructive/10 text-destructive"
                      >
                        Revert Action
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 rounded-2xl bg-card/50 p-4 text-xs md:grid-cols-5 text-muted-foreground border border-border/40">
                    <div>
                      <div className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                        Action Performed
                      </div>
                      <div className="mt-1 font-semibold text-foreground">
                        {r.conflictLog.action_performed === "keep_attendance_reject_leave" &&
                          "Keep Attendance & Reject"}
                        {r.conflictLog.action_performed === "delete_attendance_approve_leave" &&
                          "Delete Attendance & Approve"}
                        {r.conflictLog.action_performed === "convert_to_half_day_leave" &&
                          "Convert to Half-Day"}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                        Performed By
                      </div>
                      <div className="mt-1 font-semibold text-foreground">
                        {r.conflictLog.performed_by_name}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                        Date & Time
                      </div>
                      <div className="mt-1 font-semibold text-foreground">
                        {new Date(r.conflictLog.created_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                        Previous → New Status
                      </div>
                      <div className="mt-1 font-semibold text-foreground flex items-center gap-1.5">
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {r.conflictLog.previous_status}
                        </span>
                        <span>→</span>
                        <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success">
                          {r.conflictLog.new_status.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80">
                        Audit Reason
                      </div>
                      <div
                        className="mt-1 font-semibold text-foreground truncate"
                        title={r.conflictLog.reason || "None"}
                      >
                        {r.conflictLog.reason || "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Edit Dates Dialog */}
      <Dialog open={!!editingLeave} onOpenChange={(open) => !open && setEditingLeave(null)}>
        <DialogContent className="border-border bg-background/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Leave Dates</DialogTitle>
            <div className="text-sm text-muted-foreground">
              Update the approved dates for this leave request. This will recalculate the leave
              balance and attendance automatically.
            </div>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="mb-2 block text-sm font-semibold text-foreground">
                {editingLeave?.is_half_day ? "New leave date (BS)" : "New start date (BS)"}
              </Label>
              <BSDateInput
                required
                value={editForm.start_date}
                onChange={(v) => setEditForm({ ...editForm, start_date: v })}
                inputClassName="rounded-xl border-border bg-card"
              />
            </div>
            {!editingLeave?.is_half_day && (
              <div>
                <Label className="mb-2 block text-sm font-semibold text-foreground">
                  New end date (BS)
                </Label>
                <BSDateInput
                  required
                  value={editForm.end_date}
                  onChange={(v) => setEditForm({ ...editForm, end_date: v })}
                  inputClassName="rounded-xl border-border bg-card"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-row justify-end space-x-2">
            <Button variant="outline" onClick={() => setEditingLeave(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitModification}
              disabled={editBusy}
              className="neon-button rounded-xl"
            >
              {editBusy && <Loader2 size={14} className="mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict Resolution Modal */}
      <Dialog open={!!conflictLeave} onOpenChange={(open) => !open && setConflictLeave(null)}>
        <DialogContent className="border-border bg-background/95 sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-destructive mb-1">
              <AlertTriangle className="h-6 w-6 animate-pulse" />
              <DialogTitle className="text-xl">Attendance Conflict Detected</DialogTitle>
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              This employee has already recorded attendance for one or more dates included in this
              leave request. Please choose how to proceed.
            </div>
          </DialogHeader>

          {conflictLeave && (
            <div className="space-y-4 py-3">
              {/* Attendance Details Section */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                  Conflicting Attendance Details
                </div>
                <div className="space-y-2.5 max-h-40 overflow-y-auto divide-y divide-border/40">
                  {conflictLeave.conflicts?.map((c: any) => (
                    <div
                      key={c.id}
                      className="pt-2.5 first:pt-0 flex flex-wrap items-center justify-between text-sm gap-2"
                    >
                      <div>
                        <span className="font-semibold text-foreground">
                          {formatNepaliDate(c.date, "DD MMM YYYY")} BS
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          AD Date: {c.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-xs text-muted-foreground">Hours Worked</div>
                          <div className="font-semibold text-foreground">
                            {c.work_hours !== null && c.work_hours !== undefined
                              ? `${Math.floor(c.work_hours)}h ${Math.round((c.work_hours - Math.floor(c.work_hours)) * 60)}m`
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Times</div>
                          <div className="text-xs font-semibold text-foreground">
                            {c.check_in_time
                              ? new Date(c.check_in_time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}{" "}
                            -{" "}
                            {c.check_out_time
                              ? new Date(c.check_out_time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </div>
                        </div>
                        <div>
                          <span className="rounded bg-warning/10 text-warning px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Input for comment & audit log reason */}
              <div className="space-y-3">
                <div>
                  <Label className="block text-sm font-semibold mb-1 text-foreground">
                    HR Comments (Optional)
                  </Label>
                  <Textarea
                    placeholder="Provide comments for the employee request (will be visible to employee)"
                    value={resolutionComment}
                    onChange={(e) => setResolutionComment(e.target.value)}
                    rows={2}
                    className="rounded-xl border-border bg-card"
                  />
                </div>
                <div>
                  <Label className="block text-sm font-semibold mb-1 text-foreground">
                    Reason for Audit Trail <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    placeholder="Enter reason for this conflict resolution (stored in audit log)"
                    value={resolutionReason}
                    onChange={(e: any) => setResolutionReason(e.target.value)}
                    className="h-10 rounded-xl border-border bg-card"
                  />
                </div>
              </div>

              {/* Resolution Options */}
              <div className="space-y-2.5 pt-2">
                <button
                  disabled={resolving}
                  onClick={() => handleResolveConflict("keep_attendance_reject_leave")}
                  className="w-full rounded-2xl border border-destructive/25 hover:border-destructive/40 bg-destructive/5 hover:bg-destructive/10 p-3 text-left transition-all flex items-start gap-3 disabled:opacity-50"
                >
                  <div className="mt-0.5 rounded-lg bg-destructive/15 p-1.5 text-destructive">
                    <X size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Keep Attendance & Reject Leave
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Leave status becomes REJECTED. Attendance records remain unchanged. HR comment
                      and action log are saved.
                    </div>
                  </div>
                </button>

                <button
                  disabled={resolving}
                  onClick={() => handleResolveConflict("delete_attendance_approve_leave")}
                  className="w-full rounded-2xl border border-success/25 hover:border-success/40 bg-success/5 hover:bg-success/10 p-3 text-left transition-all flex items-start gap-3 disabled:opacity-50"
                >
                  <div className="mt-0.5 rounded-lg bg-success/15 p-1.5 text-success">
                    <Trash2 size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Delete Attendance & Approve Leave
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Soft deletes conflicting attendance records (recoverable). Leave status
                      becomes APPROVED. Creates audit log.
                    </div>
                  </div>
                </button>

                <button
                  disabled={
                    resolving ||
                    !conflictLeave.conflicts?.every(
                      (c: any) => c.work_hours === null || Number(c.work_hours) < 8.0,
                    )
                  }
                  onClick={() => handleResolveConflict("convert_to_half_day_leave")}
                  className="w-full rounded-2xl border border-primary/25 hover:border-primary/40 bg-primary/5 hover:bg-primary/10 p-3 text-left transition-all flex items-start gap-3 disabled:opacity-50"
                >
                  <div className="mt-0.5 rounded-lg bg-primary/15 p-1.5 text-primary">
                    <ArrowLeftRight size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      Convert to Half-Day Leave{" "}
                      {!conflictLeave.conflicts?.every(
                        (c: any) => c.work_hours === null || Number(c.work_hours) < 8.0,
                      ) && "(Disabled: employee worked 8+ hours)"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Attendance status becomes HALF_DAY_PRESENT. Leave status becomes
                      HALF_DAY_APPROVED. Balance and payroll recalculated.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-border pt-3">
            <Button variant="outline" onClick={() => setConflictLeave(null)} className="rounded-xl">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
