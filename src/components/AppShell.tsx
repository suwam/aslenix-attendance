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
  Laptop,
  ShieldCheck,
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
  { to: "/admin/achievements", label: "Achievements", icon: Trophy },
  { to: "/admin/productivity", label: "AI Productivity", icon: BrainCircuit },
  { to: "/admin/attendance", label: "Attendance", icon: Clock },
  { to: "/admin/attendance-corrections", label: "Attendance Corrections", icon: CalendarClock },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/standups", label: "Daily Standups", icon: ClipboardList },
  { to: "/admin/weekly-reports", label: "Weekly Reports", icon: FileBarChart2 },
  { to: "/admin/devices", label: "Registered Devices", icon: Laptop },
  { to: "/admin/qr-ids", label: "Digital QR IDs", icon: QrCode },
  { to: "/admin/employee-of-month", label: "Employee of Month", icon: Crown },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/leaves", label: "Leave Requests", icon: Calendar },
  { to: "/admin/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/notifications", label: "Notifications", icon: BellDot },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart2 },
  { to: "/admin/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/admin/approvals", label: "User Approvals", icon: UserCheck },
  { to: "/admin/weekly-feedback", label: "Weekly Feedback", icon: MessageSquare },
];

const empNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/check-in", label: "Check-in", icon: Clock },
  { to: "/standup", label: "Daily Standup", icon: ClipboardList },
  { to: "/weekly-reports", label: "Weekly Reports", icon: FileBarChart2 },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/my-attendance", label: "My Attendance", icon: ClipboardList },
  { to: "/my-leaves", label: "My Leaves", icon: Calendar },
  { to: "/tasks", label: "My Tasks", icon: ClipboardList },
  { to: "/notifications", label: "Notifications", icon: BellDot },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationPreview[]>([]);

  const items = isAdmin ? adminNav : empNav;
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!profile) {
      setUnread(0);
      setRecentNotifications([]);
      setMessageUnread(0);
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

    const refreshMessages = () => {
      (supabase as any)
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("sender_is_admin", !isAdmin)
        .is("read_at", null)
        .then(({ count, error }: { count: number | null; error: unknown }) => {
          if (!error) setMessageUnread(count ?? 0);
        });
    };

    refreshNotifications();
    refreshMessages();
    window.addEventListener("notifications:changed", refreshNotifications);
    window.addEventListener("messages:changed", refreshMessages);

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
    const chatCh = supabase
      .channel("chat-nav-" + profile.user_id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
        },
        refreshMessages,
      )
      .subscribe();
    return () => {
      window.removeEventListener("notifications:changed", refreshNotifications);
      window.removeEventListener("messages:changed", refreshMessages);
      supabase.removeChannel(ch);
      supabase.removeChannel(chatCh);
    };
  }, [isAdmin, profile]);

  const markNotificationRead = async (id: string) => {
    setRecentNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    setUnread((current) => Math.max(0, current - 1));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    window.dispatchEvent(new Event("notifications:changed"));
  };

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleSignOut = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await signOut();
      nav({ to: "/login" });
    }
  };

  const isMessagesPage = currentPath === "/messages";

  return (
    <div className={`min-h-screen flex ${isMessagesPage ? "h-screen overflow-hidden" : ""}`}>
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
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${active ? "text-foreground" : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent"}`}
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
                {item.to === "/messages" && messageUnread > 0 && (
                  <span
                    className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-foreground"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {messageUnread > 99 ? "99+" : messageUnread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-card"
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
                const active =
                  currentPath === item.to ||
                  (item.to !== "/admin" && item.to !== "/dashboard" && currentPath.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${active ? "text-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent"}`}
                    style={active ? { background: "var(--gradient-brand)" } : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {item.to === "/messages" && messageUnread > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[10px] font-black text-foreground">
                        {messageUnread > 99 ? "99+" : messageUnread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Main */}
      <div className={`flex-1 flex flex-col min-w-0 ${isMessagesPage ? "h-full overflow-hidden" : ""}`}>
        <header
          className="sticky top-0 z-30 h-16 px-4 sm:px-6 flex items-center gap-3 bg-background"
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
                    className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-foreground"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border-border bg-background/95 p-0 shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
            >
              <div className="border-b border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-foreground">Notifications</div>
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
                            ? "border-border bg-card opacity-75"
                            : "border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
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
                              <div className="truncate text-sm font-bold text-muted-foreground">{item.title}</div>
                              <time className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                              </time>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.message}</p>
                            {!item.is_read && (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(item.id)}
                                className="mt-2 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
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
                    <div className="text-sm font-semibold text-foreground">No notifications</div>
                    <div className="mt-1 text-xs text-muted-foreground">New updates will appear here.</div>
                  </div>
                )}
              </div>
              <div className="border-t border-border p-2">
                <Link
                  to={isAdmin ? "/admin/notifications" : "/notifications"}
                  className="block rounded-xl border border-border bg-card px-3 py-2 text-center text-sm font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-card hover:text-foreground"
                >
                  View all notifications
                </Link>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={profileDropdownOpen} onOpenChange={setProfileDropdownOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-3 pl-4 border-l border-border hover:opacity-80 transition-opacity focus:outline-none">
                <div className="hidden sm:block text-right leading-tight">
                  <div className="text-sm font-medium truncate max-w-[160px]">{profile?.full_name}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {isAdmin ? "Administrator" : profile?.position || "Employee"}
                  </div>
                </div>
                <Avatar profile={profile} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2 rounded-xl shadow-lg border-border bg-card">
              <div className="flex flex-col gap-1">
                <div className="px-2 py-1.5 mb-1 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{isAdmin ? "Administrator" : profile?.position || "Employee"}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <UserIcon size={16} className="text-muted-foreground" />
                  Profile
                </Link>
                <Link
                  to={isAdmin ? "/admin/settings" : "/settings"}
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <Settings size={16} className="text-muted-foreground" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-2 px-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors w-full text-left"
                >
                  <LogOut size={16} className="text-destructive" />
                  Logout
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </header>

        <main className={`flex-1 max-w-[1600px] w-full mx-auto ${isMessagesPage ? "p-0 sm:p-0 lg:p-0 h-full min-h-0 overflow-hidden flex flex-col" : "p-4 sm:p-6 lg:p-8"}`}>
          <div key={currentPath} className={isMessagesPage ? "flex-1 min-h-0 h-full flex flex-col" : ""}>{children}</div>
        </main>

        {!isAdmin && currentPath !== "/messages" && (
          <Link
            to="/messages"
            className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-r from-[#C4DAFF] to-[#E5CCFF] text-[#0F172A] shadow-md ring-1 ring-[#E2E8F0]/50 transition hover:-translate-y-1 hover:scale-105 sm:bottom-6 sm:right-6"
            style={{ animation: "message-float 3.2s ease-in-out infinite" }}
            aria-label="Open messages"
          >
            <MessageSquare size={24} />
            {messageUnread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-background bg-pink-500 px-1 text-[11px] font-black text-foreground shadow-lg">
                {messageUnread > 99 ? "99+" : messageUnread}
              </span>
            )}
          </Link>
        )}
      </div>
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
      className="h-9 w-9 rounded-full flex items-center justify-center text-foreground text-sm font-semibold"
      style={{ background: "var(--gradient-brand)" }}
    >
      {initials}
    </div>
  );
}
