import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: Page });

function Page() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

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
