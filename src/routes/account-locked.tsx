import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/account-locked")({ component: Page });

function Page() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const status = profile?.is_suspended ? "suspended" : (profile?.approval_status ?? "locked");
  return (
    <AuthShell title="Account locked" subtitle={`Your account is ${status}`}>
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="h-20 w-20 rounded-full flex items-center justify-center bg-destructive/15">
          <ShieldAlert className="text-destructive" size={36} />
        </div>
        <p className="text-center text-muted-foreground text-sm leading-relaxed">
          Please contact your administrator to restore access.
        </p>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut();
            nav({ to: "/login" });
          }}
        >
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
