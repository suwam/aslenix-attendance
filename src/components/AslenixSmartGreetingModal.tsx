import { useMemo, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AslenixLogo } from "@/components/AslenixLogo";
import {
  getSmartGreetingMessage,
  getDynamicMorningTitle,
  GreetingMessage,
} from "@/lib/greeting-service";
import {
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  Heart,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AslenixSmartGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "morning" | "evening";
  employeeName?: string;
  onAction?: () => void;
}

export function AslenixSmartGreetingModal({
  open,
  onOpenChange,
  mode,
  employeeName = "Team Member",
  onAction,
}: AslenixSmartGreetingModalProps) {
  const isMorning = mode === "morning";

  // Select a personalized rotating company-approved message
  const [smartMessage, setSmartMessage] = useState<GreetingMessage>(() =>
    getSmartGreetingMessage(mode),
  );

  // Rotate / re-select message whenever modal opens
  useEffect(() => {
    if (open) {
      setSmartMessage(getSmartGreetingMessage(mode));
    }
  }, [open, mode]);

  // Dynamic greeting title
  const dynamicGreetingTitle = useMemo(() => {
    return isMorning ? getDynamicMorningTitle() : "Day Completed!";
  }, [isMorning]);

  // Personalized employee headline
  const employeeHeadline = useMemo(() => {
    return isMorning
      ? `Welcome back, ${employeeName}.`
      : `Great work today, ${employeeName}!`;
  }, [isMorning, employeeName]);

  // Closing friendly sign-off
  const closingMessage = useMemo(() => {
    return isMorning
      ? "Wishing you a productive day!"
      : "Take a well-deserved rest. See you tomorrow!";
  }, [isMorning]);

  const handleActionClick = () => {
    onAction?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] sm:max-w-[480px] p-0 overflow-hidden rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0c1222] shadow-[0_25px_60px_-15px_rgba(37,99,235,0.18)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-250">
        {/* Subtle AI-inspired ambient background glow */}
        <div className="absolute -top-16 -right-16 h-44 w-44 rounded-full bg-blue-500/10 dark:bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-violet-500/10 dark:bg-violet-500/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl pointer-events-none" />

        {/* Modal Header with ASLENIX Branding */}
        <div className="relative z-10 px-6 sm:px-8 pt-7 pb-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
          <AslenixLogo size="sm" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            <Sparkles size={11} className="text-blue-500" />
            <span>{isMorning ? "Smart Welcome" : "Shift Complete"}</span>
          </div>
        </div>

        {/* Modal Core Body */}
        <div className="relative z-10 px-6 sm:px-8 py-6 text-center space-y-5">
          {/* AI-Inspired Intelligent Glowing Illustration Element */}
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              {/* Outer breathing aura */}
              <div
                className={cn(
                  "absolute h-20 w-20 rounded-full animate-ping opacity-25",
                  isMorning
                    ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-amber-300"
                    : "bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-400",
                )}
                style={{ animationDuration: "3.5s" }}
              />

              {/* Middle glowing ring */}
              <div
                className={cn(
                  "relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg transition-transform",
                  isMorning
                    ? "border-blue-300/60 dark:border-blue-500/40 bg-gradient-to-br from-blue-500/15 via-cyan-400/20 to-amber-400/15 text-blue-600 dark:text-blue-400 shadow-blue-500/10 ring-4 ring-blue-500/10"
                    : "border-violet-300/60 dark:border-violet-500/40 bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-emerald-400/15 text-violet-600 dark:text-violet-400 shadow-violet-500/10 ring-4 ring-violet-500/10",
                )}
              >
                {isMorning ? (
                  <Sun size={30} className="animate-pulse text-amber-500" />
                ) : (
                  <Moon size={28} className="animate-pulse text-violet-500" />
                )}
              </div>
            </div>
          </div>

          {/* Titles & Personal Greeting */}
          <div className="space-y-1">
            <DialogTitle className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              {dynamicGreetingTitle}
            </DialogTitle>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              {employeeHeadline}
            </h2>
          </div>

          {/* Personalized Message Card (Minimalist & AI-Inspired, No stats) */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 text-left relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "{smartMessage.text}"
                </p>
                {smartMessage.tag && (
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    · {smartMessage.tag}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Friendly Closing Line */}
          <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {closingMessage}
          </DialogDescription>

          {/* Action Button: Styled in Signature ASLENIX Gradient */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-black text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer border-0"
            >
              {isMorning ? (
                <>
                  <span>Let's Get Started</span>
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              ) : (
                <>
                  <Heart
                    size={16}
                    className="text-rose-500 fill-rose-500/30 group-hover:scale-110 transition-transform"
                  />
                  <span>Have a Great Evening</span>
                </>
              )}
            </button>
          </div>

          {/* Subtle Confirmation Badge */}
          <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1 pt-1">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <span>
              {isMorning
                ? "Attendance recorded · Have a great shift"
                : "Shift checkout recorded · Rest well"}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
