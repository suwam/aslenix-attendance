import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const nav = useNavigate();
  const initialEmail =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    const cleanCode = code.trim();
    if (!cleanEmail) return toast.error("Enter your email");
    if (!cleanCode) return toast.error("Enter the reset code");
    if (pw.length < 6) return toast.error("Password must be 6+ chars");
    if (pw !== confirm) return toast.error("Passwords don't match");

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: "recovery",
    });

    if (verifyError) {
      setLoading(false);
      return toast.error(formatRecoveryError(verifyError.message));
    }

    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav({ to: "/login" });
  };

  return (
    <AuthShell
      title="Set new password"
      subtitle="Enter the reset code from your email before it expires"
      footer={
        <Link to="/forgot-password" className="text-primary font-medium hover:underline">
          Request a new code
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label>Reset code</Label>
          <Input
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
          />
        </div>
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

function formatRecoveryError(description: string) {
  const decoded = description.replace(/\+/g, " ");
  if (decoded.toLowerCase().includes("expired")) {
    return "This reset code is invalid or has expired. Please request a new password reset email.";
  }
  return decoded;
}
