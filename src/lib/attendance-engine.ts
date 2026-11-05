import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export type Shift = {
  id: string;
  code: string;
  name: string;
  start_time: string; // "HH:mm:ss" or "HH:mm"
  end_time: string; // "HH:mm:ss" or "HH:mm" (18:00:00)
  grace_period_mins: number;
  checkout_grace_period_mins: number;
  break_duration_mins: number;
  working_days: string[];
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type EmployeeShiftAssignment = {
  id: string;
  user_id: string;
  shift_id: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null; // YYYY-MM-DD or null
  assigned_by: string | null;
  status: "active" | "inactive" | "scheduled" | "temporary";
  is_temporary: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  shift?: Shift;
};

export const DEFAULT_MORNING_SHIFT: Shift = {
  id: "shift-morning-default",
  code: "SHIFT_A",
  name: "Shift A – Morning Shift",
  start_time: "09:00:00",
  end_time: "18:00:00",
  grace_period_mins: 10,
  checkout_grace_period_mins: 0,
  break_duration_mins: 60,
  working_days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  description: "Morning Shift: Reporting 09:00 AM, Closing 06:00 PM, 10 min grace period. Expected duration 9 hours.",
  is_active: true,
  is_default: true,
};

export const DEFAULT_AFTERNOON_SHIFT: Shift = {
  id: "shift-afternoon-default",
  code: "SHIFT_B",
  name: "Shift B – Afternoon Shift",
  start_time: "13:00:00",
  end_time: "18:00:00",
  grace_period_mins: 10,
  checkout_grace_period_mins: 0,
  break_duration_mins: 0,
  working_days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  description: "Afternoon Shift: Reporting 01:00 PM, Closing 06:00 PM, 10 min grace period. Expected duration 5 hours.",
  is_active: true,
  is_default: false,
};

const attendanceCutoffTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function isAttendanceCutoffPassed(date: Date = new Date()): boolean {
  return attendanceCutoffTimeFormatter.format(date) >= "14:00";
}

/**
 * Parses time string ("09:00:00", "09:00", "13:00") into hour and minute integers.
 */
export function parseTimeString(timeStr?: string | null): { hour: number; minute: number; second: number } {
  if (!timeStr) return { hour: 9, minute: 0, second: 0 };
  const parts = String(timeStr).split(":").map(Number);
  return {
    hour: Number.isFinite(parts[0]) ? parts[0] : 9,
    minute: Number.isFinite(parts[1]) ? parts[1] : 0,
    second: Number.isFinite(parts[2]) ? parts[2] : 0,
  };
}

/**
 * Formats a time string or Date into readable 12-hour format ("09:00 AM", "01:00 PM").
 */
export function formatTime12Hour(time: string | Date | null | undefined): string {
  if (!time) return "—";
  if (time instanceof Date) {
    return format(time, "hh:mm a");
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!match) return String(time);
  const hour = Number(match[1]);
  const minute = match[2];
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${minute} ${ampm}`;
}

/**
 * Computes expected working duration in hours for a shift.
 * (e.g. 09:00 to 18:00 = 9 hours, 13:00 to 18:00 = 5 hours)
 */
export function getShiftExpectedHours(shift?: Shift | null): number {
  if (!shift) return 9;
  const start = parseTimeString(shift.start_time);
  const end = parseTimeString(shift.end_time);
  const diffMinutes = end.hour * 60 + end.minute - (start.hour * 60 + start.minute);
  return Math.max(0, Math.round((diffMinutes / 60) * 10) / 10);
}

/**
 * Computes the late threshold time (Reporting Time + Grace Period) as a Date object for a given date.
 */
export function getLateThresholdDate(dateStr: string, shift: Shift): Date {
  const { hour, minute } = parseTimeString(shift.start_time);
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hour, minute + (shift.grace_period_mins || 0), 0, 0);
  return target;
}

/**
 * Computes the reporting start time as a Date object for a given date.
 */
export function getShiftStartDate(dateStr: string, shift: Shift): Date {
  const { hour, minute } = parseTimeString(shift.start_time);
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hour, minute, 0, 0);
  return target;
}

/**
 * Computes the shift scheduled closing time as a Date object for a given date.
 */
export function getShiftEndDate(dateStr: string, shift: Shift): Date {
  const { hour, minute } = parseTimeString(shift.end_time);
  const target = new Date(`${dateStr}T00:00:00`);
  target.setHours(hour, minute, 0, 0);
  return target;
}

/**
 * Check-in calculation result
 */
export type CheckInEvaluation = {
  status: "present" | "late";
  is_late: boolean;
  late_minutes: number;
  scheduled_check_in: string;
  scheduled_check_out: string;
  shift_id: string;
  shift_name_snapshot: string;
};

/**
 * Evaluates check-in time against the employee's assigned shift.
 *
 * Rules:
 * - Checks in before or exactly at scheduled reporting time + grace period -> Present, late_minutes = 0
 * - Checks in after scheduled reporting time + grace period -> Late, late_minutes = checkIn - reportingTime
 */
export function evaluateCheckIn(
  checkInDate: Date,
  dateStr: string,
  shift: Shift = DEFAULT_MORNING_SHIFT,
): CheckInEvaluation {
  const shiftStart = getShiftStartDate(dateStr, shift);
  const lateThreshold = getLateThresholdDate(dateStr, shift);
  const isLate = checkInDate.getTime() > lateThreshold.getTime();
  const lateMinutes = isLate
    ? Math.max(0, Math.round((checkInDate.getTime() - shiftStart.getTime()) / 60000))
    : 0;

  return {
    status: isLate ? "late" : "present",
    is_late: isLate,
    late_minutes: lateMinutes,
    scheduled_check_in: shift.start_time,
    scheduled_check_out: shift.end_time,
    shift_id: shift.id,
    shift_name_snapshot: shift.name,
  };
}

/**
 * Check-out calculation result
 */
export type CheckOutEvaluation = {
  is_early_checkout: boolean;
  early_checkout_minutes: number;
  total_working_minutes: number;
  work_hours: number;
  overtime_minutes: number;
};

/**
 * Evaluates check-out time against the employee's assigned shift.
 *
 * Rules:
 * - Checks out before scheduled closing time - checkout_grace_period -> is_early_checkout = true
 * - Checks out at or after scheduled closing time -> normal / overtime
 * - Calculates total hours and overtime duration
 */
export function evaluateCheckOut(
  checkInTimeStr: string | null | undefined,
  checkOutDate: Date,
  dateStr: string,
  shift: Shift = DEFAULT_MORNING_SHIFT,
): CheckOutEvaluation {
  const shiftEnd = getShiftEndDate(dateStr, shift);
  const earlyGrace = shift.checkout_grace_period_mins || 0;
  const earlyThresholdTime = shiftEnd.getTime() - earlyGrace * 60000;

  const isEarly = checkOutDate.getTime() < earlyThresholdTime;
  const earlyCheckoutMinutes = isEarly
    ? Math.max(0, Math.round((shiftEnd.getTime() - checkOutDate.getTime()) / 60000))
    : 0;

  const overtimeMinutes = checkOutDate.getTime() > shiftEnd.getTime()
    ? Math.max(0, Math.round((checkOutDate.getTime() - shiftEnd.getTime()) / 60000))
    : 0;

  let totalWorkingMinutes = 0;
  let workHours = 0;

  if (checkInTimeStr) {
    const checkedInAt = new Date(checkInTimeStr);
    if (!Number.isNaN(checkedInAt.getTime())) {
      totalWorkingMinutes = Math.max(0, Math.round((checkOutDate.getTime() - checkedInAt.getTime()) / 60000));
      workHours = Math.round((totalWorkingMinutes / 60) * 100) / 100;
    }
  }

  return {
    is_early_checkout: isEarly,
    early_checkout_minutes: earlyCheckoutMinutes,
    total_working_minutes: totalWorkingMinutes,
    work_hours: workHours,
    overtime_minutes: overtimeMinutes,
  };
}

/**
 * Fetches all available shifts from the database.
 */
export async function fetchAllShifts(): Promise<Shift[]> {
  try {
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      console.warn("Could not fetch shifts from DB, using fallback defaults", error);
      return [DEFAULT_MORNING_SHIFT, DEFAULT_AFTERNOON_SHIFT];
    }

    if (!data || data.length === 0) {
      return [DEFAULT_MORNING_SHIFT, DEFAULT_AFTERNOON_SHIFT];
    }

    return data as Shift[];
  } catch (err) {
    console.error("Error fetching shifts:", err);
    return [DEFAULT_MORNING_SHIFT, DEFAULT_AFTERNOON_SHIFT];
  }
}

/**
 * Fetches the active assigned shift for an employee on a given date.
 * If no specific assignment is found, falls back to the default shift (Shift A).
 */
export async function fetchEmployeeAssignedShift(
  userId: string,
  targetDate: string = format(new Date(), "yyyy-MM-dd"),
): Promise<{ shift: Shift; assignment: EmployeeShiftAssignment | null }> {
  try {
    const { data: assignments, error } = await supabase
      .from("employee_shift_assignments")
      .select("*, shift:shifts(*)")
      .eq("user_id", userId)
      .in("status", ["active", "temporary"])
      .lte("effective_from", targetDate)
      .order("is_temporary", { ascending: false })
      .order("effective_from", { ascending: false });

    if (!error && assignments && assignments.length > 0) {
      // Find the first assignment where targetDate <= effective_to (or effective_to is null)
      const validAssignment = assignments.find((a: any) => !a.effective_to || a.effective_to >= targetDate);
      if (validAssignment && validAssignment.shift) {
        return {
          shift: validAssignment.shift as Shift,
          assignment: validAssignment as EmployeeShiftAssignment,
        };
      }
    }

    // Fallback: Fetch default shift from database
    const { data: defaultShift } = await supabase
      .from("shifts")
      .select("*")
      .eq("is_default", true)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (defaultShift) {
      return { shift: defaultShift as Shift, assignment: null };
    }

    return { shift: DEFAULT_MORNING_SHIFT, assignment: null };
  } catch (err) {
    console.error("Error fetching employee assigned shift:", err);
    return { shift: DEFAULT_MORNING_SHIFT, assignment: null };
  }
}

/**
 * Fetches all shift assignments mapped by user_id for a given target date.
 */
export async function fetchAllEmployeeShiftMap(
  targetDate: string = format(new Date(), "yyyy-MM-dd"),
): Promise<Map<string, Shift>> {
  const map = new Map<string, Shift>();

  try {
    const [shiftsRes, assignmentsRes] = await Promise.all([
      supabase.from("shifts").select("*").eq("is_active", true),
      supabase
        .from("employee_shift_assignments")
        .select("*, shift:shifts(*)")
        .in("status", ["active", "temporary"])
        .lte("effective_from", targetDate)
        .order("is_temporary", { ascending: false })
        .order("effective_from", { ascending: false }),
    ]);

    const allShifts = (shiftsRes.data ?? []) as Shift[];
    const defaultShift =
      allShifts.find((s) => s.is_default) ||
      allShifts.find((s) => s.code === "SHIFT_A") ||
      DEFAULT_MORNING_SHIFT;

    const assignments = assignmentsRes.data ?? [];
    assignments.forEach((a: any) => {
      if (!map.has(a.user_id)) {
        if (!a.effective_to || a.effective_to >= targetDate) {
          if (a.shift) {
            map.set(a.user_id, a.shift as Shift);
          }
        }
      }
    });

    return map;
  } catch (err) {
    console.error("Error fetching shift map:", err);
    return map;
  }
}

/**
 * Assigns or updates a shift for an employee.
 * Ensures historical attendance records are never modified.
 */
export async function assignEmployeeShift({
  userId,
  shiftId,
  effectiveFrom,
  effectiveTo = null,
  isTemporary = false,
  notes = null,
  assignedBy,
}: {
  userId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isTemporary?: boolean;
  notes?: string | null;
  assignedBy?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // If setting a permanent active shift, close previous open assignments whose effective_from < effectiveFrom
    if (!isTemporary && !effectiveTo) {
      const dayBefore = new Date(`${effectiveFrom}T00:00:00`);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const closeDate = format(dayBefore, "yyyy-MM-dd");

      await supabase
        .from("employee_shift_assignments")
        .update({ effective_to: closeDate, status: "inactive" })
        .eq("user_id", userId)
        .is("effective_to", null)
        .lt("effective_from", effectiveFrom);
    }

    const { error } = await supabase.from("employee_shift_assignments").insert({
      user_id: userId,
      shift_id: shiftId,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      is_temporary: isTemporary,
      status: "active",
      notes,
      assigned_by: assignedBy,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to assign shift" };
  }
}
