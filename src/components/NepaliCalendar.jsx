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
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { BSDateInput } from "@/components/BSDateInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { WEEKLY_OFF_DAY } from "@/lib/weekly-off";
import { supabase } from "@/integrations/supabase/client";
import { bsInputToAdDateString, formatBsInput } from "@/lib/nepali-calendar";
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

function LegendItem({ icon: Icon, label, className }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
      <Icon size={13} className={cn("shrink-0", className)} />
      <span className="truncate">{label}</span>
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
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({
    bsDate: formatBsDate(initialYear, initialMonth, 1),
    endDate: formatBsDate(initialYear, initialMonth, 1),
    title: "",
  });
  const [editingIds, setEditingIds] = useState([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(true);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);
  const [holidayError, setHolidayError] = useState(null);
  const [holidayNotice, setHolidayNotice] = useState(null);
  const [holidayReloadKey, setHolidayReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadHolidays() {
      setIsLoadingHolidays(true);
      setHolidayError(null);

      const { data, error } = await supabase
        .from("holidays")
        .select("id, date, name")
        .eq("is_active", true)
        .order("date", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to load holidays", error);
        setHolidayError("Shared holidays could not be loaded.");
      } else {
        setHolidays((data ?? []).map(mapHolidayRow).sort(sortByBsDate));
      }

      setIsLoadingHolidays(false);
    }

    loadHolidays();

    return () => {
      isMounted = false;
    };
  }, [holidayReloadKey]);

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
  const monthHolidayGroups = buildHolidayGroups(holidays).filter((group) =>
    group.holidays.some((holiday) => days.some((day) => day?.bsDate === holiday.bsDate)),
  );
  const visibleDays = days.filter(Boolean);
  const holidayCount = visibleDays.filter((day) => holidaysByDate[day.bsDate]).length;
  const weeklyOffCount = visibleDays.filter((day) => day.weekday === WEEKLY_OFF_DAY).length;
  const selectedHoliday = holidaysByDate[form.bsDate];
  const monthRange = visibleDays.length
    ? `${format(visibleDays[0].adDate, "MMM d")} - ${format(visibleDays[visibleDays.length - 1].adDate, "MMM d, yyyy")}`
    : "";

  const goMonth = (delta) => {
    const next = getMonthMeta(visible.year, visible.month + delta);
    if (next) setVisible({ year: next.year, month: next.month });
  };

  const selectDay = (day) => {
    if (!day || !isAdmin) return;
    setForm({
      bsDate: day.bsDate,
      endDate: day.bsDate,
      title: holidaysByDate[day.bsDate]?.title ?? "",
    });
    setEditingIds(holidaysByDate[day.bsDate] ? [holidaysByDate[day.bsDate].id] : []);
  };

  const saveHoliday = async () => {
    const title = form.title.trim();
    if (!title || !isValidBsDate(form.bsDate)) return;

    const endDate = form.endDate ? (isValidBsDate(form.endDate) ? form.endDate : null) : form.bsDate;
    if (!endDate) {
      setHolidayError("The end date is invalid.");
      return;
    }

    if (endDate < form.bsDate) {
      setHolidayError("End date must be on or after the start date.");
      return;
    }

    const dateRange = buildBsDateRange(form.bsDate, endDate);
    if (!dateRange.length) {
      setHolidayError("Could not create the holiday range. Please try again.");
      return;
    }

    const adDates = dateRange.map((value) => bsInputToAdDateString(value)).filter(Boolean);
    if (!adDates.length) {
      setHolidayError("One or more selected dates are invalid.");
      return;
    }

    setHolidayError(null);
    setHolidayNotice(null);
    setIsSavingHoliday(true);

    if (editingIds.length) {
      const conflictingHoliday = holidays.find(
        (holiday) => !editingIds.includes(holiday.id) && dateRange.includes(holiday.bsDate),
      );
      if (conflictingHoliday) {
        setHolidayError(`${conflictingHoliday.bsDate} already has a different holiday.`);
        setIsSavingHoliday(false);
        return;
      }

      const rows = dateRange.map((bsDateValue) => ({
        date: bsInputToAdDateString(bsDateValue),
        name: title,
        is_active: true,
      }));
      const { data, error } = await supabase
        .from("holidays")
        .upsert(rows, { onConflict: "date" })
        .select("id, date, name");
      if (error) {
        console.error("Failed to update holiday", error);
        setHolidayError("Could not update the shared holiday. Please try again.");
        setIsSavingHoliday(false);
        return;
      }

      const datesToKeep = new Set(dateRange);
      const idsToRemove = holidays
        .filter((holiday) => editingIds.includes(holiday.id) && !datesToKeep.has(holiday.bsDate))
        .map((holiday) => holiday.id);
      if (idsToRemove.length) {
        const { error: deleteError } = await supabase.from("holidays").delete().in("id", idsToRemove);
        if (deleteError) {
          console.error("Failed to remove dates outside the updated holiday range", deleteError);
          setHolidayError("Holiday dates were saved, but old dates outside the updated range could not be removed.");
          setHolidays((items) => {
            const preserved = items.filter((item) => !dateRange.includes(item.bsDate));
            return [...preserved, ...(data ?? []).map(mapHolidayRow)].sort(sortByBsDate);
          });
          setIsSavingHoliday(false);
          setHolidayReloadKey((value) => value + 1);
          return;
        }
      }

      setHolidays((items) => {
        const preserved = items.filter(
          (item) => !editingIds.includes(item.id) && !dateRange.includes(item.bsDate),
        );
        return [...preserved, ...(data ?? []).map(mapHolidayRow)].sort(sortByBsDate);
      });
    } else {
      const rows = dateRange.map((bsDateValue) => ({
        date: bsInputToAdDateString(bsDateValue),
        name: title,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("holidays")
        .upsert(rows, { onConflict: "date" })
        .select("id, date, name");

      if (error) {
        console.error("Failed to save holiday", error);
        setHolidayError("Could not save the shared holiday. Please try again.");
        setIsSavingHoliday(false);
        return;
      }

      const inserted = (data ?? []).map(mapHolidayRow);
      setHolidays((items) => {
        const preserved = items.filter((item) => !dateRange.includes(item.bsDate));
        return [...preserved, ...inserted].sort(sortByBsDate);
      });
    }

    const dateLabel = dateRange.length > 1 ? `${form.bsDate} to ${endDate} BS` : `${form.bsDate} BS`;
    setHolidayNotice(`${dateLabel} holiday saved.`);
    setForm({
      bsDate: form.bsDate,
      endDate: form.bsDate,
      title: "",
    });
    setEditingIds([]);
    setIsSavingHoliday(false);
    setHolidayReloadKey((value) => value + 1);
  };

  const editHolidayGroup = (group) => {
    setForm({
      bsDate: group.startDate,
      endDate: group.endDate,
      title: group.title,
    });
    setEditingIds(group.holidays.map((holiday) => holiday.id));
  };

  const deleteHolidayGroup = async (group) => {
    setHolidayError(null);
    setHolidayNotice(null);
    setIsSavingHoliday(true);
    const ids = group.holidays.map((holiday) => holiday.id);
    const { error } = await supabase.from("holidays").delete().in("id", ids);

    if (error) {
      console.error("Failed to delete holiday", error);
      setHolidayError("Could not delete the shared holiday. Please try again.");
      setIsSavingHoliday(false);
      return;
    }

    setHolidays((items) => items.filter((item) => !ids.includes(item.id)));
    if (editingIds.some((id) => ids.includes(id))) {
      setEditingIds([]);
      setForm((current) => ({ ...current, title: "" }));
    }
    setHolidayNotice("Holiday range removed.");
    setIsSavingHoliday(false);
    setHolidayReloadKey((value) => value + 1);
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
          <CalendarStat label="Holidays" value={holidayCount} tone="red" />
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
                    holiday && "border-red-500/35 bg-red-500/10 text-red-500 shadow-[0_0_22px_-16px_rgba(239,68,68,0.45)]",
                    isWeeklyOff &&
                      "border-primary/45 bg-primary/10 text-primary shadow-[0_0_24px_-14px_var(--primary)]",
                    holiday && isSaturday && "border-red-500/45 bg-red-500/10",
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
                              ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                              : holiday
                                ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
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
          <LegendItem icon={Sparkles} label="Holiday" className="text-red-500" />
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
              <Sparkles size={13} className="shrink-0 text-red-500" />
              <span className="truncate">Holiday indicators</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 rounded-lg px-2 text-[11px]"
              onClick={() => setHolidayReloadKey((value) => value + 1)}
              disabled={isLoadingHolidays || isSavingHoliday}
            >
              <RefreshCw size={12} className="mr-1" />
              Refresh
            </Button>
          </div>
          {holidayError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {holidayError}
            </div>
          )}
          {holidayNotice && (
            <div className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-xs text-success">
              {holidayNotice}
            </div>
          )}
          {isLoadingHolidays ? (
            <div className="rounded-xl border border-dashed border-border bg-card/45 px-3 py-4 text-center text-xs text-muted-foreground shadow-[0_0_22px_-18px_var(--primary)] backdrop-blur-xl">
              Loading holidays...
            </div>
          ) : monthHolidayGroups.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {monthHolidayGroups.map((group) => (
                <div
                  key={group.holidays[0].id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card/45 px-3 py-2 text-xs shadow-[0_0_22px_-18px_var(--primary)] backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:border-red-500/25 hover:bg-red-500/10 hover:shadow-[0_0_28px_-14px_var(--primary)]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{group.title}</div>
                    <div className="text-muted-foreground">
                      {format(new Date(`${group.startAd}T00:00:00`), "MM/dd/yyyy")}
                      {group.startDate !== group.endDate &&
                        ` to ${format(new Date(`${group.endAd}T00:00:00`), "MM/dd/yyyy")}`}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg"
                        onClick={() => editHolidayGroup(group)}
                        disabled={isSavingHoliday}
                        aria-label={`Edit ${group.title} holiday range`}
                      >
                        <Edit3 size={12} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-destructive"
                        onClick={() => deleteHolidayGroup(group)}
                        disabled={isSavingHoliday}
                        aria-label={`Delete ${group.title} holiday range`}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
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
              Holiday controls
            </div>

            <div className="grid gap-2">
              <div>
                <Label className="text-[11px]">Start BS date</Label>
                <BSDateInput
                  value={form.bsDate}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      bsDate: value,
                      endDate: current.endDate && value <= current.endDate ? current.endDate : value,
                    }))
                  }
                  placeholder="2083-01-01"
                  inputClassName="h-9 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-[11px]">End BS date (optional)</Label>
                <BSDateInput
                  value={form.endDate}
                  onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
                  placeholder="2083-01-05"
                  inputClassName="h-9 rounded-xl"
                />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Leave empty for one day. Set both dates to save the same holiday name across a range.
                </div>
              </div>
              <div>
                <Label className="text-[11px]">Holiday name</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Festival or company holiday"
                  className="h-9 rounded-xl"
                />
                {selectedHoliday && !editingIds.length && (
                  <div className="mt-1 text-[11px] text-red-500">
                    Already marked as {selectedHoliday.title}. Saving will update this date.
                  </div>
                )}
              </div>
              <Button
                type="button"
                className="neon-button h-9 rounded-xl"
                onClick={saveHoliday}
                disabled={isSavingHoliday || !form.title.trim() || !isValidBsDate(form.bsDate)}
              >
                <Save size={13} className="mr-2" />
                {isSavingHoliday
                  ? "Saving..."
                  : editingIds.length || selectedHoliday
                    ? "Update holiday"
                    : "Add holiday"}
              </Button>
              {editingIds.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl"
                  onClick={() => {
                    setEditingIds([]);
                    setForm((current) => ({ ...current, endDate: current.bsDate, title: "" }));
                  }}
                  disabled={isSavingHoliday}
                >
                  Cancel edit
                </Button>
              )}
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

function buildBsDateRange(startDate, endDate) {
  const startAd = bsInputToAdDateString(startDate);
  const endAd = bsInputToAdDateString(endDate);
  if (!startAd || !endAd) return [];

  const start = new Date(`${startAd}T00:00:00`);
  const end = new Date(`${endAd}T00:00:00`);
  if (start > end) return [];

  const dates = [];
  const iterator = new Date(start);

  while (iterator <= end) {
    dates.push(formatBsInput(iterator));
    iterator.setDate(iterator.getDate() + 1);
  }

  return dates;
}

function buildHolidayGroups(holidays) {
  const sorted = [...holidays].sort(sortByBsDate);
  const groups = [];

  sorted.forEach((holiday) => {
    const adDate = bsInputToAdDateString(holiday.bsDate);
    if (!adDate) return;

    const previousGroup = groups[groups.length - 1];
    const previousHoliday = previousGroup?.holidays[previousGroup.holidays.length - 1];
    const previousAdDate = previousHoliday && bsInputToAdDateString(previousHoliday.bsDate);
    const expectedNext = previousAdDate ? new Date(`${previousAdDate}T00:00:00`) : null;
    if (expectedNext) expectedNext.setDate(expectedNext.getDate() + 1);
    const isConsecutive =
      expectedNext && format(expectedNext, "yyyy-MM-dd") === adDate;

    if (previousGroup && previousGroup.title === holiday.title && isConsecutive) {
      previousGroup.holidays.push(holiday);
      previousGroup.endDate = holiday.bsDate;
      previousGroup.endAd = adDate;
      return;
    }

    groups.push({
      title: holiday.title,
      startDate: holiday.bsDate,
      endDate: holiday.bsDate,
      startAd: adDate,
      endAd: adDate,
      holidays: [holiday],
    });
  });

  return groups;
}

function mapHolidayRow(row) {
  return {
    id: row.id,
    bsDate: formatBsInput(row.date),
    title: row.name,
  };
}

function sortByBsDate(a, b) {
  return a.bsDate.localeCompare(b.bsDate);
}
