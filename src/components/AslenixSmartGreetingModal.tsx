import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AslenixLogo } from "@/components/AslenixLogo";
import { getSmartGreetingMessage, getWelcomeGreeting, GreetingMessage, GreetingMode, MOTIVATIONAL_QUOTES } from "@/lib/greeting-service";
import { ArrowRight, CheckCircle2, MoonStar, Sparkles, Sun, Sunset } from "lucide-react";

export interface AslenixSmartGreetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GreetingMode;
  employeeName?: string;
  employeeId?: string;
  isCheckedIn?: boolean;
}

export function AslenixSmartGreetingModal({
  open,
  onOpenChange,
  mode,
  employeeName = "Team Member",
  employeeId,
  isCheckedIn = false,
}: AslenixSmartGreetingModalProps) {
  const [smartMessage, setSmartMessage] = useState<GreetingMessage>(MOTIVATIONAL_QUOTES[0]);
  const isWelcome = mode === "welcome";

  useEffect(() => {
    if (open) setSmartMessage(getSmartGreetingMessage(mode, employeeId));
  }, [open, mode, employeeId]);

  const greeting = useMemo(() => (isWelcome ? getWelcomeGreeting() : "DAY COMPLETED!"), [isWelcome, open]);
  const headline = isWelcome ? `Welcome, ${employeeName}.` : `Thank you, ${employeeName}.`;
  const supportingMessage = isWelcome
    ? "Wishing you a focused, productive day ahead."
    : "Your dedication moves ASLENIX forward. Have a wonderful evening.";
  const Icon = isWelcome
    ? greeting === "GOOD AFTERNOON!" ? Sunset : greeting === "GOOD EVENING!" || greeting === "WELCOME BACK!" ? MoonStar : Sun
    : MoonStar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-3xl border border-[#dcd7f3] bg-[#f8f7fc] p-0 text-[#171c2d] shadow-2xl data-[state=open]:zoom-in-95 data-[state=open]:fade-in-0 motion-reduce:animate-none sm:max-w-lg">
        <div className="flex items-center justify-between border-b border-[#e2def1] bg-gradient-to-r from-[#e9dfff] via-[#d8e5ff] to-white px-5 py-4 sm:px-7 sm:py-5">
          <AslenixLogo size="sm" />
          <div className="mr-7 inline-flex items-center gap-1.5 rounded-full border border-[#6250d5]/20 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6250d5]">
            <Sparkles size={11} /> Smart Welcome
          </div>
        </div>

        <div className="space-y-5 bg-white px-5 py-6 text-center sm:px-7 sm:py-7">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white bg-gradient-to-br from-[#e9dfff] to-[#d8e5ff] text-[#6250d5] shadow-sm animate-in fade-in zoom-in-90 duration-500 motion-reduce:animate-none">
              <Icon size={28} strokeWidth={1.8} />
            </div>
          </div>

          <div className="space-y-1.5">
            <DialogTitle className="text-xs font-extrabold tracking-[0.16em] text-[#6250d5]">{greeting}</DialogTitle>
            <h2 className="text-xl font-extrabold tracking-tight text-[#171c2d] sm:text-2xl">{headline}</h2>
          </div>

          <div key={smartMessage.id} className="rounded-2xl border border-[#ded9f1] bg-[#f8f7fc] p-4 text-left shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#6250d5]/15 bg-[#e9dfff] text-[#6250d5]">
                <Sparkles size={14} />
              </div>
              <div>
                <p className="text-sm font-medium leading-relaxed text-[#171c2d]">“{smartMessage.text}”</p>
                <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#6250d5]">{smartMessage.category}</p>
              </div>
            </div>
          </div>

          <DialogDescription className="text-xs font-medium leading-relaxed text-slate-600">{supportingMessage}</DialogDescription>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#6250d5]/15 bg-gradient-to-r from-[#d8e5ff] via-[#e9dfff] to-[#d8e5ff] text-sm font-bold text-[#171c2d] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 motion-reduce:transform-none"
          >
            <span>{isWelcome ? "Let's Get Started" : "Done"}</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
          </button>

          <div className="flex items-center justify-center gap-1.5 pt-0.5 text-[11px] text-slate-500">
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>{isWelcome ? (isCheckedIn ? "Attendance recorded" : "Ready when you are") : "Checkout completed"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
