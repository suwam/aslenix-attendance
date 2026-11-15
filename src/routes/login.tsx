import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AslenixLogo } from "@/components/AslenixLogo";
import type { AvatarAnimationState } from "@/components/avatar/WelcomeAvatar3D";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

// Keep the form bundle small: the WebGL renderer and model load after the form is usable.
const WelcomeAvatar3D = lazy(async () => {
  const module = await import("@/components/avatar/WelcomeAvatar3D");
  return { default: module.WelcomeAvatar3D };
});

function LoginPage() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);

  // 3D Avatar state management
  const [avatarState, setAvatarState] = useState<AvatarAnimationState>("peek");
  const [speechText, setSpeechText] = useState("");
  const [isSpeechChanging, setIsSpeechChanging] = useState(false);

  useEffect(() => {
    const nextSpeech = (() => {
      switch (avatarState) {
        case "entrance":
        case "wave":
          return "Hi there! Welcome to ASLENIX!";
        case "guidance":
        case "idle":
          return "Ready to start your day? Sign in to check in!";
        case "look_at_form":
          return "Enter your username or email.";
        case "cover_eyes":
          return "No peeking — your password is safe.";
        case "peeking_eyes":
          return "Password revealed.";
        case "loading":
          return "Verifying your credentials...";
        case "celebrating":
          return "Welcome back! Redirecting you now.";
        case "error":
          return "Please double-check your credentials.";
        default:
          return "";
      }
    })();

    if (nextSpeech === speechText) return;
    setIsSpeechChanging(true);
    const textTimer = window.setTimeout(() => {
      setSpeechText(nextSpeech);
      setIsSpeechChanging(false);
    }, speechText ? 120 : 0);
    return () => window.clearTimeout(textTimer);
  }, [avatarState, speechText]);

  // Entrance choreography: Starts peeking behind the card, then smoothly emerges, waves, and guides the user
  useEffect(() => {
    // 1. Initial state: "peek" (avatar hidden behind card with head and hand peeking out)
    const entranceTimer = setTimeout(() => {
      setAvatarState("entrance");
    }, 1100);

    const waveTimer = setTimeout(() => {
      setAvatarState("wave");
    }, 1800);

    const guidanceTimer = setTimeout(() => {
      setAvatarState("guidance");
    }, 4500);

    const idleTimer = setTimeout(() => {
      setAvatarState((prev) =>
        prev === "wave" || prev === "entrance" || prev === "guidance" ? "idle" : prev
      );
    }, 7000);

    return () => {
      clearTimeout(entranceTimer);
      clearTimeout(waveTimer);
      clearTimeout(guidanceTimer);
      clearTimeout(idleTimer);
    };
  }, []);

  useEffect(() => {
    // The avatar is decorative. Never download or initialize WebGL on mobile,
    // where the form is the only visible login content.
    const desktopMedia = window.matchMedia("(min-width: 768px)");
    let timer: number | undefined;

    const syncAvatar = () => {
      if (timer) window.clearTimeout(timer);
      if (!desktopMedia.matches) {
        setShowAvatar(false);
        return;
      }
      timer = window.setTimeout(() => setShowAvatar(true), 450);
    };

    syncAvatar();
    desktopMedia.addEventListener("change", syncAvatar);
    return () => {
      if (timer) window.clearTimeout(timer);
      desktopMedia.removeEventListener("change", syncAvatar);
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
    if (loading) return;

    const id = identifier.trim();
    if (!id) {
      toast.error("Please enter your username or email");
      return;
    }
    if (!password) {
      toast.error("Please enter your password");
      return;
    }

    setLoading(true);
    setAvatarState("loading");

    try {
      let loginEmail = id;
      if (!id.includes("@")) {
        const lower = id.toLowerCase();
        if (
          ["alenix-admin", "aslenix-admin", "admin", "alenix_admin", "aslenix_admin"].includes(lower)
        ) {
          loginEmail = "info.aslenix.np@gmail.com";
        } else {
          const { data: resolvedEmail, error: rpcError } = await supabase.rpc("get_login_email", {
            p_identifier: id,
          });
          if (resolvedEmail) {
            loginEmail = resolvedEmail;
          } else if (rpcError) {
            console.warn("RPC username resolution notice:", rpcError.message);
          }
        }
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        setAvatarState("error");
        toast.error(error.message || "Invalid credentials");
        setTimeout(() => {
          setAvatarState("idle");
        }, 3000);
        return;
      }

      if (!authData?.user) {
        setAvatarState("error");
        toast.error("Authentication failed. Please try again.");
        setTimeout(() => {
          setAvatarState("idle");
        }, 3000);
        return;
      }

      setAvatarState("celebrating");
      toast.success("Welcome back");

      // AuthProvider already loads the profile and roles after sign-in. Going through
      // the landing route avoids duplicating those requests, especially on mobile.
      nav({ to: "/" });
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setAvatarState("error");
      toast.error(err?.message || "An unexpected error occurred. Please try again.");
      setTimeout(() => {
        setAvatarState("idle");
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#f3f5ff_42%,#faf5ff_100%)] dark:bg-slate-950 selection:bg-indigo-500/20 selection:text-indigo-600">
      {/* Soft Ambient Background Glow Orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full blur-[130px] opacity-25 dark:opacity-20"
        style={{ background: "linear-gradient(135deg, #dbeafe 0%, #e0e7ff 55%, #f5dffd 100%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full blur-[130px] opacity-25 dark:opacity-20"
        style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #ddd6fe 55%, #fae8ff 100%)" }}
      />

      {/* Centered Login Stage: 3D Avatar (Behind) + Login Card (Foreground) */}
      <div className="relative flex items-center justify-center w-full max-w-md mx-auto">
        {/* =======================================================
            3D HUMAN RECEPTIONIST AVATAR (Layer Z-10: Sits behind card)
            ======================================================= */}
        <div className="hidden md:block absolute -top-8 -right-28 lg:-right-36 xl:-right-44 w-[360px] lg:w-[400px] xl:w-[440px] h-[480px] z-10 pointer-events-none">
          {showAvatar && (
            <Suspense fallback={null}>
              <WelcomeAvatar3D state={avatarState} showPassword={show} />
            </Suspense>
          )}
        </div>

        {/* This lives in the stage layer instead of the canvas layer so the card can
            cover the avatar without ever covering the avatar's message. */}
        <div
          aria-live="polite"
          className={`hidden md:block absolute z-30 pointer-events-none top-3 lg:top-5 right-[-5rem] lg:right-[-11rem] xl:right-[-15rem] w-[220px] lg:w-[240px] transition-all duration-200 ease-out ${
            speechText
              ? isSpeechChanging
                ? "opacity-0 -translate-y-1 scale-[0.98]"
                : "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-1 scale-[0.98]"
          }`}
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.34)]">
            <p className="text-[13px] font-semibold leading-snug tracking-tight text-slate-800">
              {speechText}
            </p>
            <span
              aria-hidden
              className="absolute -bottom-1.5 right-9 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white"
            />
          </div>
        </div>

        {/* =======================================================
            PREMIUM WHITE LOGIN CARD (Layer Z-20: Pure White, Crisp Shadow)
            ======================================================= */}
        <div className="relative z-20 box-border w-[calc(100vw-2rem)] max-w-[420px] sm:w-full bg-white dark:bg-card border border-slate-200/80 dark:border-border/80 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.12)] dark:shadow-2xl rounded-3xl p-6 sm:p-10 backdrop-blur-xl transition-all">
          {/* Original ASLENIX Logo at Top Center */}
          <div className="flex justify-center mb-6">
            <AslenixLogo size="lg" />
          </div>

          {/* Form Heading & Subtitle */}
          <div className="space-y-1.5 text-center mb-7">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-foreground">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              Sign in to your ASLENIX workspace
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={submit} className="space-y-5">
            {/* Username or Email Input */}
            <div className="space-y-2">
              <Label
                htmlFor="identifier"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Username or Email
              </Label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onFocus={handleIdentifierFocus}
                onBlur={handleIdentifierBlur}
                placeholder="Alenix-ADMIN or you@company.com"
                autoComplete="username"
                className="h-11 sm:h-12 rounded-xl border-slate-200 dark:border-border bg-white dark:bg-background/80 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-indigo-500/15 focus-visible:border-indigo-500 transition-all text-sm font-medium"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
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
                  onFocus={handlePasswordFocus}
                  onBlur={handlePasswordBlur}
                  onKeyDown={checkCapsLock}
                  onKeyUp={checkCapsLock}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-11 h-11 sm:h-12 rounded-xl border-slate-200 dark:border-border bg-white dark:bg-background/80 hover:border-slate-300 focus-visible:ring-4 focus-visible:ring-indigo-500/15 focus-visible:border-indigo-500 transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={handleTogglePassword}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Caps Lock Alert */}
              {capsLockActive && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-lg px-2.5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <AlertCircle size={14} className="shrink-0 text-amber-500" />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Functional Sign In Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-xl font-bold text-sm sm:text-base text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Signing in...</span>
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Form Footer */}
          <div className="mt-7 text-center">
            <p className="text-sm text-slate-500 dark:text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
