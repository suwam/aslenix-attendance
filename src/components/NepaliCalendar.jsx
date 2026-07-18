import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Edit3,
  Flame,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format, startOfDay } from "date-fns";
import { BSDateInput } from "@/components/BSDateInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { WEEKLY_OFF_DAY } from "@/lib/weekly-off";
import NepaliDate from "nepali-date-converter";

const MONTHS = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Sawan",
  "Bhadra",
  "Ashoj",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_HOLIDAYS = [];

const HOLIDAY_KEY = "aslenix-nepali-calendar-admin-holidays";

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function getMonthMeta(year, month) {
  if (month < 0) return getMonthMeta(year - 1, 11);
  if (month > 11) return getMonthMeta(year + 1, 0);
  return { year, month };
}

function buildMonth(year, month) {
  const days = [];
  const firstDay = new NepaliDate(year, month, 1);
  const firstWeekday = firstDay.getDay();

  for (let i = 0; i < firstWeekday; i++) days.push(null);

  let d = 1;
  while (true) {
    const date = new NepaliDate(year, month, d);
    if (date.getMonth() !== month) break;
    days.push({
      bsDate: `${date.getYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      date: date.getDate(),
      weekday: date.getDay(),
      adDate: date.toJsDate(),
    });
    d++;
  }
  return days;
}

function formatBsDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isValidBsDate(bsDate) {
  try {
    const [y, m, d] = bsDate.split('-').map(Number);
    const date = new NepaliDate(y, m - 1, d);
    return date.getYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  } catch {
    return false;
  }
}

function CalendarStat({ label, value, tone }) {
  const tones = {
    blue: "text-blue-500",
    amber: "text-amber-500",
    red: "text-red-500",
  };
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/50 p-2 text-center">
      <span className={cn("text-xl font-black", tones[tone])}>{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function NepaliCalendar({ isAdmin = false, onHolidaysChange }) {
  const todayAd = useMemo(() => new Date(), []);
  const todayBs = useMemo(() => {
    const d = new NepaliDate(todayAd);
    return {
      year: d.getYear(),
      month: d.getMonth(),
      date: d.getDate(),
      formatted: d.format("YYYY MMMM DD"),
    };
  }, [todayAd]);

  const initialYear = todayBs?.year ?? 2083;
  const initialMonth = todayBs?.month ?? 0;

  const [visible, setVisible] = useState({ year: initialYear, month: initialMonth });
  const [holidays, setHolidays] = useLocalStorage(HOLIDAY_KEY, DEFAULT_HOLIDAYS);
  const [form, setForm] = useState({ bsDate: formatBsDate(initialYear, initialMonth, 1), title: "" });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    onHolidaysChange?.(holidays);
  }, [holidays, onHolidaysChange]);

  const days = useMemo(() => buildMonth(visible.year, visible.month), [visible]);
  const holidaysByDate = useMemo(() => {
    return holidays.reduce((map, holiday) => {
      map[holiday.bsDate] = holiday;
      return map;
    }, {});
  }, [holidays]);

  const todayKey = todayBs ? formatBsDate(todayBs.year, todayBs.month, todayBs.date) : "";
  const selectedMonthName = MONTHS[visible.month] ?? "Nepali Month";
  const canGoPrev = Boolean(getMonthMeta(visible.year, visible.month - 1));
  const canGoNext = Boolean(getMonthMeta(visible.year, visible.month + 1));
  const monthHolidays = days
    .filter((day) => day && holidaysByDate[day.bsDate])
    .map((day) => holidaysByDate[day.bsDate])
    .slice(0, 3);
  const visibleDays = days.filter(Boolean);
  const holidayCount = visibleDays.filter((day) => holidaysByDate[day.bsDate]).length;
  const weeklyOffCount = visibleDays.filter((day) => day.weekday === WEEKLY_OFF_DAY).length;
  const monthRange = visibleDays.length
    ? `${format(visibleDays[0].adDate, "MMM d")} - ${format(visibleDays[visibleDays.length - 1].adDate, "MMM d, yyyy")}`
    : "";

  const goMonth = (delta) => {
    const next = getMonthMeta(visible.year, visible.month + delta);
    if (next) setVisible({ year: next.year, month: next.month });
  };

  const selectDay = (day) => {
    if (!day || !isAdmin) return;
    setForm({ bsDate: day.bsDate, title: holidaysByDate[day.bsDate]?.title ?? "" });
    setEditingId(holidaysByDate[day.bsDate]?.id ?? null);
  };

  const saveHoliday = () => {
    const title = form.title.trim();
    if (!title || !isValidBsDate(form.bsDate)) return;

    if (editingId) {
      setHolidays((items) =>
        items.map((item) => (item.id === editingId ? { ...item, bsDate: form.bsDate, title } : item)),
      );
    } else {
      setHolidays((items) => [
        ...items.filter((item) => item.bsDate !== form.bsDate),
        { id: crypto.randomUUID(), bsDate: form.bsDate, title },
      ]);
    }
    setForm({ bsDate: form.bsDate, title: "" });
    setEditingId(null);
  };

  const editHoliday = (holiday) => {
    setForm({ bsDate: holiday.bsDate, title: holiday.title });
    setEditingId(holiday.id);
  };

  const deleteHoliday = (id) => {
    setHolidays((items) => items.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm((current) => ({ ...current, title: "" }));
    }
  };

  return (
    <GlassCard
      className="min-w-0 overflow-hidden border border-border bg-card/65 p-3 shadow-sm backdrop-blur-xl sm:p-5"
      glow="blue"
    >
      <div className="relative z-10">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
              <CalendarDays size={14} />
              Nepali Calendar
            </div>
            <h3 className="truncate text-2xl font-black leading-tight sm:text-3xl">
              {selectedMonthName} {visible.year} BS
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {todayBs
                ? `${todayBs.formatted} BS | ${format(todayAd, "MMM d, yyyy")} AD`
                : format(todayAd, "MMM d, yyyy")}
            </p>
            {monthRange && <p className="mt-1 text-xs text-muted-foreground">{monthRange} AD</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-border bg-card/50 shadow-[0_0_22px_-16px_var(--accent)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-accent/40 hover:shadow-[0_0_28px_-10px_var(--accent)]"
              disabled={!canGoPrev}
              onClick={() => goMonth(-1)}
              aria-label="Previous Nepali month"
            >
              <ChevronLeft size={15} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-border bg-card/50 shadow-[0_0_22px_-16px_var(--primary)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_0_28px_-10px_var(--primary)]"
              onClick={() => setVisible({ year: initialYear, month: initialMonth })}
              aria-label="Go to current Nepali month"
            >
              <Clock3 size={15} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-border bg-card/50 shadow-[0_0_22px_-16px_var(--accent)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:border-accent/40 hover:shadow-[0_0_28px_-10px_var(--accent)]"
              disabled={!canGoNext}
              onClick={() => goMonth(1)}
              aria-label="Next Nepali month"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <CalendarStat label="Days" value={visibleDays.length} tone="blue" />
          <CalendarStat label="Holidays" value={holidayCount} tone="amber" />
          <CalendarStat label="Weekly Off" value={weeklyOffCount} tone="red" />
        </div>

        <div className="rounded-xl border border-border bg-card/45 p-2 shadow-[0_0_30px_-22px_var(--primary),0_0_34px_-26px_var(--accent),inset_0_1px_0_oklch(1_0_0_/_0.08)] backdrop-blur-xl">
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={cn("py-2", index === 6 && "text-primary")}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid min-w-0 grid-cols-7 gap-1">
            {days.map((day, index) => {
              const holiday = day ? holidaysByDate[day.bsDate] : null;
              const isToday = day?.bsDate === todayKey;
              const isWeeklyOff = day?.weekday === WEEKLY_OFF_DAY;
              const isSaturday = isWeeklyOff;

              return (
                <button
                  key={day?.bsDate ?? `empty-${index}`}
                  type="button"
                  disabled={!day}
                  onClick={() => selectDay(day)}
                  title={holiday?.title}
                  className={cn(
                    "group relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border pb-2 text-xs backdrop-blur-xl transition-all duration-300 ease-out sm:min-h-14 sm:pb-2.5",
                    "border-border bg-card/45 shadow-[0_0_18px_-16px_var(--accent)] hover:-translate-y-1 hover:scale-[1.02] hover:border-primary/35 hover:bg-card hover:shadow-[0_0_30px_-10px_var(--primary),0_0_22px_-14px_var(--accent)]",
                    !day && "invisible",
                    isAdmin && day && "cursor-pointer",
                    isToday &&
                      "border-border bg-gradient-to-br from-pink-500/35 via-blue-500/30 to-purple-500/35 text-foreground shadow-[0_0_36px_-8px_rgba(236,72,153,0.55),0_0_30px_-10px_rgba(59,130,246,0.5),0_0_28px_-12px_rgba(168,85,247,0.5)] ring-1 ring-pink-300/35 animate-pulse-glow",
                    holiday && "border-warning/35 bg-warning/10 text-warning shadow-[0_0_22px_-16px_var(--warning)]",
                    isWeeklyOff &&
                      "border-primary/45 bg-primary/10 text-primary shadow-[0_0_24px_-14px_var(--primary)]",
                    holiday && isSaturday && "border-warning/45 bg-warning/10",
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "text-sm font-black leading-none tabular-nums sm:text-base",
                          isSaturday && "text-primary",
                          isToday && "text-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]",
                        )}
                      >
                        {day.date}
                      </span>
                      <span className="mt-1 text-[9px] font-medium leading-none text-muted-foreground">
                        {format(day.adDate, "d")}
                      </span>
                      {(holiday || isWeeklyOff) && (
                        <span
                          className={cn(
                            "absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full sm:bottom-1.5",
                            holiday && isSaturday
                              ? "bg-warning shadow-[0_0_10px_var(--warning)]"
                              : holiday
                                ? "bg-warning shadow-[0_0_10px_var(--warning)]"
                                : "bg-primary shadow-[0_0_10px_var(--primary)]",
                          )}
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <LegendItem icon={Flame} label="Today" className="text-primary" />
          <LegendItem icon={Sparkles} label="Holiday" className="text-warning" />
          <LegendItem icon={Circle} label="Weekly off" className="text-primary" />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card/45 p-3 shadow-[0_0_26px_-18px_var(--accent)] backdrop-blur-xl transition-all duration-300 ease-out hover:border-accent/25 hover:shadow-[0_0_30px_-12px_var(--accent)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Today
              </div>
              <div className="mt-1 truncate text-sm font-semibold">{todayBs?.formatted ?? "BS unavailable"}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              <div>{format(todayAd, "EEEE")}</div>
              <div>{format(todayAd, "MMM d, yyyy")} AD</div>
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Sparkles size={13} className="text-amber-300" />
            Holiday indicators
          </div>
          {monthHolidays.length > 0 ? (
            monthHolidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/45 px-3 py-2 text-xs shadow-[0_0_22px_-18px_var(--primary)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-warning/25 hover:bg-warning/10 hover:shadow-[0_0_28px_-14px_var(--primary)]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{holiday.title}</div>
                  <div className="text-muted-foreground">{holiday.bsDate} BS</div>
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg"
                      onClick={() => editHoliday(holiday)}
                      aria-label={`Edit ${holiday.title}`}
                    >
                      <Edit3 size={12} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-lg text-destructive"
                      onClick={() => deleteHoliday(holiday.id)}
                      aria-label={`Delete ${holiday.title}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/45 px-3 py-4 text-center text-xs text-muted-foreground shadow-[0_0_22px_-18px_var(--primary)] backdrop-blur-xl">
              No holidays marked this month.
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="mt-4 space-y-4 rounded-xl border border-accent/20 bg-card/45 p-3 shadow-[0_0_30px_-20px_var(--accent)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Plus size={13} className="text-accent" />
              Admin calendar controls
            </div>

            <div className="grid gap-2">
              <div>
                <Label className="text-[11px]">BS date</Label>
                <BSDateInput
                  value={form.bsDate}
                  onChange={(value) => setForm((current) => ({ ...current, bsDate: value }))}
                  placeholder="2083-01-01"
                  inputClassName="h-9 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-[11px]">Holiday name</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Festival or company holiday"
                  className="h-9 rounded-xl"
                />
              </div>
              <Button type="button" className="neon-button h-9 rounded-xl" onClick={saveHoliday}>
                <Save size={13} className="mr-2" />
                {editingId ? "Update holiday" : "Add holiday"}
              </Button>
            </div>

            <div>
              <Label className="text-[11px]">Weekly off</Label>
              <div className="mt-2 rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-[0_0_22px_-14px_var(--primary)]">
                Saturday for all employees
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );

}
