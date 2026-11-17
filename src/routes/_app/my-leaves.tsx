import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Coffee,
  FileText,
  Filter,
  HeartPulse,
  Home,
  Info,
  Loader2,
  Palmtree,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { bsInputToAdDateString, formatNepaliDate } from "@/lib/nepali-calendar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/my-leaves")({ component: MyLeaves });

const TYPES = [
  {
    v: "casual",
    l: "Casual Leave",
    desc: "Short-term personal time off",
    icon: Coffee,
    color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
  },
  {
    v: "sick",
    l: "Sick Leave",
    desc: "Medical illness or recovery",
    icon: HeartPulse,
    color: "text-rose-600 bg-rose-500/10 border-rose-500/20",
  },
  {
    v: "vacation",
    l: "Vacation (Requires Admin Permission)",
    desc: "1-Month annual vacation block",
    icon: Palmtree,
    color: "text-purple-600 bg-purple-500/10 border-purple-500/20",
  },
  {
    v: "emergency",
    l: "Emergency Leave",
    desc: "Critical urgent family matters",
    icon: ShieldAlert,
    color: "text-red-600 bg-red-500/10 border-red-500/20",
  },
  {
    v: "wfh",
    l: "Work From Home",
    desc: "Remote work day request",
    icon: Home,
    color: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  },
];

function getLeaveTypeDetails(value: string) {
  const found = TYPES.find((t) => t.v === value);
  if (found) return found;
  return {
    v: value,
    l: value.replace("_", " "),
    desc: "Leave request",
    icon: Calendar,
    color: "text-primary bg-primary/10 border-primary/20",
  };
}

