import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BSDateInput } from "@/components/BSDateInput";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, Edit3 } from "lucide-react";
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

  const load = async () => {
    setLoading(true);
    const { data: leaves, error } = await supabase
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalizedLeaves = (leaves ?? []).map((l) => {
      const lowerStatus = String(l.status || "").toLowerCase();
      return {
        ...l,
        status:
          lowerStatus === "approved" || lowerStatus === "rejected" || lowerStatus === "pending" || lowerStatus === "cancelled"
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

    let filtered = employeeLeaves;
    if (tab !== "all") filtered = filtered.filter((l) => l.status === tab);

    const ids = [...new Set(filtered.map((l) => l.user_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, department")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));

    setAllRows(employeeLeaves);
    setFilteredRows(
      filtered.map((l) => ({
        ...l,
        profile: map.get(l.user_id),
        duration: l.is_half_day
          ? 0.5
          : Math.max(
              1,
              differenceInDays(new Date(l.end_date), new Date(l.start_date)) + 1,
            ),
      })),
    );
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [tab]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const rpcName = status === "approved" ? "approve_leave_request" : "reject_leave_request";
    const { error } = await supabase.rpc(rpcName, {
      p_leave_id: id,
      p_admin_id: user?.id,
      p_comment: comments[id] || null
    });
    
    setBusy(null);
    if (error) return toast.error(error.message);
    
    toast.success(`Leave ${status}`);
    load();
  };

  const submitModification = async () => {
    if (!editingLeave) return;
    const startDate = bsInputToAdDateString(editForm.start_date);
    const endDate = bsInputToAdDateString(editingLeave.is_half_day ? editForm.start_date : editForm.end_date);
    if (!startDate || (!editingLeave.is_half_day && !endDate)) return toast.error("Enter valid BS dates in YYYY-MM-DD format");

    setEditBusy(true);
    const { error } = await supabase.rpc("modify_leave_request", {
      p_leave_id: editingLeave.id,
      p_admin_id: user?.id,
      p_new_start: startDate,
      p_new_end: endDate
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
              tab === t.k ? "bg-card shadow-[0_16px_40px_-24px_rgba(255,255,255,0.6)]" : "bg-transparent hover:border-border"
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
                        <div className="text-lg font-semibold truncate">{r.profile?.full_name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {r.profile?.department || "No department"} · {r.profile?.email || "No email"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase ${statusPill(r.status)}`}>
                        {r.status}
                      </span>
                      <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] uppercase text-muted-foreground">
                        {formatBsDate(r.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leave type</div>
                      <div className="mt-2 text-sm font-semibold">{formatLeaveType(r.leave_type)}</div>
                    </div>
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dates</div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatNepaliDate(r.start_date, "DD MMM")} → {formatBsDate(r.end_date)}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-card p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Duration</div>
                      <div className="mt-2 text-sm font-semibold">
                        {r.is_half_day
                          ? `Half Day ${r.half_day_session ? `(${r.half_day_session === "morning" ? "Morning" : "Afternoon"})` : ""}`
                          : `${r.duration} day${r.duration === 1 ? "" : "s"}`}
                      </div>
                    </div>
                  </div>

                  {r.reason && (
                    <div className="rounded-3xl bg-card p-4 text-sm leading-6 text-muted-foreground">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reason</div>
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
                        <span className="font-semibold text-foreground">{requestedAgo(r.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Requested by</span>
                        <span className="font-semibold text-foreground">{r.profile?.full_name || "Employee"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Approval</span>
                        <span className="font-semibold text-foreground">{r.status === "pending" ? "Waiting" : "Completed"}</span>
                      </div>
                    </div>
                  </div>

                  {r.status === "pending" ? (
                    <div className="rounded-3xl bg-card p-5">
                      <div className="mb-3 text-sm font-semibold text-foreground">Review controls</div>
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
                          onClick={() => decide(r.id, "approved")}
                          className="neon-button rounded-xl"
                        >
                          <Check size={14} className="mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === r.id}
                          onClick={() => decide(r.id, "rejected")}
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
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Comment</div>
                          <p className="mt-2 text-foreground">{r.admin_comment || "No admin note provided."}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Date updated</span>
                          <span className="font-semibold text-foreground">{formatBsDate(r.updated_at || r.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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
              Update the approved dates for this leave request. This will recalculate the leave balance and attendance automatically.
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
                <Label className="mb-2 block text-sm font-semibold text-foreground">New end date (BS)</Label>
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
            <Button variant="outline" onClick={() => setEditingLeave(null)}>Cancel</Button>
            <Button onClick={submitModification} disabled={editBusy} className="neon-button rounded-xl">
              {editBusy && <Loader2 size={14} className="mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
