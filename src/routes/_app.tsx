import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { AslenixLogo } from "@/components/AslenixLogo";
import { Toaster } from "@/components/ui/sonner";

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
    else if (
      profile &&
      (profile.approval_status === "rejected" ||
        profile.approval_status === "suspended" ||
        profile.is_suspended)
    )
      nav({ to: "/account-locked" });
  }, [loading, user, profile, nav]);

  if (loading) {
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AslenixLogo size="lg" />
          <p className="text-sm text-muted-foreground">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div className="max-w-md rounded-3xl border border-border bg-background p-8 shadow-xl">
          <h1 className="text-xl font-semibold">Unable to load your profile</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            We could not load your account details. Please refresh the page or contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <AslenixLogo size="lg" />
          <p className="text-sm text-muted-foreground">Checking account approval status…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
      <Toaster position="top-right" richColors />
    </AppShell>
  );
}
