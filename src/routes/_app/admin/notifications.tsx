import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BellDot,
  CheckCheck,
  CheckCircle2,
  Clock,
  FilePenLine,
  Inbox,
  ListChecks,
  Loader2,
  Megaphone,
  Plane,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/notifications")({ component: NotifPage });

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string | null;
  is_read: boolean;
  created_at: string;
};

type NotificationKind =
  | "attendance"
  | "attendance_correction"
  | "task"
  | "task_completed"
  | "leave"
  | "employee"
  | "announcement"
  | "system";

function NotifPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);

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

  const markAll = async () => {
    if (!user) return;
    setRows((current) => current.map((row) => ({ ...row, is_read: true })));
    setSelectedNotification((current) => (current ? { ...current, is_read: true } : current));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    notifyUnreadCountChanged();
    toast.success("All marked as read");
    load();
  };

  const markOneRead = async (notification: NotificationRow) => {
    setRows((current) =>
      current.map((row) => (row.id === notification.id ? { ...row, is_read: true } : row)),
    );
    setSelectedNotification((current) =>
      current?.id === notification.id ? { ...current, is_read: true } : current,
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
    notifyUnreadCountChanged();
  };

  const unreadCount = rows.filter((row) => !row.is_read).length;
  const readCount = rows.length - unreadCount;
  const latest = rows[0];

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="System alerts and updates"
        actions={
          <Button onClick={markAll} variant="outline" className="h-11 rounded-xl">
            <CheckCheck size={14} className="mr-1" />
            Mark all read
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NotificationMetric label="Unread" value={unreadCount} icon={BellDot} tone="red" />
        <NotificationMetric label="Read" value={readCount} icon={CheckCircle2} tone="green" />
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
        <GlassCard className="border-border bg-card py-16 text-center text-muted-foreground">
          <Inbox size={28} className="mx-auto mb-3 text-primary" />
          No notifications.
        </GlassCard>
      ) : (
        <div className="max-h-[calc(100dvh-18rem)] overflow-y-auto pr-2 [scrollbar-color:rgba(103,232,249,0.35)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
          <ul className="relative space-y-3 before:absolute before:left-[1.18rem] before:top-4 before:h-[calc(100%-2rem)] before:w-px before:bg-gradient-to-b before:from-cyan-300/30 before:via-[#f1f0ee]/10 before:to-transparent">
            {rows.map((notification) => (
              <NotificationTimelineItem
                key={notification.id}
                notification={notification}
                onViewDetails={(row) => {
                  if (!row.is_read) markOneRead(row);
                  setSelectedNotification({ ...row, is_read: true });
                }}
                onMarkRead={markOneRead}
              />
            ))}
          </ul>
        </div>
      )}

      <NotificationDetailDialog
        notification={selectedNotification}
        onOpenChange={(open) => {
          if (!open) setSelectedNotification(null);
        }}
      />
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
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  };

  return (
    <GlassCard className="border-border bg-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

const NOTIFICATION_META: Record<NotificationKind, {
  icon: typeof BellDot;
  color: string;
  bg: string;
  label: string;
}> = {
  attendance: {
    icon: ShieldCheck,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    label: "Attendance",
  },
  attendance_correction: {
    icon: FilePenLine,
    color: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    label: "Attendance",
  },
  task: {
    icon: ListChecks,
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    label: "Task",
  },
  task_completed: {
    icon: CheckCircle2,
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    label: "Task",
  },
  leave: {
    icon: Plane,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
    label: "Leave",
  },
  employee: {
    icon: UserPlus,
    color: "#22d3ee",
    bg: "rgba(34,211,238,0.12)",
    label: "Employee",
  },
  announcement: {
    icon: Megaphone,
    color: "#facc15",
    bg: "rgba(250,204,21,0.12)",
    label: "Announcement",
  },
  system: {
    icon: BellDot,
    color: "#94a3b8",
    bg: "rgba(148,163,184,0.12)",
    label: "System",
  },
};

function NotificationTimelineItem({
  notification,
  onViewDetails,
  onMarkRead,
}: {
  notification: NotificationRow;
  onViewDetails: (notification: NotificationRow) => void;
  onMarkRead: (notification: NotificationRow) => void;
}) {
  const kind = detectNotificationKind(notification);
  const meta = NOTIFICATION_META[kind];
  const Icon = meta.icon;
  const absoluteTime = `${formatNepaliDate(notification.created_at, "DD MMM YYYY")} BS, ${format(new Date(notification.created_at), "HH:mm")}`;
  const relativeTime = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <li
      className={`group relative flex gap-4 rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-card ${
        !notification.is_read
          ? "border-border bg-card shadow-[0_0_30px_rgba(103,232,249,0.08),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-border bg-card opacity-80"
      }`}
    >
      <div className="relative z-10 flex shrink-0 flex-col items-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border shadow-[0_0_18px_currentColor]"
          style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}42` }}
          aria-hidden="true"
        >
          <Icon size={17} />
        </div>
        {!notification.is_read && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#0b1020] bg-cyan-300" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}38` }}
              >
                {meta.label}
              </span>
              {!notification.is_read && (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                  New
                </span>
              )}
            </div>
            <h2 className="truncate text-sm font-bold text-muted-foreground">{notification.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</p>
          </div>
          <time
            dateTime={notification.created_at}
            title={absoluteTime}
            className="whitespace-nowrap text-xs font-semibold text-muted-foreground"
          >
            {relativeTime}
          </time>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <NotificationAction label="View Details" onClick={() => onViewDetails(notification)} />
          {!notification.is_read && (
            <NotificationAction label="Mark Read" onClick={() => onMarkRead(notification)} />
          )}
        </div>
      </div>
    </li>
  );
}

function NotificationAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
    >
      {label}
    </button>
  );
}

function NotificationDetailDialog({
  notification,
  onOpenChange,
}: {
  notification: NotificationRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const kind = notification ? detectNotificationKind(notification) : "system";
  const meta = NOTIFICATION_META[kind];
  const Icon = meta.icon;
  const createdAt = notification
    ? `${formatNepaliDate(notification.created_at, "DD MMM YYYY")} BS, ${format(new Date(notification.created_at), "HH:mm")}`
    : "";

  return (
    <Dialog open={Boolean(notification)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden border-border bg-background/95 p-0 sm:max-w-xl">
        {notification && (
          <div className="relative">
            <div
              className="absolute inset-x-0 top-0 h-28 opacity-20"
              style={{ background: `linear-gradient(135deg, ${meta.color}, transparent 68%)` }}
            />
            <div className="relative p-6">
              <DialogHeader className="text-left">
                <div className="mb-4 flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-[0_0_22px_currentColor]"
                    style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}42` }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: meta.color, backgroundColor: meta.bg, borderColor: `${meta.color}38` }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                          notification.is_read
                            ? "border-border bg-card text-muted-foreground"
                            : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                        }`}
                      >
                        {notification.is_read ? "Read" : "New"}
                      </span>
                    </div>
                    <DialogTitle className="mt-2 text-xl font-bold text-foreground">{notification.title}</DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-muted-foreground">
                      {createdAt}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Details</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {notification.message || "No extra details were provided."}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NotificationDetailField label="Status" value={notification.is_read ? "Read" : "New"} />
                  <NotificationDetailField label="Category" value={meta.label} />
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotificationDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">{value}</div>
    </div>
  );
}

function detectNotificationKind(notification: NotificationRow): NotificationKind {
  const text = `${notification.type || ""} ${notification.title || ""} ${notification.message || ""}`.toLowerCase();
  if (text.includes("correction")) return "attendance_correction";
  if (text.includes("attendance") || text.includes("check-in") || text.includes("checkout")) return "attendance";
  if (text.includes("completed") && text.includes("task")) return "task_completed";
  if (text.includes("task") || text.includes("review")) return "task";
  if (text.includes("leave")) return "leave";
  if (text.includes("employee") || text.includes("profile")) return "employee";
  if (text.includes("announcement") || text.includes("notice") || text.includes("meeting")) return "announcement";
  return "system";
}

function notifyUnreadCountChanged() {
  window.dispatchEvent(new Event("notifications:changed"));
}
