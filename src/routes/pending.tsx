import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/pending")({ component: Page });

function Page() {
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <AuthShell title="Awaiting approval" subtitle="Your account is in review">
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ background: "var(--gradient-brand-soft)" }}>
          <Clock className="text-primary animate-pulse-glow" size={36} />
        </div>
        <p className="text-center text-muted-foreground text-sm leading-relaxed">
          Your account is waiting for admin approval. You'll get access once an administrator reviews your registration.
        </p>
        <Button variant="ghost" onClick={async () => { await signOut(); nav({ to: "/login" }); }}>
          <LogOut size={16} className="mr-2" /> Sign out
        </Button>
      </div>
    </AuthShell>
  );
}
