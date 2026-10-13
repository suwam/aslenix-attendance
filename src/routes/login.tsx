import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const id = identifier.trim();
    let loginEmail = id;
    if (!id.includes("@")) {
      const lower = id.toLowerCase();
      if (
        ["alenix-admin", "aslenix-admin", "admin", "alenix_admin", "aslenix_admin"].includes(lower)
      ) {
        loginEmail = "info.aslenix.np@gmail.com";
      } else {
        const { data: resolvedEmail } = await supabase.rpc("get_login_email", {
          p_identifier: id,
        });
        if (resolvedEmail) {
          loginEmail = resolvedEmail;
        }
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    nav({ to: "/" });
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your ASLENIX workspace"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Username or Email</Label>
          <Input
            id="identifier"
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Alenix-ADMIN or you@company.com"
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle password visibility"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full neon-button rounded-xl h-11 font-medium"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
