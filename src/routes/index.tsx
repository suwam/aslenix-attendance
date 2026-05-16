import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AslenixLogo } from "@/components/AslenixLogo";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, user, isAdmin, isApproved, profile } = useAuth();

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
  if (!user) return <Navigate to="/login" />;
  if (!profile) {
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
  if (profile.approval_status === "pending") return <Navigate to="/pending" />;
  if (
    profile.approval_status === "rejected" ||
    profile.approval_status === "suspended" ||
    profile.is_suspended
  )
    return <Navigate to="/account-locked" />;
  if (!isApproved) return <Navigate to="/pending" />;
  return <Navigate to={isAdmin ? "/admin" : "/dashboard"} />;
}