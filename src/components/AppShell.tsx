import { ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Calendar,
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
  Search,
  QrCode,
  CalendarClock,
  Crown,
  MessageSquare,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AslenixLogo } from "@/components/AslenixLogo";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/employee-of-month", label: "Employee of Month", icon: Crown },
  { to: "/admin/weekly-feedback", label: "Weekly Feedback", icon: MessageSquare },
  { to: "/admin/achievements", label: "Achievements", icon: Trophy },
  { to: "/admin/approvals", label: "User Approvals", icon: UserCheck },
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
  { to: "/achievements", label: "Achievements", icon: Trophy },
  { to: "/tasks", label: "My Tasks", icon: ClipboardList },
  { to: "/meetings", label: "Meetings", icon: CalendarClock },
  { to: "/standup", label: "Daily Standup", icon: ClipboardList },
  { to: "/check-in", label: "Check-in", icon: Clock },
  { to: "/my-attendance", label: "My Attendance", icon: ClipboardList },
  { to: "/my-leaves", label: "My Leaves", icon: Calendar },
  { to: "/notifications", label: "Notifications", icon: BellDot },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const items = isAdmin ? adminNav : empNav;
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.user_id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
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
        () => {
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", profile.user_id)
            .eq("is_read", false)
            .then(({ count }) => setUnread(count ?? 0));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 sticky top-0 h-screen p-4 gap-2 border-r border-sidebar-border"
        style={{ background: "var(--sidebar)", backdropFilter: "blur(20px)" }}
      >
        <div className="px-2 py-3">
          <AslenixLogo />
        </div>
        <nav className="flex-1 mt-4 space-y-1">
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
            className="lg:hidden fixed left-0 top-0 bottom-0 w-72 z-50 p-4 flex flex-col gap-2 border-r border-sidebar-border"
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
            <nav className="flex-1 mt-2 space-y-1">
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
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <Search size={16} />
            <span className="hidden md:inline">Quick search…</span>
          </div>
          <div className="flex-1" />
          <Link
            to={isAdmin ? "/admin/notifications" : "/notifications"}
            className="relative p-2 rounded-lg hover:bg-muted"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span
                className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
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
