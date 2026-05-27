import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({ component: Page });

function Page() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Reset link sent");
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? "Check your inbox for a reset link" : "We'll email you a secure link"}
      footer={
        <>
          <Link to="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {!sent && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full neon-button rounded-xl h-11">
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

function getPasswordResetRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_APP_URL || import.meta.env.VITE_SITE_URL;
  const origin = configuredUrl || window.location.origin;
  const devOrigin =
    origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000"
      ? "http://localhost:5173"
      : origin;
  return `${devOrigin.replace(/\/$/, "")}/reset-password`;
}
