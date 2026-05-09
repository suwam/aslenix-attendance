import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Pause, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_app/admin/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "suspended" | "all">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("approval_status", filter);
    const { data } = await q;
    setUsers(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: string, suspended = false) => {
    setBusy(id);
    const updates: any = { approval_status: status, is_suspended: suspended };
    const { error } = await supabase.from("profiles").update(updates).eq("id", id);
    setBusy(null);
    if (error) return toast.error(error.message);
    const u = users.find((x) => x.id === id);
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

  const filtered = users.filter((u) =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const FILTERS: Array<{ k: typeof filter; label: string }> = [
    { k: "pending", label: "Pending" }, { k: "approved", label: "Approved" }, { k: "rejected", label: "Rejected" }, { k: "suspended", label: "Suspended" }, { k: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader title="User Approvals" subtitle="Review, approve, suspend or reject user accounts" />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f.k ? "text-white" : "glass text-muted-foreground hover:text-foreground"}`}
              style={filter === f.k ? { background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">No users found.</GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <GlassCard>
                <div className="flex items-start gap-3">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/40" />
                  ) : (
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: "var(--gradient-brand)" }}>
                      {u.full_name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{u.department || "—"} · {u.position || "—"}</div>
                  </div>
                  <StatusBadge status={u.approval_status} suspended={u.is_suspended} />
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Joined {format(new Date(u.created_at), "MMM d, yyyy")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {u.approval_status !== "approved" && (
                    <Button size="sm" disabled={busy === u.id} onClick={() => updateStatus(u.id, "approved", false)} className="neon-button rounded-lg">
                      <Check size={14} className="mr-1" /> Approve
                    </Button>
                  )}
                  {u.approval_status !== "rejected" && (
                    <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => updateStatus(u.id, "rejected")}>
                      <X size={14} className="mr-1" /> Reject
                    </Button>
                  )}
                  {!u.is_suspended ? (
                    <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => updateStatus(u.id, u.approval_status, true)}>
                      <Pause size={14} className="mr-1" /> Suspend
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => updateStatus(u.id, "approved", false)}>
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busy === u.id} onClick={() => removeUser(u.id)} className="text-destructive hover:bg-destructive/15">
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

function StatusBadge({ status, suspended }: { status: string; suspended: boolean }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-destructive/15 text-destructive",
    suspended: "bg-muted text-muted-foreground",
  };
  const s = suspended ? "suspended" : status;
  return <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${map[s]}`}>{s}</span>;
}
