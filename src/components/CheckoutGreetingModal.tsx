import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sunset,
  Sparkles,
  Clock,
  Heart,
  CheckCircle2,
  Calendar,
  Zap,
  Timer,
  PartyPopper,
  ShieldCheck,
  ArrowRight,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatWorkHours } from "@/lib/work-hours";

export interface CheckoutGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workHours?: number | string | null;
  isEarly?: boolean;
  earlyMinutes?: number;
  overtimeMinutes?: number;
  shiftName?: string;
  gregorianDate?: string;
  nepaliDate?: string;
}

const EVENING_SENDOFF_MESSAGES = [
  {
    quote: "Rest and self-care are essential parts of high performance. Step away, recharge, and enjoy your evening!",
    tag: "Rest & Wellness",
    author: "Work-Life Balance",
  },
  {
    quote: "Another day of progress in the books. Thank you for your energy, focus, and commitment to the team!",
    tag: "Team Appreciation",
    author: "Aslenix Leadership",
  },
  {
    quote: "Great accomplishments are built one consistent workday at a time. Proud of what you delivered today!",
    tag: "Daily Wins",
    author: "Sprint Mindset",
  },
  {
    quote: "Clear your desk, clear your mind. Tomorrow is a brand-new day with fresh possibilities.",
    tag: "Evening Reflection",
    author: "Peace of Mind",
  },
];

export function CheckoutGreetingModal({
  open,
  onOpenChange,
  userName = "Team Member",
  checkInTime,
  checkOutTime,
  workHours,
  isEarly = false,
  earlyMinutes = 0,
  overtimeMinutes = 0,
  shiftName = "Standard Shift",
  gregorianDate,
  nepaliDate,
}: CheckoutGreetingModalProps) {
  // Select daily farewell quote
  const dailyMessage = useMemo(() => {
    const day = new Date().getDate();
    return EVENING_SENDOFF_MESSAGES[day % EVENING_SENDOFF_MESSAGES.length];
  }, []);

  const formattedHours = useMemo(() => {
    if (!workHours) return "8h 00m";
    return typeof workHours === "number" ? formatWorkHours(workHours) : String(workHours);
  }, [workHours]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden rounded-3xl border border-border/80 bg-background shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Twilight / Evening Header Banner */}
        <div className="relative border-b border-border/70 bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-emerald-500/15 px-6 pt-7 pb-6 overflow-hidden">
          {/* Ambient Glow Circles */}
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/25 via-purple-500/20 to-emerald-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-400/40 shadow-sm ring-4 ring-indigo-400/10">
              <Sunset size={28} className="animate-pulse text-indigo-500" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1.5">
                <CheckCircle2 size={11} className="text-emerald-500" />
                <span>Shift Clocked Out Successfully</span>
              </div>

              <DialogTitle className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-tight">
                Great Work Today, {userName}! 👏
              </DialogTitle>

              <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {isEarly
                  ? `You have clocked out for the day (${earlyMinutes}m before scheduled closing). Have a restful evening!`
                  : overtimeMinutes > 0
                    ? `Shift completed with ${overtimeMinutes}m extra dedication! Thank you for going the extra mile.`
                    : "Your workday is officially complete. Thank you for your hard work and contribution today!"}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Shift Performance & Hours Summary Card */}
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-muted/50 via-muted/30 to-background p-4 relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <div className="text-xs font-black text-foreground">{shiftName}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {gregorianDate} {nepaliDate ? `· ${nepaliDate} BS` : ""}
                  </div>
                </div>
              </div>

              <div className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border",
                isEarly
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              )}>
                {isEarly ? "Early Left" : "Completed"}
              </div>
            </div>

            {/* 3 Metric Pills: In, Out, Total Hours */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-border/70 bg-white/70 dark:bg-card/70 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Check In
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-foreground font-mono">
                  {checkInTime || "—"}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-white/70 dark:bg-card/70 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                  Check Out
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-foreground font-mono">
                  {checkOutTime || "—"}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">
                  Hours Worked
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formattedHours}
                </div>
              </div>
            </div>
          </div>

          {/* Evening Appreciation Quote */}
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5 relative overflow-hidden">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Sparkles size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-0.5">
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

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:flex-1 h-11 rounded-xl bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer border-0"
            >
              <Heart size={15} className="text-rose-500 fill-rose-500/30 group-hover:scale-110 transition-transform" />
              <span>Have a Great Evening! ✨</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-11 rounded-xl border-border/80 px-4 text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
            >
              Close
            </Button>
          </div>

          {/* Checkout note */}
          <div className="text-center text-[10px] text-muted-foreground/70 flex items-center justify-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-500" />
            <span>Attendance logged safely & WhatsApp update queued</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
