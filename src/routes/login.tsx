import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import { ThreeDGlobeCanvas } from "@/components/ThreeDGlobeCanvas";
import { ThreeDTiltCard } from "@/components/ThreeDTiltCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  QrCode,
  Utensils,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Activity,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* =========================================================
          LEFT PANEL: Interactive 3D Showcase & Branding (Desktop)
          ========================================================= */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[53%] relative flex-col justify-between p-10 xl:p-14 bg-[#080C16] text-white overflow-hidden border-r border-border/10 shrink-0">
        {/* Ambient Glowing Background Orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 h-[460px] w-[460px] rounded-full blur-[140px] opacity-35"
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-24 h-[460px] w-[460px] rounded-full blur-[140px] opacity-30"
          style={{ background: "linear-gradient(135deg, #e11d48 0%, #9333ea 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 h-[340px] w-[340px] rounded-full blur-[120px] opacity-25"
          style={{ background: "#6366f1" }}
        />

        {/* 3D Cyber Perspective Floor Grid (Bottom half) */}
        <div
          aria-hidden
          className="cyber-3d-grid pointer-events-none absolute bottom-0 left-0 right-0 h-[380px] opacity-40 z-0"
        />

        {/* Top Header Row */}
        <div className="relative z-20 flex items-center justify-between">
          <AslenixLogo inverted size="md" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Online</span>
          </div>
        </div>

        {/* Center 3D Interactive Globe & Content Canvas */}
        <div className="relative z-20 my-auto py-6 xl:py-8 space-y-7 max-w-xl">
          {/* Eyebrow & Hero Header */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full backdrop-blur-md">
              <Sparkles size={13} className="text-indigo-400" />
              <span>Interactive 3D Workspace Suite</span>
            </div>
            <h1 className="text-3xl xl:text-4xl 2xl:text-[44px] font-extrabold tracking-tight leading-[1.16] text-white">
              Smart Attendance, Canteen &amp; Real-Time Team Intelligence.
            </h1>
            <p className="text-sm xl:text-base text-neutral-300/85 leading-relaxed">
              Unified workspace solution built for ASLENIX employees and administrators. Move your mouse to explore the real-time 3D interactive particle network.
            </p>
          </div>

          {/* Interactive 3D Canvas Stage with Floating Holographic Badges */}
          <div className="relative w-full h-[260px] xl:h-[300px] flex items-center justify-center my-2 select-none">
            {/* The 3D Interactive Particle Globe */}
            <ThreeDGlobeCanvas
              className="absolute inset-0 z-10"
              radius={140}
              nodeCount={175}
              primaryColor="#6366f1"
              secondaryColor="#ec4899"
              accentColor="#38bdf8"
            />

            {/* Floating Holographic Badge 1 (Top Left) */}
            <div className="animate-float-slow absolute top-3 left-2 xl:left-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/85 border border-indigo-500/30 backdrop-blur-md shadow-lg shadow-indigo-500/10">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Zap size={13} />
              </div>
              <div className="text-left leading-tight">
                <span className="block text-[11px] font-bold text-white">Sub-Second Scan</span>
                <span className="block text-[9px] text-indigo-300 font-medium">99.9% Geo-Accuracy</span>
              </div>
            </div>

            {/* Floating Holographic Badge 2 (Bottom Right) */}
            <div className="animate-float-reverse absolute bottom-3 right-2 xl:right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/85 border border-rose-500/30 backdrop-blur-md shadow-lg shadow-rose-500/10">
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                <Utensils size={13} />
              </div>
              <div className="text-left leading-tight">
                <span className="block text-[11px] font-bold text-white">Smart Canteen BS</span>
                <span className="block text-[9px] text-rose-300 font-medium">Auto-Synced Meals</span>
              </div>
            </div>

            {/* Floating Holographic Badge 3 (Top Right) */}
            <div className="animate-float-slow absolute top-4 right-3 z-20 hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 backdrop-blur-md shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold text-emerald-300">Live Device Mesh</span>
            </div>
          </div>

          {/* Interactive Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Feature 1 */}
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.08] hover:border-indigo-400/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                  <QrCode size={15} />
                </div>
                <span className="text-xs font-bold text-white">QR Pass</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-snug">
                Contactless scan with anti-spoofing security.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.08] hover:border-rose-400/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                  <Utensils size={15} />
                </div>
                <span className="text-xs font-bold text-white">Canteen BS</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-snug">
                Bikram Sambat logs &amp; one-click PDF export.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.08] hover:border-emerald-400/30 transition-all duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <ShieldCheck size={15} />
                </div>
                <span className="text-xs font-bold text-white">Multi-Role</span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-snug">
                Role governance, leaves &amp; audit history.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Metrics & Copyright */}
        <div className="relative z-20 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-6">
            <div>
              <span className="block font-bold text-white text-sm">99.9%</span>
              <span className="text-[11px] text-neutral-400">Uptime SLA</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="block font-bold text-white text-sm">&lt; 1.2s</span>
              <span className="text-[11px] text-neutral-400">Fast Scan</span>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div>
              <span className="block font-bold text-white text-sm">256-Bit</span>
              <span className="text-[11px] text-neutral-400">SSL Encrypted</span>
            </div>
          </div>
          <p className="text-[11px] text-neutral-500 hidden xl:block">
            &copy; {new Date().getFullYear()} ASLENIX TECH &amp; SOLUTION
          </p>
        </div>
      </div>

      {/* =========================================================
          RIGHT PANEL: 3D Perspective Tilt Login Card
          ========================================================= */}
      <div className="w-full lg:w-[50%] xl:w-[47%] min-h-screen flex items-center justify-center p-6 sm:p-10 lg:p-12 relative">
        {/* Soft Ambient Background Elements for Right Panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -left-20 h-80 w-80 rounded-full blur-[120px] opacity-25 dark:opacity-20"
          style={{ background: "var(--neon-red)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-20 h-80 w-80 rounded-full blur-[120px] opacity-25 dark:opacity-20"
          style={{ background: "var(--neon-blue)" }}
        />

        {/* 3D Perspective Tilt Card Container */}
        <ThreeDTiltCard
          maxTilt={7}
          scale={1.01}
          glareOpacity={0.16}
          className="w-full max-w-md mx-auto rounded-3xl p-7 sm:p-9 bg-card/95 border border-border/80 shadow-2xl backdrop-blur-xl relative z-10"
        >
          {/* Mobile Brand Logo */}
          <div className="flex lg:hidden justify-center mb-6">
            <AslenixLogo size="lg" />
          </div>

          {/* Form Header */}
          <div className="space-y-2 text-center lg:text-left mb-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck size={12} />
              <span>Secure Workspace Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your ASLENIX employee or admin account
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="space-y-5">
            {/* Username or Email Input */}
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Username or Email
              </Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User size={17} />
                </div>
                <Input
                  id="identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="aslenix-admin or you@company.com"
                  autoComplete="username"
                  className="pl-10 h-11 sm:h-12 rounded-xl border-border bg-background/80 hover:bg-background focus:bg-background focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock size={17} />
                </div>
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={checkCapsLock}
                  onKeyUp={checkCapsLock}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-10 pr-11 h-11 sm:h-12 rounded-xl border-border bg-background/80 hover:bg-background focus:bg-background focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Toggle password visibility"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Real-time Caps Lock Indicator */}
              {capsLockActive && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-lg px-2.5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle size={14} className="shrink-0 text-amber-500" />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in to Workspace</span>
                  <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>

          {/* Form Footer */}
          <div className="space-y-4 pt-3 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary font-bold hover:underline transition-colors">
                Create one
              </Link>
            </p>

            {/* Enterprise Security Badge */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock size={12} className="text-muted-foreground" />
              <span>Protected by 256-bit SSL encryption</span>
            </div>
          </div>
        </ThreeDTiltCard>
      </div>
    </div>
  );
}
