import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AslenixLogo } from "@/components/AslenixLogo";

export const Route = createFileRoute("/_app")({
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const { loading, user, profile, isApproved } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/login" });
    else if (profile && profile.approval_status === "pending") nav({ to: "/pending" });
    else if (profile && (profile.approval_status === "rejected" || profile.approval_status === "suspended" || profile.is_suspended)) nav({ to: "/account-locked" });
  }, [loading, user, profile, nav]);

  if (loading || !user || !profile || !isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AslenixLogo size="lg" />
          <div className="h-1 w-40 rounded-full overflow-hidden bg-muted/40">
            <div className="h-full w-1/2 shimmer" style={{ background: "var(--gradient-brand)" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
