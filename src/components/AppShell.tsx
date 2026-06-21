import { ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Calendar,
  CalendarDays,
  FileBarChart2,
  BellDot,
  Settings,
  LogOut,
  ClipboardList,
  Clock,
  User as UserIcon,
  Menu,
  X,
  Bell,
  QrCode,
  CalendarClock,
  Crown,
  MessageSquare,
  Trophy,
  BrainCircuit,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AslenixLogo } from "@/components/AslenixLogo";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

type NotificationPreview = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/productivity", label: "AI Productivity", icon: BrainCircuit },
  { to: "/admin/employee-of-month", label: "Employee of Month", icon: Crown },
  { to: "/admin/weekly-feedback", label: "Weekly Feedback", icon: MessageSquare },
  { to: "/admin/achievements", label: "Achievements", icon: Trophy },
  { to: "/admin/approvals", label: "User Approvals", icon: UserCheck },
  { to: "/admin/attendance-corrections", label: "Attendance Corrections", icon: CalendarClock },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/qr-ids", label: "Digital QR IDs", icon: QrCode },
  { to: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/admin/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/admin/standups", label: "Daily Standups", icon: ClipboardList },
  { to: "/admin/attendance", label: "Attendance", icon: Clock },
  { to: "/admin/leaves", label: "Leave Requests", icon: Calendar },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/admin/notifications", label: "Notifications", icon: BellDot },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const empNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/tasks", label: "My Tasks", icon: ClipboardList },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/standup", label: "Daily Standup", icon: ClipboardList },
  { to: "/check-in", label: "Check-in", icon: Clock },
  { to: "/my-attendance", label: "My Attendance", icon: ClipboardList },
  { to: "/my-leaves", label: "My Leaves", icon: Calendar },
  { to: "/notifications", label: "Notifications", icon: BellDot },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationPreview[]>([]);

  const items = isAdmin ? adminNav : empNav;
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!profile) {
      setUnread(0);
      setRecentNotifications([]);
      return;
    }

    const refreshNotifications = () => {
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.user_id)
        .eq("is_read", false)
        .then(({ count }) => setUnread(count ?? 0));

      supabase
        .from("notifications")
        .select("id,title,message,is_read,created_at")
        .eq("user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data }) => setRecentNotifications((data ?? []) as NotificationPreview[]));
    };

    refreshNotifications();
    window.addEventListener("notifications:changed", refreshNotifications);

    const ch = supabase
      .channel("notif-" + profile.user_id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.user_id}`,
        },
        refreshNotifications,
      )
      .subscribe();
    return () => {
      window.removeEventListener("notifications:changed", refreshNotifications);
      supabase.removeChannel(ch);
    };
  }, [profile]);

  const markNotificationRead = async (id: string) => {
    setRecentNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    setUnread((current) => Math.max(0, current - 1));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    window.dispatchEvent(new Event("notifications:changed"));
  };

  const handleSignOut = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen min-h-0 p-4 gap-2 border-r border-sidebar-border"
        style={{ background: "var(--sidebar)", backdropFilter: "blur(20px)" }}
      >
        <div className="px-2 py-3">
          <AslenixLogo />
        </div>
        <nav className="flex-1 min-h-0 mt-4 space-y-1 overflow-y-auto pr-1">
          {items.map((item) => {
            const active =
              currentPath === item.to ||
              (item.to !== "/admin" && item.to !== "/dashboard" && currentPath.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${active ? "text-white" : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
              >
                {active && (
                  <div
                    className="absolute inset-0 rounded-xl -z-10"
                    style={{
                      background: "var(--gradient-brand)",
                      boxShadow: "var(--shadow-neon-red)",
                    }}
                  />
                )}
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <UserCard onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 min-h-0 p-4 flex flex-col gap-2 border-r border-sidebar-border"
            style={{ background: "var(--sidebar)" }}
          >
            <div className="flex items-center justify-between px-2 py-3">
              <AslenixLogo />
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-sidebar-accent"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 min-h-0 mt-2 space-y-1 overflow-y-auto overscroll-contain pr-1">
              {items.map((item) => {
                const active = currentPath === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active ? "text-white" : "text-sidebar-foreground/75 hover:bg-sidebar-accent"}`}
                    style={active ? { background: "var(--gradient-brand)" } : undefined}
                  >
                    <Icon size={18} /> {item.label}
                  </Link>
                );
              })}
            </nav>
            <UserCard onSignOut={handleSignOut} />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="sticky top-0 z-30 h-16 px-4 sm:px-6 flex items-center gap-3 border-b border-border"
          style={{
            background: "color-mix(in oklab, var(--background) 75%, transparent)",
            backdropFilter: "blur(20px)",
          }}
        >
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <div className="attendance-wordmark text-lg font-black uppercase leading-none sm:text-2xl">
              Attendance
            </div>
          </div>
          <div className="flex-1" />
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="relative p-2 rounded-lg hover:bg-muted" aria-label="Open notifications">
                <Bell size={18} />
                {unread > 0 && (
                  <span
                    className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border-white/10 bg-background/95 p-0 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
            >
              <div className="border-b border-white/10 bg-white/[0.035] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Notifications</div>
                    <div className="text-xs text-muted-foreground">
                      {unread ? `${unread} unread update${unread === 1 ? "" : "s"}` : "You're all caught up"}
                    </div>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-100">
                    Live
                  </span>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 [scrollbar-color:rgba(103,232,249,0.35)_rgba(255,255,255,0.06)] [scrollbar-width:thin]">
                {recentNotifications.length ? (
                  <div className="space-y-2">
                    {recentNotifications.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 transition-colors ${
                          item.is_read
                            ? "border-white/8 bg-white/[0.025] opacity-75"
                            : "border-white/14 bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.18)]">
                            <BellDot size={16} />
                            {!item.is_read && (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-background bg-cyan-300" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-bold text-white/90">{item.title}</div>
                              <time className="shrink-0 text-[10px] font-semibold text-white/42">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                              </time>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.message}</p>
                            {!item.is_read && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(item.id)}
                                className="mt-2 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[11px] font-semibold text-white/62 transition-colors hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                              >
                                Mark Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center">
                    <BellDot className="mx-auto mb-3 text-cyan-200" size={24} />
                    <div className="text-sm font-semibold text-white">No notifications</div>
                    <div className="mt-1 text-xs text-muted-foreground">New updates will appear here.</div>
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 p-2">
                <Link
                  to={isAdmin ? "/admin/notifications" : "/notifications"}
                  className="block rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-center text-sm font-semibold text-white/78 transition-colors hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
                >
                  View all notifications
                </Link>
              </div>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-3 pl-2 border-l border-border">
            <div className="hidden sm:block text-right leading-tight">
              <div className="text-sm font-medium truncate max-w-[160px]">{profile?.full_name}</div>
              <div className="text-[11px] text-muted-foreground capitalize">
                {isAdmin ? "Administrator" : "Employee"}
              </div>
            </div>
            <Avatar profile={profile} />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <div key={currentPath}>{children}</div>
        </main>
      </div>
    </div>
  );
}

function UserCard({ onSignOut }: { onSignOut: () => void }) {
  const { profile, isAdmin } = useAuth();
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3">
      <Avatar profile={profile} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{profile?.full_name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {isAdmin ? "Administrator" : profile?.position || "Employee"}
        </div>
      </div>
      <button
        onClick={onSignOut}
        className="p-2 rounded-lg hover:bg-destructive/15 hover:text-destructive transition-colors"
        aria-label="Sign out"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

function Avatar({ profile }: { profile: any }) {
  const initials = (profile?.full_name || "U")
    .split(" ")
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt=""
      className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/40"
    />
  ) : (
    <div
      className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}
