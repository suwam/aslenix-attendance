import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Pause, Trash2, Search, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "suspended" | "all">(
    "pending",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    await supabase
      .from("profiles")
      .update({ joining_date: "2026-05-01" })
      .eq("approval_status", "approved")
      .is("joining_date", null);
    let q = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("approval_status", filter);
    const [{ data, error: usersError }, correctionResult] = await Promise.all([
      q,
      supabase.rpc("get_admin_attendance_correction_requests"),
    ]);
    if (usersError) toast.error(usersError.message);
    if (correctionResult.error) toast.error(`Unable to load correction requests: ${correctionResult.error.message}`);

    const correctionRows = correctionResult.data ?? [];
    setUsers(data ?? []);
    setCorrections(
      correctionRows.map((request) => ({
        ...request,
        attendance: request.attendance_date
          ? {
              id: request.attendance_id,
              date: request.attendance_date,
              check_in_time: request.attendance_check_in_time,
              check_out_time: request.attendance_check_out_time,
              status: request.attendance_status,
              work_location: request.attendance_work_location,
            }
          : null,
      })),
    );
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [filter]);

  const updateStatus = async (id: string, status: string, suspended = false) => {
    setBusy(id);
    const u = users.find((x) => x.id === id);
    const updates: any = { approval_status: status, is_suspended: suspended };
    if (status === "approved" && !u?.joining_date) {
      updates.joining_date = format(new Date(), "yyyy-MM-dd");
    }
    const { error } = await supabase.from("profiles").update(updates).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    if (u) {
      await supabase.from("notifications").insert({
        user_id: u.user_id,
        title: `Account ${status}`,
        message: `Your account has been ${status} by an administrator.`,
        type: status === "approved" ? "success" : "warning",
      });
    }
    toast.success(`User ${status}`);
    load();
  };

  const removeUser = async (id: string) => {
    if (!confirm("Delete this user profile? This cannot be undone.")) return;
    setBusy(id);
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("User deleted");
    load();
  };

  const reviewCorrection = async (id: string, action: "approved" | "rejected") => {
    setBusy(id);
    const comment = comments[id] || null;
    const result =
      action === "approved"
        ? await supabase.rpc("approve_attendance_correction_request", {
            _request_id: id,
            _admin_comment: comment,
          })
        : await supabase.rpc("reject_attendance_correction_request", {
            _request_id: id,
            _admin_comment: comment,
          });
    setBusy(null);
    if (result.error) return toast.error(result.error.message);
    toast.success(action === "approved" ? "Correction approved and applied" : "Correction rejected");
    load();
  };

  const filtered = users.filter(
    (u) =>
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );
  const pendingCorrections = corrections.filter((request) => request.status === "pending");

  const FILTERS: Array<{ k: typeof filter; label: string }> = [
    { k: "pending", label: "Pending" },
    { k: "approved", label: "Approved" },
    { k: "rejected", label: "Rejected" },
    { k: "suspended", label: "Suspended" },
    { k: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader
        title="User Approvals"
        subtitle="Review user accounts and attendance correction requests"
      />

      <GlassCard className="mb-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <CalendarClock size={19} className="text-primary" />
              Attendance Corrections
            </div>
            <div className="text-sm text-muted-foreground">
              Approved requests automatically update attendance and preserve audit history.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RequestBadge status={`${pendingCorrections.length} pending`} />
            <RequestBadge status={`${corrections.length} total`} />
          </div>
        </div>
        {pendingCorrections.length > 0 && (
          <div className="mb-4 rounded-xl border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
            {pendingCorrections.length} attendance correction request{pendingCorrections.length === 1 ? "" : "s"} waiting for review.
          </div>
        )}
        {corrections.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-6 text-center text-muted-foreground">
            No attendance correction requests.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {corrections.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-semibold text-white">{request.employee_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {request.attendance?.date ? format(new Date(request.attendance.date), "MMM d, yyyy") : "Attendance"} · requested {format(new Date(request.created_at), "HH:mm")}
                    </div>
                  </div>
                  <RequestBadge status={request.status} />
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <CorrectionValue label="Check-in" value={formatMaybeTime(request.requested_check_in_time)} />
                  <CorrectionValue label="Check-out" value={formatMaybeTime(request.requested_check_out_time)} />
                  <CorrectionValue label="Status" value={request.requested_status?.replace("_", " ") || "No change"} />
                  <CorrectionValue label="Location" value={request.requested_work_location || "No change"} />
                </div>
                <div className="mt-3 rounded-lg bg-black/20 p-3 text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {request.reason}
                </div>
                {request.status === "pending" ? (
                  <div className="mt-3 space-y-3">
                    <Textarea
                      value={comments[request.id] || ""}
                      onChange={(e) => setComments({ ...comments, [request.id]: e.target.value })}
                      placeholder="Optional admin comment"
                      className="min-h-20"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={busy === request.id} onClick={() => reviewCorrection(request.id, "approved")} className="neon-button rounded-lg">
                        <Check size={14} className="mr-1" />
                        Approve
                      </Button>
                      <Button disabled={busy === request.id} onClick={() => reviewCorrection(request.id, "rejected")} variant="outline">
                        <X size={14} className="mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : request.admin_comment ? (
                  <div className="mt-3 text-xs text-muted-foreground">Admin note: {request.admin_comment}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.k ? "text-white" : "glass text-muted-foreground hover:text-foreground"}`}
              style={
                filter === f.k
                  ? { background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }
                  : undefined
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">No users found.</GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <GlassCard>
                <div className="flex items-start gap-3">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/40"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      {u.full_name
                        ?.split(" ")
                        .map((s: string) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {u.department || "—"} · {u.position || "—"}
                    </div>
                  </div>
                  <StatusBadge status={u.approval_status} suspended={u.is_suspended} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Joining date{" "}
                  {u.joining_date
                    ? format(new Date(u.joining_date), "MMM d, yyyy")
                    : "not set"}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {u.approval_status !== "approved" && (
                    <Button
                      size="sm"
                      disabled={busy === u.id}
                      onClick={() => updateStatus(u.id, "approved", false)}
                      className="neon-button rounded-lg"
                    >
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                  )}
                  {u.approval_status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === u.id}
                      onClick={() => updateStatus(u.id, "rejected")}
                    >
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  )}
                  {!u.is_suspended ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === u.id}
                      onClick={() => updateStatus(u.id, u.approval_status, true)}
                    >
                      <Pause size={14} className="mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === u.id}
                      onClick={() => updateStatus(u.id, "approved", false)}
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy === u.id}
                    onClick={() => removeUser(u.id)}
                    className="text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}

function CorrectionValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}

function RequestBadge({ status }: { status: string }) {
  const classes = status.includes("approved")
    ? "bg-success/15 text-success"
    : status.includes("rejected")
      ? "bg-destructive/15 text-destructive"
      : "bg-warning/15 text-warning";
  return (
    <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>
      {formatCorrectionStatus(status)}
    </span>
  );
}

function formatMaybeTime(value?: string | null) {
  return value ? format(new Date(value), "HH:mm") : "No change";
}

function formatCorrectionStatus(status: string) {
  return status.replaceAll("approved", "completed");
}

function StatusBadge({ status, suspended }: { status: string; suspended: boolean }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    suspended: "bg-muted text-muted-foreground",
  };
  const s = suspended ? "suspended" : status;
  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${map[s]}`}
    >
      {s}
    </span>
  );
}
