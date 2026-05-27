import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkError, setLinkError] = useState("");

  useEffect(() => {
    const prepareRecoverySession = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription =
        params.get("error_description") || hashParams.get("error_description");
      const errorCode = params.get("error_code") || hashParams.get("error_code");

      if (errorDescription) {
        setLinkError(formatRecoveryError(errorDescription, errorCode));
        setCheckingLink(false);
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) setLinkError(error.message);
      }

      setCheckingLink(false);
    };

    prepareRecoverySession();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be 6+ chars");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav({ to: "/login" });
  };

  if (checkingLink) {
    return (
      <AuthShell title="Checking reset link" subtitle="Preparing your password reset session">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthShell>
    );
  }

  if (linkError) {
    return (
      <AuthShell
        title="Reset link expired"
        subtitle="Please request a fresh password reset email"
        footer={
          <Link to="/login" className="text-primary font-medium hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle size={18} className="mb-2" />
          {linkError}
        </div>
        <Link to="/forgot-password">
          <Button className="mt-4 w-full neon-button rounded-xl h-11">
            Send a new reset link
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set new password" subtitle="Choose a strong password">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>New password</Label>
          <Input
            type="password"
            required
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Confirm</Label>
          <Input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full neon-button rounded-xl h-11">
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}

function formatRecoveryError(description: string, code?: string | null) {
  const decoded = description.replace(/\+/g, " ");
  if (code === "otp_expired" || decoded.toLowerCase().includes("expired")) {
    return "This reset link is invalid or has expired. Please request a new password reset email.";
  }
  return decoded;
}
