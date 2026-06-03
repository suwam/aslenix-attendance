import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Check, Clock, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/attendance-corrections")({
  component: AttendanceCorrectionsPage,
});

type CorrectionRequest = {
  id: string;
  employee_name: string;
  created_at: string;
  status: string;
  reason: string;
  admin_comment?: string | null;
  requested_check_in_time?: string | null;
  requested_check_out_time?: string | null;
  requested_status?: string | null;
  requested_work_location?: string | null;
  attendance_date?: string | null;
  attendance_id?: string | null;
};

type Filter = "pending" | "approved" | "rejected" | "all";

function AttendanceCorrectionsPage() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_attendance_correction_requests");
    if (error) {
      toast.error(`Unable to load correction requests: ${error.message}`);
      setRequests([]);
    } else {
      setRequests((data ?? []) as CorrectionRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

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
    setComments((current) => ({ ...current, [id]: "" }));
    load();
  };

  const counts = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === "pending").length,
      completed: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
      total: requests.length,
    }),
    [requests],
  );

  const visibleRequests = requests.filter((request) => {
    const matchesFilter = filter === "all" || request.status === filter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      request.employee_name?.toLowerCase().includes(term) ||
      request.reason?.toLowerCase().includes(term);
    return matchesFilter && matchesSearch;
  });

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "approved", label: "Completed", count: counts.completed },
    { key: "rejected", label: "Rejected", count: counts.rejected },
    { key: "all", label: "All", count: counts.total },
  ];

  return (
    <>
      <PageHeader
        title="Attendance Corrections"
        subtitle="Review employee correction notifications and apply approved attendance updates."
      />

      <GlassCard className="mb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <CalendarClock size={21} />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Correction Review Queue</div>
              <div className="text-sm text-muted-foreground">
                Pending employee requests appear here for HR/Admin review.
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <MetricBadge label="Pending" value={counts.pending} tone="warning" />
            <MetricBadge label="Completed" value={counts.completed} tone="success" />
            <MetricBadge label="Total" value={counts.total} tone="muted" />
          </div>
        </div>
      </GlassCard>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                filter === item.key
                  ? "text-white"
                  : "glass text-muted-foreground hover:text-foreground"
              }`}
              style={
                filter === item.key
                  ? { background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }
                  : undefined
              }
            >
              {item.label} <span className="ml-1 opacity-75">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search employee or reason..."
            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm text-white outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      {counts.pending > 0 && filter !== "approved" && (
        <div className="mb-5 rounded-2xl border border-warning/20 bg-warning/10 p-4 text-sm text-warning">
          {counts.pending} attendance correction request{counts.pending === 1 ? "" : "s"} waiting
          for admin review.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : visibleRequests.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No attendance correction requests found.
        </GlassCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleRequests.map((request) => (
            <CorrectionCard
              key={request.id}
              request={request}
              busy={busy === request.id}
              comment={comments[request.id] || ""}
              onCommentChange={(value) => setComments({ ...comments, [request.id]: value })}
              onApprove={() => reviewCorrection(request.id, "approved")}
              onReject={() => reviewCorrection(request.id, "rejected")}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CorrectionCard({
  request,
  busy,
  comment,
  onCommentChange,
  onApprove,
  onReject,
}: {
  request: CorrectionRequest;
  busy: boolean;
  comment: string;
  onCommentChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-xl shadow-black/10 transition hover:border-primary/25 hover:bg-white/[0.06]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-white">{request.employee_name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Clock size={13} />
            <span>
              {request.attendance_date
                ? format(new Date(request.attendance_date), "MMM d, yyyy")
                : "Attendance record"}
            </span>
            <span>requested {format(new Date(request.created_at), "HH:mm")}</span>
          </div>
        </div>
        <RequestBadge status={request.status} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <CorrectionValue label="Check-in" value={formatMaybeTime(request.requested_check_in_time)} />
        <CorrectionValue label="Check-out" value={formatMaybeTime(request.requested_check_out_time)} />
        <CorrectionValue
          label="Status"
          value={request.requested_status?.replace("_", " ") || "No change"}
        />
        <CorrectionValue label="Location" value={request.requested_work_location || "No change"} />
      </div>

      <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-3 text-sm leading-relaxed">
        <span className="text-muted-foreground">Employee reason: </span>
        <span className="font-medium text-foreground">{request.reason}</span>
      </div>

      {request.status === "pending" ? (
        <div className="mt-4 space-y-3">
          <Textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Optional admin note for this correction"
            className="min-h-20 rounded-xl"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} onClick={onReject} variant="outline" className="rounded-xl">
              <X size={15} className="mr-2" />
              Reject
            </Button>
            <Button disabled={busy} onClick={onApprove} className="neon-button rounded-xl">
              <Check size={15} className="mr-2" />
              Approve and Apply
            </Button>
          </div>
        </div>
      ) : request.admin_comment ? (
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.035] p-3 text-xs text-muted-foreground">
          Admin note: {request.admin_comment}
        </div>
      ) : null}
    </div>
  );
}

function CorrectionValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}

function RequestBadge({ status }: { status: string }) {
  const classes =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";
  return (
    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${classes}`}>
      {formatCorrectionStatus(status)}
    </span>
  );
}

function MetricBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "success" | "muted";
}) {
  const classes = {
    warning: "border-warning/20 bg-warning/10 text-warning",
    success: "border-success/20 bg-success/10 text-success",
    muted: "border-white/10 bg-white/[0.04] text-muted-foreground",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-right ${classes[tone]}`}>
      <div className="text-lg font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider">{label}</div>
    </div>
  );
}

function formatMaybeTime(value?: string | null) {
  return value ? format(new Date(value), "HH:mm") : "No change";
}

function formatCorrectionStatus(status: string) {
  return status.replaceAll("approved", "completed");
}
