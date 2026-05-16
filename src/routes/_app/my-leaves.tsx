import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
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
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    leave_type: "casual",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("leave_requests")
      .insert({ ...form, user_id: user.id, leave_type: form.leave_type as any });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Leave requested");
    setOpen(false);
    setForm({ leave_type: "casual", start_date: "", end_date: "", reason: "" });
    load();
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this request?")) return;
    await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
    toast.success("Cancelled");
    load();
  };

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

      {open && (
        <GlassCard className="mb-5">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select
                value={form.leave_type}
                onValueChange={(v) => setForm({ ...form, leave_type: v })}
              >
                <SelectTrigger>
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
            <div className="hidden sm:block" />
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Reason</Label>
              <Textarea
                rows={3}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="neon-button rounded-xl">
                {busy ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          No leave requests yet.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize"
                      style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}
                    >
                      {r.leave_type.replace("_", " ")}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : r.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    {format(new Date(r.start_date), "MMM d, yyyy")} →{" "}
                    {format(new Date(r.end_date), "MMM d, yyyy")}
                  </div>
                  {r.reason && <div className="text-xs text-muted-foreground mt-1">{r.reason}</div>}
                  {r.admin_comment && (
                    <div className="text-xs italic mt-1">Admin: {r.admin_comment}</div>
                  )}
                </div>
                {r.status === "pending" && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>
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
