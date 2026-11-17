import { supabase } from "@/integrations/supabase/client";

/**
 * Weekly Off Configuration:
 * 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
 * Default: 2 days off per week (Sunday and Saturday: [0, 6])
 */
export const DEFAULT_WEEKLY_OFF_DAYS: number[] = [0, 6]; // Sunday & Saturday
export const WEEKLY_OFF_DAY = 6; // Preserved for legacy single-day references
export const WEEKLY_OFF_LABEL = "Weekly off";

export interface DayOfWeekOption {
  index: number;
  name: string;
  shortName: string;
}

export const ALL_DAYS_OF_WEEK: DayOfWeekOption[] = [
  { index: 0, name: "Sunday", shortName: "Sun" },
  { index: 1, name: "Monday", shortName: "Mon" },
  { index: 2, name: "Tuesday", shortName: "Tue" },
  { index: 3, name: "Wednesday", shortName: "Wed" },
  { index: 4, name: "Thursday", shortName: "Thu" },
  { index: 5, name: "Friday", shortName: "Fri" },
  { index: 6, name: "Saturday", shortName: "Sat" },
];

const STORAGE_KEY = "aslenix_weekly_off_days";

/**
 * Retrieve the active weekly off days configured by admin.
 * Falls back to default [0, 6] (Sunday and Saturday).
 */
export function getWeeklyOffDays(): number[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((n) => Number(n)).sort((a, b) => a - b);
        }
      }
    } catch {
      // Fallback to default
    }
  }
  return DEFAULT_WEEKLY_OFF_DAYS;
}

/**
 * Save weekly off days locally and notify active components
 */
export function setWeeklyOffDays(days: number[]): void {
  const normalized = Array.from(new Set(days.map((n) => Number(n)))).sort((a, b) => a - b);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(
        new CustomEvent("aslenix_weekly_off_changed", { detail: normalized }),
      );
    } catch {
      // Ignore write errors
    }
  }
}

/**
 * Check if a given date is a weekly off day.
 */
export function isWeeklyOffDate(date: Date | string, customOffDays?: number[]): boolean {
  const dayIndex = getLocalDate(date).getDay();
  return isWeeklyOffDayIndex(dayIndex, customOffDays);
}

/**
 * Check if a day-of-week index (0 = Sun, 6 = Sat) is a weekly off day.
 */
export function isWeeklyOffDayIndex(dayIndex: number, customOffDays?: number[]): boolean {
  const offDays = customOffDays && customOffDays.length > 0 ? customOffDays : getWeeklyOffDays();
  return offDays.includes(dayIndex);
}

/**
 * Get human-readable description of weekly off schedule
 */
export function getWeeklyOffSummary(customOffDays?: number[]): {
  count: number;
  dayNames: string[];
  shortNames: string[];
  summary: string;
} {
  const offDays = customOffDays && customOffDays.length > 0 ? customOffDays : getWeeklyOffDays();
  const sorted = [...offDays].sort((a, b) => a - b);
  const matched = sorted.map((idx) => ALL_DAYS_OF_WEEK.find((d) => d.index === idx)!).filter(Boolean);
  const dayNames = matched.map((d) => d.name);
  const shortNames = matched.map((d) => d.shortName);

  let summary = "No weekly off";
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) {
    summary = "2 Days Off: Sunday & Saturday";
  } else if (sorted.length > 0) {
    summary = `${sorted.length} Day${sorted.length > 1 ? "s" : ""} Off: ${shortNames.join(", ")}`;
  }

  return {
    count: sorted.length,
    dayNames,
    shortNames,
    summary,
  };
}

/**
 * Convert Date or string to a local Date object safely.
 */
export function getLocalDate(date: Date | string): Date {
  if (date instanceof Date) return date;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  return new Date(date);
}

/**
 * Sync company weekly off configuration from the Supabase settings table.
 */
export async function syncWeeklyOffFromDatabase(): Promise<number[]> {
  try {
    const { data } = await supabase
      .from("settings")
      .select("weekly_off_days")
      .limit(1)
      .maybeSingle();

    if (data && Array.isArray((data as any).weekly_off_days)) {
      const dbDays = (data as any).weekly_off_days.map(Number);
      if (dbDays.length > 0) {
        setWeeklyOffDays(dbDays);
        return dbDays;
      }
    }
  } catch {
    // Column might not exist yet; falls back to local/default
  }
  return getWeeklyOffDays();
}
