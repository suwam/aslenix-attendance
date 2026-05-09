import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/leaves")({ component: LeavesPage });

function LeavesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("leave_requests").select("*, profiles!inner(full_name, email, avatar_url, department)").order("created_at", { ascending: false });
    if (tab !== "all") q = q.eq("status", tab);
    // Note: profiles!inner won't work without FK. Fallback to manual join.
    const { data: leaves } = await supabase.from("leave_requests").select("*").order("created_at", { ascending: false });
    let filtered = leaves ?? [];
    if (tab !== "all") filtered = filtered.filter((l) => l.status === tab);
    const ids = [...new Set(filtered.map((l) => l.user_id))];
    const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email, avatar_url, department").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
    setRows(filtered.map((l) => ({ ...l, profile: map.get(l.user_id) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab]);

  const decide = async (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    const row = rows.find((r) => r.id === id);
    const { error } = await supabase.from("leave_requests").update({ status, admin_comment: comments[id] || null, reviewed_by: user?.id }).eq("id", id);
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
    { k: "pending", label: "Pending" }, { k: "approved", label: "Approved" }, { k: "rejected", label: "Rejected" }, { k: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader title="Leave Requests" subtitle="Review and approve employee time-off requests" />

      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.k ? "text-white" : "glass text-muted-foreground hover:text-foreground"}`}
            style={tab === t.k ? { background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" } : undefined}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">No leave requests.</GlassCard>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <GlassCard key={r.id}>
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <div className="h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: "var(--gradient-brand)" }}>
                      {r.profile?.full_name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{r.profile?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{r.profile?.department} · {r.profile?.email}</div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium capitalize" style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}>{r.leave_type.replace("_", " ")}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(r.start_date), "MMM d")} → {format(new Date(r.end_date), "MMM d, yyyy")}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${r.status === "approved" ? "bg-success/15 text-success" : r.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{r.status}</span>
                    </div>
                    {r.reason && <div className="mt-2 text-sm text-muted-foreground">{r.reason}</div>}
                    {r.admin_comment && <div className="mt-2 text-xs italic">Admin: {r.admin_comment}</div>}
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex flex-col gap-2 lg:w-72">
                    <Textarea placeholder="Add a comment (optional)" value={comments[r.id] || ""} onChange={(e) => setComments((c) => ({ ...c, [r.id]: e.target.value }))} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, "approved")} className="neon-button rounded-lg flex-1"><Check size={14} className="mr-1" />Approve</Button>
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => decide(r.id, "rejected")} className="flex-1"><X size={14} className="mr-1" />Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}