function MyLeaves() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "history">("all");
  const [vacationConsent, setVacationConsent] = useState(false);
  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
    is_half_day: false,
    half_day_session: "morning",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: requestsData } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setRows(requestsData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const startDate = bsInputToAdDateString(form.start_date);
    const endDate = bsInputToAdDateString(form.is_half_day ? form.start_date : form.end_date);
    if (!startDate || (!form.is_half_day && !endDate))
      return toast.error("Enter valid BS dates in YYYY-MM-DD format");

    const requestedDays = getLeaveDays(startDate, endDate, form.is_half_day);

    // Vacation Leave rule: must be exactly 1 month (28-31 days) and requires Admin permission
    if (form.leave_type === "vacation") {
      if (form.is_half_day) {
        return toast.error(
          "Vacation leave cannot be taken as half day. Vacation must be a 1-month leave block.",
        );
      }
      if (!vacationConsent) {
        return toast.error(
          "Admin Permission is required for Vacation Leave. Please confirm the acknowledgment checkbox.",
        );
      }
      if (requestedDays < 28 || requestedDays > 31) {
        return toast.error(
          `Vacation leave must be requested for exactly 1 month (28–31 days). You selected ${requestedDays} days.`,
        );
      }
    } else if (requestedDays > 30) {
      return toast.error(
        "Standard leave requests cannot exceed 30 consecutive days. For extended absence, please apply for Vacation Leave (1-month block).",
      );
    }

    setBusy(true);
    const { error } = await supabase.from("leave_requests").insert({
      leave_type: form.leave_type as any,
      start_date: startDate,
      end_date: endDate as any,
      reason: form.reason,
      user_id: user.id,
      is_half_day: form.is_half_day && form.leave_type !== "vacation",
      half_day_session:
        form.is_half_day && form.leave_type !== "vacation" ? form.half_day_session : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);

    if (form.leave_type === "vacation") {
      toast.success("1-Month Vacation leave requested. Submitted for Admin permission & approval.");
    } else {
      toast.success("Leave request submitted for Admin review.");
    }

    setOpen(false);
    setVacationConsent(false);
    setForm({
      leave_type: "casual",
      start_date: "",
      end_date: "",
      reason: "",
      is_half_day: false,
      half_day_session: "morning",
    });
    load();
  };

  const cancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
    toast.success("Leave request cancelled");
    load();
  };

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const approvedCount = rows.filter((row) => row.status === "approved").length;
  const historyCount = rows.filter(
    (row) => row.status === "rejected" || row.status === "cancelled",
  ).length;
  const totalRequestedDays = rows.reduce(
    (sum, row) => sum + getLeaveDays(row.start_date, row.end_date, row.is_half_day),
    0,
  );

  const filteredRows = useMemo(() => {
    if (filterStatus === "pending") return rows.filter((r) => r.status === "pending");
    if (filterStatus === "approved") return rows.filter((r) => r.status === "approved");
    if (filterStatus === "history")
      return rows.filter((r) => r.status === "rejected" || r.status === "cancelled");
    return rows;
  }, [rows, filterStatus]);

  // Live computed duration for the active form
  const formRequestedDays = useMemo(() => {
    if (!form.start_date || (!form.is_half_day && !form.end_date)) return 0;
    const s = bsInputToAdDateString(form.start_date);
    const e = bsInputToAdDateString(form.is_half_day ? form.start_date : form.end_date);
    return getLeaveDays(s, e, form.is_half_day && form.leave_type !== "vacation");
  }, [form.start_date, form.end_date, form.is_half_day, form.leave_type]);

  return (
    <>
      <PageHeader
        title="My Leaves"
        subtitle="Request, review, and track your time off requests"
        actions={
          <Button
            onClick={() => {
              setVacationConsent(false);
              setOpen(true);
            }}
            className="neon-button rounded-xl gap-2 font-semibold shadow-xs"
          >
            <Plus size={16} />
            <span>New Leave Request</span>
          </Button>
        }
      />

      {/* ========================================================================= */}
      {/* 1. EXECUTIVE POLICY & GUIDELINES HUB (No Quota Left exposed)               */}
      {/* ========================================================================= */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <GlassCard className="p-4 border-border/80 bg-white/70 dark:bg-card/70 hover:border-primary/40 transition-all flex items-start gap-3.5 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <CalendarClock size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Standard Accrual Quota</div>
            <div className="text-xl font-extrabold text-primary tracking-tight mt-0.5">
              2 Days / Month
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              24 days total annual quota accrual
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 border-border/80 bg-white/70 dark:bg-card/70 hover:border-purple-500/40 transition-all flex items-start gap-3.5 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Palmtree size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Vacation Leave Policy</div>
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 tracking-tight mt-0.5">
              1 Full Month Only
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Strictly 1-month block · Admin approval required
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 border-border/80 bg-white/70 dark:bg-card/70 hover:border-emerald-500/40 transition-all flex items-start gap-3.5 shadow-xs">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">Approval Routing</div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
              Admin Verified
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Every request is reviewed & confirmed by Admin
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUMMARY METRIC TILES                                                  */}
      {/* ========================================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <LeaveMetric label="Pending requests" value={pendingCount} icon={Clock} tone="amber" />
        <LeaveMetric label="Approved leaves" value={approvedCount} icon={CheckCircle2} tone="green" />
        <LeaveMetric
          label="Total requested days"
          value={totalRequestedDays}
          icon={CalendarDays}
          tone="blue"
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. FILTER TABS & SEARCH CONTROLS                                         */}
      {/* ========================================================================= */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterStatus === "all"
                ? "bg-white dark:bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All Requests ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterStatus === "pending"
                ? "bg-white dark:bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("approved")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterStatus === "approved"
                ? "bg-white dark:bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Approved ({approvedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("history")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              filterStatus === "history"
                ? "bg-white dark:bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            History ({historyCount})
          </button>
        </div>

        <span className="text-xs text-muted-foreground font-medium">
          Showing {filteredRows.length} of {rows.length} request{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* ========================================================================= */}
      {/* 4. LEAVE REQUEST POPUP MODAL (DIALOG)                                     */}
      {/* ========================================================================= */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-0 border border-border/80 bg-background shadow-2xl">
          {/* Modal Header */}
          <div className="border-b border-border/70 bg-muted/30 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                <CalendarPlus size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                  New Leave Request
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Submit your absence request. Approvals are managed by administrators.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Modal Form */}
          <form onSubmit={submit} className="p-6 space-y-4 sm:space-y-5">
            {/* Field 1: Leave Category Type */}
            <div>
              <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Leave Category
              </Label>
              <Select
                value={form.leave_type}
                onValueChange={(v) => {
                  setForm({
                    ...form,
                    leave_type: v,
                    is_half_day: v === "vacation" ? false : form.is_half_day,
                  });
                  if (v !== "vacation") {
                    setVacationConsent(false);
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-xl border-border bg-card text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.v} value={t.v} className="py-2.5">
                        <div className="flex items-center justify-between gap-3 w-full">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", t.color)}>
                              <Icon size={14} />
                            </div>
                            <div>
                              <div className="font-semibold text-xs text-foreground">{t.l}</div>
                              <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                            </div>
                          </div>
                          {t.v === "vacation" && (
                            <span className="rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[9px] font-bold px-2 py-0.5 uppercase border border-purple-500/25 shrink-0">
                              Admin Permission
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* DEDICATED CALLOUT: VACATION REQUIRES ADMIN PERMISSION */}
            {form.leave_type === "vacation" && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 flex items-start gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400">
                  <ShieldAlert size={18} />
                </div>
                <div className="text-xs flex-1">
                  <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                    <span>Admin Permission Required</span>
                    <span className="rounded bg-purple-500/25 px-2 py-0.2 text-[9px] font-extrabold uppercase text-purple-700 dark:text-purple-300">
                      1-Month Block Only
                    </span>
                  </div>
                  <p className="mt-1 text-purple-700/90 dark:text-purple-300/90 leading-relaxed">
                    Vacation leave is strictly taken as a 1-month vacation block (28–31 days) and requires prior Admin permission. Your request will remain pending until reviewed and approved by management.
                  </p>
                  <div className="mt-3 flex items-center gap-2.5 pt-2.5 border-t border-purple-500/20">
                    <input
                      type="checkbox"
                      id="admin-permission-check"
                      required
                      checked={vacationConsent}
                      onChange={(e) => setVacationConsent(e.target.checked)}
                      className="h-4 w-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <label
                      htmlFor="admin-permission-check"
                      className="text-xs font-semibold text-purple-900 dark:text-purple-200 cursor-pointer select-none"
                    >
                      I acknowledge that this 1-month vacation request requires direct Admin permission.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Field 2: Duration Mode (Full Day vs Half Day, hidden for vacation) */}
            {form.leave_type !== "vacation" && (
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Duration Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_half_day: false })}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all",
                      !form.is_half_day
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <CalendarDays size={14} />
                    <span>Full Day(s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_half_day: true })}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all",
                      form.is_half_day
                        ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Clock size={14} />
                    <span>Half Day (0.5)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Field 3: Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {form.is_half_day ? "Leave Date (BS)" : "Start Date (BS)"}
                </Label>
                <BSDateInput
                  required
                  value={form.start_date}
                  onChange={(value) => setForm({ ...form, start_date: value })}
                  inputClassName="h-11 rounded-xl border-border bg-card text-sm"
                />
              </div>

              {!form.is_half_day ? (
                <div>
                  <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    End Date (BS)
                  </Label>
                  <BSDateInput
                    required
                    value={form.end_date}
                    onChange={(value) => setForm({ ...form, end_date: value })}
                    inputClassName="h-11 rounded-xl border-border bg-card text-sm"
                  />
                </div>
              ) : (
                <div>
                  <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Half-Day Session
                  </Label>
                  <Select
                    value={form.half_day_session}
                    onValueChange={(v) => setForm({ ...form, half_day_session: v })}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      <SelectItem value="morning">First Half (Morning Session)</SelectItem>
                      <SelectItem value="afternoon">Second Half (Afternoon Session)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Live Duration Preview Card */}
            {form.start_date && (form.is_half_day || form.end_date) && (
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Calculated Absence
                  </div>
                  <div className="text-lg font-extrabold text-foreground mt-0.5">
                    {formRequestedDays} {formRequestedDays === 1 ? "Day" : "Days"}
                    {form.is_half_day && ` (${form.half_day_session === "morning" ? "Morning" : "Afternoon"})`}
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground max-w-[220px]">
                  {form.leave_type === "vacation" ? (
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      🌴 Must span 28–31 days for 1-month block
                    </span>
                  ) : (
                    <span>Standard accrual: 2 days/month</span>
                  )}
                </div>
              </div>
            )}

            {/* Field 4: Reason */}
            <div>
              <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Reason & Context
              </Label>
              <Textarea
                rows={3}
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="State the reason for taking leave (e.g., family commitment, medical recovery, personal errand)..."
                className="rounded-xl border-border bg-card text-sm leading-relaxed"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-border/60 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-xl h-11"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={busy}
                className="neon-button h-11 rounded-xl px-6 font-semibold shadow-xs"
              >
                {busy ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Send size={16} className="mr-2" />
                )}
                {busy
                  ? "Submitting..."
                  : form.leave_type === "vacation"
                    ? "Submit for Admin Permission (1 Month)"
                    : "Submit Leave Request"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 5. LEAVE REQUESTS LIST                                                   */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Loader2 className="animate-spin text-primary" size={28} />
          <span className="text-xs font-medium">Loading your leave records...</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <GlassCard className="border-border/80 bg-card py-16 text-center text-muted-foreground">
          <Sparkles size={28} className="mx-auto mb-3 text-primary/70" />
          <div className="text-base font-bold text-foreground">No leave records found</div>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {filterStatus === "all"
              ? "You haven't submitted any leave requests yet. Click '+ New Leave Request' to apply."
              : `No leave requests matching the '${filterStatus}' filter.`}
          </p>
          {filterStatus !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterStatus("all")}
              className="mt-4 rounded-xl"
            >
              Clear filter
            </Button>
          )}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredRows.map((r) => {
            const details = getLeaveTypeDetails(r.leave_type);
            const Icon = details.icon;
            const requestedDays = getLeaveDays(r.start_date, r.end_date, r.is_half_day);
            const isPending = r.status === "pending";

            return (
              <GlassCard
                key={r.id}
                className="border-border/80 bg-white/80 dark:bg-card/80 hover:border-primary/40 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div className="flex flex-col gap-3.5">
                  {/* Card Header: Type Badge + Duration + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-xs",
                          details.color,
                        )}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold capitalize text-foreground truncate">
                            {typeLabel(r.leave_type)}
                          </h3>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground shrink-0 uppercase">
                            {requestedDays}{" "}
                            {requestedDays === 1 ? "Day" : requestedDays === 0.5 ? "Day" : "Days"}
                            {r.is_half_day &&
                              r.half_day_session &&
                              ` · ${r.half_day_session === "morning" ? "Morning" : "Afternoon"}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Submitted {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    <LeaveStatusPill status={r.status} />
                  </div>

                  {/* Date Range Strip */}
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CalendarDays size={15} className="text-primary shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {formatNepaliDate(r.start_date, "DD MMMM YYYY")} BS
                        <span className="text-muted-foreground font-normal mx-1.5">→</span>
                        {formatNepaliDate(r.end_date, "DD MMMM YYYY")} BS
                      </span>
                    </div>
                  </div>

                  {/* Reason Text */}
                  {r.reason && (
                    <div className="rounded-xl border border-border/60 bg-white/60 dark:bg-card/60 p-3 text-xs text-foreground/90 leading-relaxed italic">
                      "{r.reason}"
                    </div>
                  )}

                  {/* Admin Comment */}
                  {r.admin_comment && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
                      <ShieldCheck size={15} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Admin response:</span> {r.admin_comment}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                {isPending && (
                  <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Pending managerial review
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                      onClick={() => cancel(r.id)}
                    >
                      <X size={13} className="mr-1" />
                      Cancel Request
                    </Button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </>
  );
}

function LeaveMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: "amber" | "green" | "blue";
}) {
  const colors = {
    amber: "border-warning/25 bg-warning/10 text-warning",
    green: "border-success/25 bg-success/10 text-success",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <GlassCard className="border-border/80 bg-white/70 dark:bg-card/70 shadow-xs hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground tracking-tight">
            {value}
          </div>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs ${colors[tone]}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </GlassCard>
  );
}

function LeaveStatusPill({ status }: { status: string }) {
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled";

  const className = isApproved
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : isRejected
      ? "border-destructive/20 bg-destructive/10 text-destructive"
      : isCancelled
        ? "border-border bg-muted text-muted-foreground"
        : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400";

  const Icon = isApproved
    ? CheckCircle2
    : isRejected
      ? ShieldAlert
      : isCancelled
        ? X
        : Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider shrink-0",
        className,
      )}
    >
      <Icon size={12} />
      <span>{status}</span>
    </span>
  );
}

function getLeaveDays(startDate?: string | null, endDate?: string | null, isHalfDay?: boolean) {
  if (isHalfDay) return 0.5;
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function typeLabel(value: string) {
  if (value === "vacation") return "Vacation";
  const found = TYPES.find((type) => type.v === value);
  return found?.l || value.replace("_", " ");
}
