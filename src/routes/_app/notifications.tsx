import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  BellDot,
  CheckCheck,
  Clock,
  Inbox,
  Loader2,
  MailCheck,
} from "lucide-react";
import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/notifications")({ component: NotifPage });

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

function NotifPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as NotificationRow[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`employee-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as NotificationRow;
          setRows((current) =>
            current.some((row) => row.id === notification.id)
              ? current
              : [notification, ...current],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const markOneRead = async (notification: NotificationRow) => {
    if (!user) return;
    setRows((current) =>
      current.map((row) => (row.id === notification.id ? { ...row, is_read: true } : row)),
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
  };

  const unreadCount = rows.filter((row) => !row.is_read).length;
  const readCount = rows.length - unreadCount;
  const latest = rows[0];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Your alerts and updates"
        actions={
          <Button onClick={markAll} variant="outline" className="h-11 rounded-xl">
            <CheckCheck size={14} className="mr-1" />
            Mark all read
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NotificationMetric label="Unread" value={unreadCount} icon={BellDot} tone="red" />
        <NotificationMetric label="Read" value={readCount} icon={MailCheck} tone="green" />
        <NotificationMetric
          label="Latest"
          value={latest ? `${formatNepaliDate(latest.created_at, "DD MMM")} BS` : "None"}
          icon={Clock}
          tone="blue"
        />
      </section>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <GlassCard className="border-white/10 bg-white/[0.025] py-16 text-center text-muted-foreground">
          <Inbox size={28} className="mx-auto mb-3 text-primary" />
          You're all caught up.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {rows.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.is_read && markOneRead(n)}
              className="text-left"
            >
              <GlassCard
                className={`group flex flex-col gap-4 border-white/10 bg-white/[0.025] transition hover:border-primary/25 hover:bg-white/[0.04] sm:flex-row sm:items-start ${
                  !n.is_read ? "ring-1 ring-primary/30" : "opacity-80"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <BellDot size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-white sm:text-lg">{n.title}</h2>
                        {!n.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse-glow" />
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground sm:text-base">
                        {n.message}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        n.is_read
                          ? "border-white/10 bg-white/[0.04] text-muted-foreground"
                          : "border-primary/20 bg-primary/10 text-primary"
                      }`}
                    >
                      {n.is_read ? "Read" : "New"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Clock size={13} />
                    {formatNepaliDate(n.created_at, "DD MMM YYYY")} BS, {format(new Date(n.created_at), "HH:mm")}
                    {!n.is_read && <span className="text-primary">Tap to mark as read</span>}
                  </div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function NotificationMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof BellDot;
  tone: "red" | "green" | "blue";
}) {
  const colors = {
    red: "border-primary/20 bg-primary/10 text-primary",
    green: "border-success/20 bg-success/10 text-success",
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-300",
  };

  return (
    <GlassCard className="border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}
