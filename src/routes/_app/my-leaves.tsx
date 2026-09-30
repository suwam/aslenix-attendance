import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { bsInputToAdDateString, formatNepaliDate } from "@/lib/nepali-calendar";

export const Route = createFileRoute("/_app/my-leaves")({ component: MyLeaves });

const TYPES = [
  { v: "sick", l: "Sick Leave" },
  { v: "casual", l: "Casual Leave" },
  { v: "vacation", l: "Vacation" },
  { v: "emergency", l: "Emergency" },
  { v: "wfh", l: "Work From Home" },
];

function MyLeaves() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
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
    const [balanceData, requestsData] = await Promise.all([
      supabase.from("leave_balances").select("*").eq("user_id", user.id),
      supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setRows(requestsData.data ?? []);
    setBalances(balanceData.data ?? []);
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
    setBusy(true);
    const { error } = await supabase.from("leave_requests").insert({
      leave_type: form.leave_type as any,
      start_date: startDate,
      end_date: endDate as any,
      reason: form.reason,
      user_id: user.id,
      is_half_day: form.is_half_day,
      half_day_session: form.is_half_day ? form.half_day_session : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setOpen(false);
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
    if (!confirm("Cancel this request?")) return;
    await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
    toast.success("Cancelled");
    load();
  };

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const approvedCount = rows.filter((row) => row.status === "approved").length;
  const totalRequestedDays = rows.reduce(
    (sum, row) => sum + getLeaveDays(row.start_date, row.end_date, row.is_half_day),
    0,
  );

  return (
    <>
      <PageHeader
        title="My Leaves"
        subtitle="Request and track your time off"
        actions={
          <Button onClick={() => setOpen((o) => !o)} className="neon-button rounded-xl">
            {open ? (
              <>
                <X size={14} className="mr-1" />
                Close
              </>
            ) : (
              <>
                <Plus size={14} className="mr-1" />
                New request
              </>
            )}
          </Button>
        }
      />

      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Leave Balances</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {TYPES.map((t) => {
            const bal = balances.find((b) => b.leave_type === t.v);
            const total = bal ? Number(bal.balance) : 0;
            const used = bal ? Number(bal.used) : 0;
            const remaining = total - used;
            return (
              <GlassCard key={t.v} className="p-3 border-border bg-card">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t.l}
                </div>
                <div className="mt-1 flex items-baseline gap-1 text-2xl font-bold text-foreground">
                  {remaining}{" "}
                  <span className="text-xs font-normal text-muted-foreground">left</span>
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>Total: {total}</span>
                  <span>Used: {used}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <LeaveMetric label="Pending requests" value={pendingCount} icon={Clock} tone="amber" />
        <LeaveMetric label="Approved" value={approvedCount} icon={CheckCircle2} tone="green" />
        <LeaveMetric
          label="Requested days"
          value={totalRequestedDays}
          icon={CalendarDays}
          tone="blue"
        />
      </div>

      {open && (
        <GlassCard className="mb-6 overflow-hidden border-border bg-card p-0">
          <div className="border-b border-border bg-card px-6 py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                  <FileText size={15} />
                  New leave request
                </div>
                <h2 className="text-xl font-bold text-foreground">Time-off request form</h2>
              </div>
              <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                HR approval required
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[320px_minmax(0,1fr)]"
          >
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock size={22} />
              </div>
              <div className="text-lg font-semibold text-foreground">Request details</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Select your leave type and dates. Add a concise reason so HR can review quickly.
              </p>
              {form.start_date && (form.is_half_day || form.end_date) && (
                <div className="mt-4 rounded-xl border border-border bg-card p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Duration
                  </div>
                  <div className="mt-1 text-2xl font-bold text-foreground">
                    {getLeaveDays(
                      form.start_date,
                      form.is_half_day ? form.start_date : form.end_date,
                      form.is_half_day,
                    )}{" "}
                    {form.is_half_day ? "day" : "days"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-sm font-semibold text-foreground">Type</Label>
                <Select
                  value={form.leave_type}
                  onValueChange={(v) => setForm({ ...form, leave_type: v })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.v} value={t.v}>
                        {t.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-sm font-semibold text-foreground">
                  Leave Duration
                </Label>
                <Select
                  value={form.is_half_day ? "half" : "full"}
                  onValueChange={(v) => setForm({ ...form, is_half_day: v === "half" })}
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Day</SelectItem>
                    <SelectItem value="half">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block text-sm font-semibold text-foreground">
                  {form.is_half_day ? "Leave date (BS)" : "Start date (BS)"}
                </Label>
                <BSDateInput
                  required
                  value={form.start_date}
                  onChange={(value) => setForm({ ...form, start_date: value })}
                  inputClassName="rounded-xl border-border bg-card"
                />
              </div>
              {!form.is_half_day ? (
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-foreground">
                    End date (BS)
                  </Label>
                  <BSDateInput
                    required
                    value={form.end_date}
                    onChange={(value) => setForm({ ...form, end_date: value })}
                    inputClassName="rounded-xl border-border bg-card"
                  />
                </div>
              ) : (
                <div>
                  <Label className="mb-2 block text-sm font-semibold text-foreground">
                    Half-Day Session
                  </Label>
                  <Select
                    value={form.half_day_session}
                    onValueChange={(v) => setForm({ ...form, half_day_session: v })}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">First Half (Morning)</SelectItem>
                      <SelectItem value="afternoon">Second Half (Afternoon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="sm:col-span-2">
                <Label className="mb-2 block text-sm font-semibold text-foreground">Reason</Label>
                <Textarea
                  rows={4}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Add context for this request..."
                  className="rounded-2xl border-border bg-card"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  Your request will appear as pending until an admin reviews it.
                </div>
                <Button type="submit" disabled={busy} className="neon-button h-11 rounded-xl px-6">
                  {busy ? (
                    <Loader2 size={15} className="mr-2 animate-spin" />
                  ) : (
                    <Send size={15} className="mr-2" />
                  )}
                  {busy ? "Submitting..." : "Submit request"}
                </Button>
              </div>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <GlassCard className="border-border bg-card py-16 text-center text-muted-foreground">
          <Sparkles size={24} className="mx-auto mb-3 text-primary" />
          No leave requests yet.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((r) => (
            <GlassCard key={r.id} className="border-border bg-card">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold capitalize text-primary">
                        {typeLabel(r.leave_type)}
                      </span>
                      <LeaveStatusPill status={r.status} />
                    </div>
                    <div className="mt-3 text-lg font-semibold text-foreground">
                      {formatNepaliDate(r.start_date, "DD MMMM YYYY")} BS to{" "}
                      {formatNepaliDate(r.end_date, "DD MMMM YYYY")} BS
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {getLeaveDays(r.start_date, r.end_date, r.is_half_day)} requested days
                      {r.is_half_day &&
                        r.half_day_session &&
                        ` (${r.half_day_session === "morning" ? "Morning" : "Afternoon"})`}
                    </div>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                    <CalendarDays size={19} />
                  </div>
                </div>

                {r.reason && (
                  <div className="rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                    {r.reason}
                  </div>
                )}
                {r.admin_comment && (
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm italic text-foreground">
                    Admin: {r.admin_comment}
                  </div>
                )}
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit rounded-xl"
                    onClick={() => cancel(r.id)}
                  >
                    <X size={14} className="mr-1.5" />
                    Cancel
                  </Button>
                )}
              </div>
            </GlassCard>
          ))}
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
    amber: "border-warning/20 bg-warning/10 text-warning",
    green: "border-success/20 bg-success/10 text-success",
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-600 ",
  };

  return (
    <GlassCard className="border-border bg-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}
        >
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function LeaveStatusPill({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "border-success/20 bg-success/10 text-success"
      : status === "rejected"
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : status === "cancelled"
          ? "border-border bg-card text-muted-foreground"
          : "border-warning/20 bg-warning/10 text-warning";

  const Icon =
    status === "approved"
      ? CheckCircle2
      : status === "rejected"
        ? ShieldAlert
        : status === "cancelled"
          ? X
          : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${className}`}
    >
      <Icon size={12} />
      {status}
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
  return TYPES.find((type) => type.v === value)?.l || value.replace("_", " ");
}
