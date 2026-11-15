import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import { WelcomeAvatar3D, AvatarAnimationState } from "@/components/avatar/WelcomeAvatar3D";
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

  // 3D Avatar state management
  const [avatarState, setAvatarState] = useState<AvatarAnimationState>("peek");

  // Entrance choreography: Starts peeking behind the card, then smoothly emerges and waves
  useEffect(() => {
    // Initial state is "peek" (avatar hidden behind card with head and hand peeking out)
    const entranceTimer = setTimeout(() => {
      setAvatarState("entrance");
    }, 1100);

    const waveTimer = setTimeout(() => {
      setAvatarState("wave");
    }, 1800);

    const idleTimer = setTimeout(() => {
      setAvatarState((prev) => (prev === "wave" || prev === "entrance" ? "idle" : prev));
    }, 4800);

    return () => {
      clearTimeout(entranceTimer);
      clearTimeout(waveTimer);
      clearTimeout(idleTimer);
    };
  }, []);

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  // Form Field Interactions with 3D Avatar
  const handleIdentifierFocus = () => {
    if (avatarState !== "loading" && avatarState !== "celebrating") {
      setAvatarState("look_at_form");
    }
  };

  const handleIdentifierBlur = () => {
    if (avatarState === "look_at_form") {
      setAvatarState("idle");
    }
  };

  const handlePasswordFocus = () => {
    if (avatarState !== "loading" && avatarState !== "celebrating") {
      setAvatarState(show ? "peeking_eyes" : "cover_eyes");
    }
  };

  const handlePasswordBlur = () => {
    if (avatarState === "cover_eyes" || avatarState === "peeking_eyes") {
      setAvatarState("idle");
    }
  };

  const handleTogglePassword = () => {
    setShow((prev) => {
      const next = !prev;
      if (avatarState === "cover_eyes" || avatarState === "peeking_eyes") {
        setAvatarState(next ? "peeking_eyes" : "cover_eyes");
      }
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAvatarState("loading");

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
      setAvatarState("error");
      toast.error(error.message);
      setTimeout(() => {
        setAvatarState("idle");
      }, 3500);
      return;
    }

    setAvatarState("celebrating");
    toast.success("Welcome back");

    setTimeout(() => {
      nav({ to: "/" });
    }, 1100);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* =========================================================
          LEFT PANEL: Enterprise Branding & Feature Highlights
          ========================================================= */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[48%] relative flex-col justify-between p-10 xl:p-14 bg-[#080C16] text-white overflow-hidden border-r border-border/10 shrink-0">
        {/* Ambient Glowing Background Orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 h-[440px] w-[440px] rounded-full blur-[130px] opacity-35"
          style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-24 h-[440px] w-[440px] rounded-full blur-[130px] opacity-30"
          style={{ background: "linear-gradient(135deg, #e11d48 0%, #9333ea 100%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/3 -translate-y-1/2 h-[320px] w-[320px] rounded-full blur-[110px] opacity-20"
          style={{ background: "#6366f1" }}
        />

        {/* 3D Cyber Perspective Floor Grid */}
        <div
          aria-hidden
          className="cyber-3d-grid pointer-events-none absolute bottom-0 left-0 right-0 h-[360px] opacity-35 z-0"
        />

        {/* Top Header Row */}
        <div className="relative z-20 flex items-center justify-between">
          <AslenixLogo inverted size="md" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>All Systems Online</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-20 my-auto py-8 xl:py-10 space-y-6 max-w-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full backdrop-blur-md">
              <Sparkles size={13} className="text-indigo-400" />
              <span>Interactive 3D Virtual Receptionist</span>
            </div>
            <h1 className="text-3xl xl:text-4xl 2xl:text-[42px] font-extrabold tracking-tight leading-[1.18] text-white">
              Smart Attendance, Canteen &amp; Real-Time Team Intelligence.
            </h1>
            <p className="text-sm xl:text-base text-neutral-300/85 leading-relaxed">
              Unified workspace solution built for ASLENIX employees and administrators. Meet your virtual assistant to start your day.
            </p>
          </div>

          {/* Interactive Feature Cards */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 shrink-0">
                <QrCode size={18} />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Contactless QR &amp; Biometrics</span>
                  <CheckCircle2 size={13} className="text-indigo-400" />
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Sub-second mobile scan with anti-spoofing and automatic shift calculation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 shrink-0">
                <Utensils size={18} />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Automated Canteen Log Sheet</span>
                  <CheckCircle2 size={13} className="text-rose-400" />
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Nepali Bikram Sambat (BS) date sync, weekend offs, and crisp PDF &amp; Excel exports.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md hover:bg-white/[0.07] hover:border-white/15 transition-all duration-200">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Multi-Tier Role Security</span>
                  <CheckCircle2 size={13} className="text-emerald-400" />
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Granular administrative permissions, leave approvals, and audit tracking.
                </p>
              </div>
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
          RIGHT PANEL: 3D Welcome Avatar & Login Card Stage
          ========================================================= */}
      <div className="w-full lg:w-[54%] xl:w-[52%] min-h-screen flex items-center justify-center p-4 sm:p-8 lg:p-12 relative overflow-hidden">
        {/* Soft Ambient Background Glow Orbs */}
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

        {/* Combined Stage: 3D Avatar (Behind) + Login Card (Foreground) */}
        <div className="relative flex items-center justify-center w-full max-w-xl mx-auto">
          {/* =======================================================
              3D WELCOME AVATAR (Layer Z-10: Sits behind the card)
              ======================================================= */}
          <div className="absolute -top-12 -right-8 sm:-right-24 md:-right-36 lg:-right-44 xl:-right-52 w-[380px] sm:w-[480px] h-[480px] sm:h-[580px] z-10 pointer-events-none">
            <WelcomeAvatar3D
              state={avatarState}
              showPassword={show}
              onGreetingComplete={() => setAvatarState("idle")}
            />
          </div>

          {/* =======================================================
              LOGIN CARD (Layer Z-20: Sits in front of the avatar)
              ======================================================= */}
          <ThreeDTiltCard
            maxTilt={6}
            scale={1.01}
            glareOpacity={0.14}
            className="relative z-20 w-full max-w-md rounded-3xl p-7 sm:p-9 bg-card/95 border border-border/80 shadow-2xl backdrop-blur-xl"
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
                    onFocus={handleIdentifierFocus}
                    onBlur={handleIdentifierBlur}
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
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="pl-10 pr-11 h-11 sm:h-12 rounded-xl border-border bg-background/80 hover:bg-background focus:bg-background focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:border-primary transition-all text-sm font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleTogglePassword}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Real-time Caps Lock Warning */}
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
    </div>
  );
}
