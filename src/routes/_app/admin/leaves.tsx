import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";

export const Route = createFileRoute("/_app/admin/leaves")({ component: LeavesPage });

function LeavesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [allRows, setAllRows] = useState<any[]>([]);
  const [filteredRows, setFilteredRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

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
        duration:
          Math.max(
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
    const row = allRows.find((r) => r.id === id);
    const { error } = await supabase
      .from("leave_requests")
      .update({ status, admin_comment: comments[id] || null, reviewed_by: user?.id })
      .eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    if (row) {
      await supabase.from("notifications").insert({
        user_id: row.user_id,
        title: `Leave ${status}`,
        message: `Your ${row.leave_type} leave from ${row.start_date} to ${row.end_date} was ${status}.`,
        type: status === "approved" ? "success" : "warning",
      });
    }
    toast.success(`Leave ${status}`);
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
            className={`group rounded-3xl border border-white/10 p-4 text-left transition-all ${
              tab === t.k ? "bg-white/5 shadow-[0_16px_40px_-24px_rgba(255,255,255,0.6)]" : "bg-transparent hover:border-white/20"
            }`}
          >
            <div className="text-sm font-semibold text-white">{t.label}</div>
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
                          className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-semibold text-white"
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
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase text-muted-foreground">
                        {formatBsDate(r.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Leave type</div>
                      <div className="mt-2 text-sm font-semibold">{formatLeaveType(r.leave_type)}</div>
                    </div>
                    <div className="rounded-3xl bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dates</div>
                      <div className="mt-2 text-sm font-semibold">
                        {formatNepaliDate(r.start_date, "DD MMM")} → {formatBsDate(r.end_date)}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Duration</div>
                      <div className="mt-2 text-sm font-semibold">{r.duration} day{r.duration === 1 ? "" : "s"}</div>
                    </div>
                  </div>

                  {r.reason && (
                    <div className="rounded-3xl bg-white/5 p-4 text-sm leading-6 text-muted-foreground">
                      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reason</div>
                      <p className="mt-2 text-base text-white">{r.reason}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl bg-white/5 p-5">
                    <div className="text-sm font-semibold text-white">Request details</div>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-center justify-between gap-3">
                        <span>Submitted</span>
                        <span className="font-semibold text-white">{requestedAgo(r.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Requested by</span>
                        <span className="font-semibold text-white">{r.profile?.full_name || "Employee"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Approval</span>
                        <span className="font-semibold text-white">{r.status === "pending" ? "Waiting" : "Completed"}</span>
                      </div>
                    </div>
                  </div>

                  {r.status === "pending" ? (
                    <div className="rounded-3xl bg-white/5 p-5">
                      <div className="mb-3 text-sm font-semibold text-white">Review controls</div>
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
                    <div className="rounded-3xl bg-white/5 p-5">
                      <div className="mb-3 text-sm font-semibold text-white">Review summary</div>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Comment</div>
                          <p className="mt-2 text-white">{r.admin_comment || "No admin note provided."}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Date updated</span>
                          <span className="font-semibold text-white">{formatBsDate(r.updated_at || r.created_at)}</span>
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
    </>
  );
}
