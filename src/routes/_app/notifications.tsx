import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { BellDot, CheckCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({ component: NotifPage });

function NotifPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    toast.success("Marked all as read");
    load();
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Your alerts and updates"
        actions={
          <Button onClick={markAll} variant="outline">
            <CheckCheck size={14} className="mr-1" />
            Mark all read
          </Button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          You're all caught up.
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <GlassCard
              key={n.id}
              className={`flex items-start gap-4 ${!n.is_read ? "ring-1 ring-primary/40" : "opacity-75"}`}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--gradient-brand-soft)" }}
              >
                <BellDot size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{n.title}</div>
                  {!n.is_read && (
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">{n.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(n.created_at), "MMM d, yyyy HH:mm")}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}
