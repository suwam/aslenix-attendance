import { useMemo, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
} from "lucide-react";

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
      <DialogContent className="max-w-md sm:max-w-lg p-0 overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Modal Header using system's standard primary/purple subtle gradient */}
        <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-purple-500/10 to-transparent px-6 sm:px-7 py-5 flex items-center justify-between">
          <AslenixLogo size="sm" />
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            <Sparkles size={11} />
            <span>{isMorning ? "Smart Welcome" : "Shift Complete"}</span>
          </div>
        </div>

        {/* Modal Core Body */}
        <div className="p-6 sm:p-7 text-center space-y-5">
          {/* System standard pastel gradient icon box */}
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#c4daff] to-[#e5ccff] text-[#0f172a] shadow-xs border border-white/60">
              {isMorning ? (
                <Sun size={26} className="text-amber-500" />
              ) : (
                <Moon size={24} className="text-primary" />
              )}
            </div>
          </div>

          {/* Titles & Personal Greeting */}
          <div className="space-y-1">
            <DialogTitle className="text-xs font-bold uppercase tracking-wider text-primary">
              {dynamicGreetingTitle}
            </DialogTitle>
            <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-snug">
              {employeeHeadline}
            </h2>
          </div>

          {/* Personalized Message Card matching system theme */}
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 text-left relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed italic">
                  "{smartMessage.text}"
                </p>
                {smartMessage.tag && (
                  <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-primary">
                    · {smartMessage.tag}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Friendly Closing Line */}
          <DialogDescription className="text-xs font-medium text-muted-foreground">
            {closingMessage}
          </DialogDescription>

          {/* Action Button: Styled in Signature ASLENIX Gradient */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full h-11 sm:h-12 rounded-xl bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] font-bold text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer border-0"
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

          {/* Subtle System Status Note */}
          <div className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 pt-1">
            <CheckCircle2 size={13} className="text-emerald-500" />
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
