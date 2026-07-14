import { useMemo, useState, useEffect, useRef } from "react";
import NepaliDate from "nepali-date-converter";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { addDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bsInputToAdDateString, formatBsInput, getNepaliDate } from "@/lib/nepali-calendar";
import { cn } from "@/lib/utils";

const pickerPanelClass =
  "z-[70] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-[0_18px_54px_rgba(15,23,42,.18)]";

const pickerIconButtonClass =
  "h-9 w-9 rounded-xl border border-border bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground";

const pickerSectionClass = "rounded-2xl border border-border bg-background";

type BSDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function BSDateInput({
  value,
  onChange,
  className,
  inputClassName,
  placeholder = "YYYY-MM-DD",
  required,
  disabled,
}: BSDateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = parseBsInput(value);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = selected ?? getNepaliDate();
    return { year: date.getYear(), month: date.getMonth() };
  });

  const days = useMemo(() => getMonthDays(viewMonth.year, viewMonth.month), [viewMonth]);
  const monthLabel = useMemo(
    () => new NepaliDate(viewMonth.year, viewMonth.month, 1).format("MMMM YYYY"),
    [viewMonth],
  );

  const moveDay = (amount: number) => {
    const adDate = bsInputToAdDateString(value);
    if (!adDate) return;
    onChange(formatBsInput(addDays(new Date(`${adDate}T00:00:00`), amount)));
  };

  const moveMonth = (amount: number) => {
    setViewMonth((current) => {
      const absoluteMonth = current.year * 12 + current.month + amount;
      return {
        year: Math.floor(absoluteMonth / 12),
        month: ((absoluteMonth % 12) + 12) % 12,
      };
    });
  };

  const selectDate = (day: number) => {
    onChange(formatBsParts(viewMonth.year, viewMonth.month, day));
    setOpen(false);
  };

  const selectToday = () => {
    const today = getNepaliDate();
    setViewMonth({ year: today.getYear(), month: today.getMonth() });
    onChange(formatBsInput());
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        required={required}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          const nextSelected = parseBsInput(value);
          if (nextSelected) {
            setViewMonth({ year: nextSelected.getYear(), month: nextSelected.getMonth() });
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveDay(1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveDay(-1);
          }
        }}
        className={cn("pr-10 font-semibold tabular-nums", inputClassName)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open BS calendar"
            title="Open BS calendar"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground"
            disabled={disabled}
          >
            <CalendarDays size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} collisionPadding={16} className={pickerPanelClass}>
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" className={pickerIconButtonClass} onClick={() => moveMonth(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">BS Calendar</div>
              <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">{monthLabel} BS</div>
            </div>
            <Button type="button" variant="ghost" size="icon" className={pickerIconButtonClass} onClick={() => moveMonth(1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className={cn("grid grid-cols-7 gap-1 p-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground", pickerSectionClass)}>
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>
          <div className={cn("mt-2 grid grid-cols-7 gap-1 p-2", pickerSectionClass)}>
            {Array.from({ length: days.firstWeekday }).map((_, index) => (
              <div key={`blank-${index}`} className="h-9" />
            ))}
            {Array.from({ length: days.totalDays }).map((_, index) => {
              const day = index + 1;
              const isSelected =
                selected?.getYear() === viewMonth.year &&
                selected?.getMonth() === viewMonth.month &&
                selected?.getDate() === day;
              const isToday = formatBsInput() === formatBsParts(viewMonth.year, viewMonth.month, day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    "grid h-9 place-items-center rounded-xl text-sm font-extrabold tabular-nums transition",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground",
                    !isSelected && isToday && "border border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Nepali date picker</span>
            <Button type="button" variant="outline" className="h-9 rounded-xl px-4 text-xs font-bold" onClick={selectToday}>
              Today
            </Button>
          </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function BSMonthInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseBsMonthInput(value);
  const [viewYear, setViewYear] = useState(() => selected?.year ?? getNepaliDate().getYear());
  const currentMonth = getNepaliDate();

  const selectMonth = (month: number) => {
    onChange(formatBsMonthParts(viewYear, month));
    setOpen(false);
  };

  const selectCurrentMonth = () => {
    const today = getNepaliDate();
    setViewYear(today.getYear());
    onChange(formatBsMonthParts(today.getYear(), today.getMonth()));
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        value={value}
        inputMode="numeric"
        placeholder="YYYY-MM"
        onChange={(event) => onChange(event.target.value)}
        className="pr-10 font-semibold tabular-nums"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open BS month picker"
            title="Open BS month picker"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-card hover:text-foreground"
          >
            <CalendarDays size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={10} collisionPadding={16} className={pickerPanelClass}>
          <div className="relative p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" className={pickerIconButtonClass} onClick={() => setViewYear((year) => year - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">BS Month</div>
              <div className="mt-1 text-base font-extrabold tabular-nums text-foreground">{viewYear} BS</div>
            </div>
            <Button type="button" variant="ghost" size="icon" className={pickerIconButtonClass} onClick={() => setViewYear((year) => year + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {NEPALI_MONTH_NAMES.map((monthName, month) => {
              const isSelected = selected?.year === viewYear && selected.month === month;
              const isCurrent = currentMonth.getYear() === viewYear && currentMonth.getMonth() === month;

              return (
                <button
                  key={monthName}
                  type="button"
                  onClick={() => selectMonth(month)}
                  className={cn(
                    "rounded-xl border px-2 py-3 text-sm font-bold transition",
                    "hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
                    isSelected
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-foreground",
                    !isSelected && isCurrent && "border-primary/50 text-primary",
                  )}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Nepali month picker</span>
            <Button type="button" variant="outline" className="h-9 rounded-xl border-border bg-card px-4 text-xs font-bold hover:bg-cyan-400/10 hover:text-cyan-100" onClick={selectCurrentMonth}>
              This month
            </Button>
          </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function BSDateTimeInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const date = value ? new Date(value) : null;
  const bsDate = date && !Number.isNaN(date.getTime()) ? formatBsInput(date) : "";
  const time = date && !Number.isNaN(date.getTime()) ? formatTimeParts(date) : "";

  const update = (nextBsDate: string, nextTime: string) => {
    if (!nextBsDate) {
      onChange("");
      return;
    }

    const adDate = bsInputToAdDateString(nextBsDate);
    if (!adDate) {
      onChange("");
      return;
    }

    onChange(`${adDate}T${nextTime || "09:00"}`);
  };

  return (
    <div className={cn("grid gap-2 sm:grid-cols-[minmax(0,1fr)_118px]", className)}>
      <BSDateInput value={bsDate} onChange={(nextDate) => update(nextDate, time)} />
      <GlassTimeInput value={time} onChange={(nextTime) => update(bsDate || formatBsInput(), nextTime)} />
    </div>
  );
}

export function GlassTimeInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hourValue, minuteValue] = parseTimeInput(value);
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

  const select = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-left font-semibold tabular-nums text-foreground transition",
            "hover:border-border hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/30",
            className,
          )}
        >
          <span>{value || "--:--"}</span>
          <Clock size={16} className="text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-[340px] overflow-hidden rounded-[28px] border border-[#E8ECF3] bg-[#FFFFFF] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)]"
      >
        <div className="relative">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A8599]">Time</div>
              <div className="mt-1 text-[38px] font-extrabold tabular-nums tracking-tight text-[#1A1A1A] leading-none">
                {hourValue}:{minuteValue}
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F7F8FC] text-[#00D2FF]">
              <Clock size={26} strokeWidth={2.5} />
            </div>
          </div>
          <div className="flex gap-4">
            <TimeColumn label="Hour" values={hours} selected={hourValue} onSelect={(hour) => select(hour, minuteValue)} />
            <TimeColumn label="Minute" values={minutes} selected={minuteValue} onSelect={(minute) => select(hourValue, minute)} />
          </div>
          <div className="mt-6 pt-2">
            <Button 
              type="button" 
              className="h-[52px] w-full rounded-2xl bg-gradient-to-r from-[#00D2FF] to-[#FF4DA6] text-base font-bold text-white shadow-[0_8px_20px_rgba(255,77,166,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(255,77,166,0.35)] active:scale-[0.98]" 
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 44;
  const [internalValue, setInternalValue] = useState(selected);
  const scrollTimeout = useRef<any>(null);
  const isProgrammaticScroll = useRef(false);

  useEffect(() => {
    setInternalValue(selected);
    if (scrollRef.current) {
      const idx = values.indexOf(selected);
      if (idx !== -1) {
        isProgrammaticScroll.current = true;
        scrollRef.current.scrollTop = idx * ITEM_HEIGHT;
        setTimeout(() => { isProgrammaticScroll.current = false; }, 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, values]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const idx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const validIdx = Math.max(0, Math.min(values.length - 1, idx));
    const newValue = values[validIdx];

    if (internalValue !== newValue) {
      setInternalValue(newValue);
    }

    if (isProgrammaticScroll.current) return;

    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      onSelect(newValue);
    }, 150);
  };

  const handleItemClick = (value: string) => {
    if (!scrollRef.current) return;
    const idx = values.indexOf(value);
    if (idx !== -1) {
      isProgrammaticScroll.current = true;
      scrollRef.current.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
      setInternalValue(value);
      onSelect(value);
      setTimeout(() => { isProgrammaticScroll.current = false; }, 400);
    }
  };

  return (
    <div className="flex flex-col items-center flex-1">
      <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#7A8599] mb-3">{label}</div>
      <div 
        className="relative w-full h-[220px] rounded-[24px] bg-[#F7F8FC] overflow-hidden" 
        style={{ 
          maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)', 
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)' 
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[44px] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(0,0,0,0.04)] rounded-xl pointer-events-none" />
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-auto relative z-10 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ paddingBottom: '88px', paddingTop: '88px', scrollSnapType: 'y mandatory' }}
        >
          {values.map((value) => {
            const isSelected = internalValue === value;
            return (
              <div
                key={value}
                onClick={() => handleItemClick(value)}
                className="h-[44px] w-full flex items-center justify-center cursor-pointer"
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={cn(
                  "flex items-center justify-center transition-all duration-300",
                  isSelected 
                    ? "w-[64px] h-[36px] bg-gradient-to-r from-[#00D2FF] to-[#FF4DA6] rounded-full shadow-[0_4px_14px_rgba(255,77,166,0.25)] text-[#FFFFFF] font-bold text-[19px] scale-110" 
                    : "text-[#7A8599] font-medium text-[17px] opacity-60 scale-95 hover:opacity-100 hover:scale-100"
                )}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const NEPALI_MONTH_NAMES = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

function parseBsInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new NepaliDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.toJsDate().getTime()) ? null : date;
}

function formatBsParts(year: number, month: number, day: number) {
  return [year, String(month + 1).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

function parseBsMonthInput(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year: Number(match[1]), month };
}

function formatBsMonthParts(year: number, month: number) {
  return [year, String(month + 1).padStart(2, "0")].join("-");
}

function formatTimeParts(date: Date) {
  return [String(date.getHours()).padStart(2, "0"), String(date.getMinutes()).padStart(2, "0")].join(":");
}

function parseTimeInput(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return ["09", "00"];
  return [match[1], match[2]];
}

function getMonthDays(year: number, month: number) {
  const firstDay = new NepaliDate(year, month, 1).toJsDate().getDay();
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const lastDayAd = new NepaliDate(nextMonthYear, nextMonth, 1).toJsDate();
  lastDayAd.setDate(lastDayAd.getDate() - 1);

  return {
    firstWeekday: firstDay,
    totalDays: getNepaliDate(lastDayAd).getDate(),
  };
}
