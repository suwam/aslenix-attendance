import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sun,
  Sunrise,
  Sparkles,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  ArrowRight,
  Smile,
  Zap,
  Coffee,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MorningGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  nepaliDate?: string;
  gregorianDate?: string;
  shiftName?: string;
  shiftTime?: string;
  isCheckedIn?: boolean;
  checkInTime?: string | null;
  onCheckIn?: () => void;
  isWeeklyOff?: boolean;
}

const INSPIRATIONAL_MESSAGES = [
  {
    quote: "Every morning is a fresh canvas. Let's build something remarkable today with the team!",
    author: "Aslenix Team Motivation",
    tag: "Focus & Innovation",
  },
  {
    quote: "Excellence is not a single act, but a daily habit of caring, collaborating, and delivering.",
    author: "Workplace Inspiration",
    tag: "Teamwork",
  },
  {
    quote: "Great teams turn small daily efforts into massive milestones. Wishing you an energized and productive shift!",
    author: "Daily Leadership",
    tag: "High Performance",
  },
  {
    quote: "Stay curious, stay positive, and tackle today's goals one clean sprint at a time.",
    author: "Sprint Mindset",
    tag: "Consistency",
  },
];

export function MorningGreetingModal({
  open,
  onOpenChange,
  userName = "Team",
  nepaliDate,
  gregorianDate,
  shiftName = "Morning Shift",
  shiftTime = "09:00 AM – 06:00 PM",
  isCheckedIn = false,
  checkInTime = null,
  onCheckIn,
  isWeeklyOff = false,
}: MorningGreetingModalProps) {
  // Select a consistent daily motivational quote based on day of month
  const dailyMessage = useMemo(() => {
    const day = new Date().getDate();
    return INSPIRATIONAL_MESSAGES[day % INSPIRATIONAL_MESSAGES.length];
  }, []);

  // Time-aware greeting
  const greetingTime = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Good Morning", icon: Sunrise, emoji: "☀️" };
    if (hour < 17) return { text: "Good Afternoon", icon: Sun, emoji: "🌤️" };
    return { text: "Good Evening", icon: Sparkles, emoji: "✨" };
  }, []);

  const IconComponent = greetingTime.icon;

  const handleStartWorkday = () => {
    onOpenChange(false);
  };

  const handlePunchAndDismiss = () => {
    onCheckIn?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden rounded-3xl border border-border/80 bg-background shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Radiant Morning Header Banner */}
        <div className="relative border-b border-border/70 bg-gradient-to-br from-amber-500/15 via-indigo-500/10 to-purple-500/15 px-6 pt-7 pb-6 overflow-hidden">
          {/* Ambient Background Glow Circles */}
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 via-orange-400/20 to-purple-500/20 text-amber-600 dark:text-amber-400 border border-amber-400/40 shadow-sm ring-4 ring-amber-400/10">
              <IconComponent size={28} className="animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                <Sparkles size={11} />
                <span>Daily Morning Brief · Welcome</span>
              </div>

              <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                {greetingTime.text}, {userName}! {greetingTime.emoji}
              </DialogTitle>

              <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {isWeeklyOff
                  ? "Today is a scheduled company weekly off. Relax, recharge, and enjoy your time off!"
                  : "Wishing you a productive, energizing, and rewarding day ahead with the Aslenix team."}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Daily Inspirational Quote Card */}
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5 relative overflow-hidden">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Coffee size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-0.5">
                  {dailyMessage.tag}
                </div>
                <p className="text-xs font-medium text-foreground italic leading-snug">
                  "{dailyMessage.quote}"
                </p>
                <div className="text-[10px] text-muted-foreground/80 mt-1 font-semibold">
                  — {dailyMessage.author}
                </div>
              </div>
            </div>
          </div>

          {/* Today's Schedule & Presence Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {/* 1. Date */}
            <div className="rounded-xl border border-border/70 bg-white/70 dark:bg-card/70 p-2.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Calendar size={13} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Today</span>
              </div>
              <div className="font-extrabold text-foreground text-xs leading-tight">
                {gregorianDate || "Today"}
              </div>
              {nepaliDate && (
                <div className="text-[10px] text-muted-foreground mt-0.5 font-medium truncate">
                  {nepaliDate} BS
                </div>
              )}
            </div>

            {/* 2. Shift */}
            <div className="rounded-xl border border-border/70 bg-white/70 dark:bg-card/70 p-2.5 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Clock size={13} className="text-purple-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Shift</span>
              </div>
              <div className="font-extrabold text-foreground text-xs leading-tight truncate">
                {shiftName}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                {shiftTime}
              </div>
            </div>

            {/* 3. Check-in Status */}
            <div className={cn(
              "rounded-xl border p-2.5 flex flex-col justify-between",
              isCheckedIn
                ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                : isWeeklyOff
                  ? "border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20"
                  : "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
            )}>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ShieldCheck size={13} className={isCheckedIn ? "text-emerald-500" : isWeeklyOff ? "text-rose-500" : "text-amber-500"} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Status</span>
              </div>
              <div className={cn(
                "font-extrabold text-xs leading-tight",
                isCheckedIn
                  ? "text-emerald-600 dark:text-emerald-400"
                  : isWeeklyOff
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-amber-600 dark:text-amber-400"
              )}>
                {isCheckedIn ? "Punched In" : isWeeklyOff ? "Weekly Off" : "Pending Check-In"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                {isCheckedIn && checkInTime ? `In at ${checkInTime}` : isWeeklyOff ? "No punch required" : "Ready to punch"}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            {!isCheckedIn && !isWeeklyOff && onCheckIn ? (
              <Button
                type="button"
                onClick={handlePunchAndDismiss}
                className="w-full sm:flex-1 h-11 rounded-xl bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <LogIn size={15} className="group-hover:translate-x-0.5 transition-transform" />
                <span>Punch In Now & Start Day</span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleStartWorkday}
                className="w-full sm:flex-1 h-11 rounded-xl bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <span>Let's Get Started</span>
                <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-11 rounded-xl border-border/80 px-4 text-xs font-semibold hover:bg-muted transition-colors"
            >
              Close
            </Button>
          </div>

          {/* Subtle Daily Once Notice */}
          <div className="text-center text-[10px] text-muted-foreground/70 flex items-center justify-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-500" />
            <span>Greeting shown once daily upon morning login</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
