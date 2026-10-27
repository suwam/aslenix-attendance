import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import {
  CanteenPeriod,
  CanteenEmployee,
  CanteenHoliday,
  DayInfo,
  generatePeriodDays,
} from "@/lib/canteen";
import { CanteenLogSheet } from "@/components/canteen/CanteenLogSheet";
import { CanteenAdminControls } from "@/components/canteen/CanteenAdminControls";
import { toast } from "sonner";
import { Loader2, Utensils } from "lucide-react";
import { addDays, parseISO, format } from "date-fns";

export const Route = createFileRoute("/_app/canteen")({ component: CanteenPage });

function CanteenPage() {
  const { profile, user, isAdmin } = useAuth();

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<CanteenPeriod[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<CanteenPeriod | null>(null);
  const [employees, setEmployees] = useState<CanteenEmployee[]>([]);
  const [holidays, setHolidays] = useState<Record<number, CanteenHoliday>>({});
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [systemProfiles, setSystemProfiles] = useState<
    { user_id: string; full_name: string; email: string }[]
  >([]);

  const [highlightEmployeeId, setHighlightEmployeeId] = useState<string | null>(null);
  const [showTotalColumn, setShowTotalColumn] = useState<boolean>(true);

  // Load all initial canteen data
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch periods, employees, and profiles
      const [periodsRes, employeesRes, profilesRes] = await Promise.all([
        supabase.from("canteen_periods").select("*").order("start_date", { ascending: false }),
        supabase.from("canteen_employees").select("*").eq("is_active", true).order("serial_number", { ascending: true }),
        supabase.from("profiles").select("user_id, full_name, email").eq("approval_status", "approved"),
      ]);

      if (periodsRes.error) throw periodsRes.error;
      if (employeesRes.error) throw employeesRes.error;

      const loadedPeriods = (periodsRes.data ?? []) as CanteenPeriod[];
      const loadedEmployees = (employeesRes.data ?? []) as CanteenEmployee[];
      setPeriods(loadedPeriods);
      setEmployees(loadedEmployees);
      setSystemProfiles((profilesRes.data ?? []) as any);

      // Select active period or first period
      const active = loadedPeriods.find((p) => !p.is_locked) || loadedPeriods[0] || null;
      setCurrentPeriod(active);

      if (active) {
        await loadPeriodData(active.id);
      }
    } catch (err: any) {
      console.error("Error loading canteen initial data:", err);
      toast.error(err.message || "Failed to load canteen records");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load period specific holidays and attendance
  const loadPeriodData = async (periodId: string) => {
    try {
      const [holidaysRes, attendanceRes] = await Promise.all([
        supabase.from("canteen_holidays").select("*").eq("period_id", periodId),
        supabase.from("canteen_attendance").select("*").eq("period_id", periodId),
      ]);

      if (holidaysRes.error) throw holidaysRes.error;
      if (attendanceRes.error) throw attendanceRes.error;

      // Map holidays by day_index
      const holMap: Record<number, CanteenHoliday> = {};
      (holidaysRes.data ?? []).forEach((h: any) => {
        holMap[h.day_index] = h as CanteenHoliday;
      });
      setHolidays(holMap);

      // Map attendance by `${employee_id}_${date}`
      const attMap: Record<string, boolean> = {};
      (attendanceRes.data ?? []).forEach((a: any) => {
        if (a.ate) {
          attMap[`${a.employee_id}_${a.date}`] = true;
        }
      });
      setAttendance(attMap);
    } catch (err: any) {
      console.error("Error loading period data:", err);
      toast.error("Failed to load attendance records for this period");
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Generate 14 days for the current period
  const days: DayInfo[] = useMemo(() => {
    if (!currentPeriod) return [];
    return generatePeriodDays(currentPeriod.start_date);
  }, [currentPeriod]);

  // Check if current user can edit a given employee's attendance
  const canEditEmployee = useCallback(
    (emp: CanteenEmployee): boolean => {
      if (isAdmin) return true;
      if (!user) return false;

      // Link by user_id
      if (emp.user_id && emp.user_id === user.id) return true;

      // Link by full name match
      if (profile?.full_name && emp.name.trim().toLowerCase() === profile.full_name.trim().toLowerCase()) {
        return true;
      }

      return false;
    },
    [isAdmin, user, profile],
  );

  // Toggle attendance for an employee and date
  const handleToggleAttendance = async (
    employeeId: string,
    dateString: string,
    currentVal: boolean,
  ) => {
    if (!currentPeriod) return;

    if (currentPeriod.is_locked && !isAdmin) {
      toast.error("This canteen period is locked for edits.");
      return;
    }

    const key = `${employeeId}_${dateString}`;
    const nextVal = !currentVal;

    // Optimistic UI update
    setAttendance((prev) => {
      const copy = { ...prev };
      if (nextVal) copy[key] = true;
      else delete copy[key];
      return copy;
    });

    try {
      if (nextVal) {
        // Upsert record
        const { error } = await supabase.from("canteen_attendance").upsert(
          {
            period_id: currentPeriod.id,
            employee_id: employeeId,
            date: dateString,
            ate: true,
            user_id: user?.id ?? null,
            marked_by: user?.id ?? null,
          },
          { onConflict: "period_id,employee_id,date" },
        );
        if (error) throw error;
      } else {
        // Delete or set false
        const { error } = await supabase
          .from("canteen_attendance")
          .delete()
          .match({ period_id: currentPeriod.id, employee_id: employeeId, date: dateString });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Attendance toggle error:", err);
      // Revert optimistic update
      setAttendance((prev) => {
        const copy = { ...prev };
        if (currentVal) copy[key] = true;
        else delete copy[key];
        return copy;
      });
      toast.error(err.message || "Failed to update attendance");
    }
  };

  // Switch period
  const handleSelectPeriod = async (periodId: string) => {
    const selected = periods.find((p) => p.id === periodId);
    if (!selected) return;
    setCurrentPeriod(selected);
    await loadPeriodData(selected.id);
  };

  // Create new period
  const handleCreatePeriod = async (data: {
    title: string;
    startDate: string;
    endDate: string;
    preparedBy: string;
    verifiedBy: string;
    holidayDayIndex: number;
  }) => {
    // 1. Insert Period
    const { data: newPeriod, error: pErr } = await supabase
      .from("canteen_periods")
      .insert({
        title: data.title,
        start_date: data.startDate,
        end_date: data.endDate,
        prepared_by: data.preparedBy,
        verified_by: data.verifiedBy,
        is_locked: false,
      })
      .select()
      .single();

    if (pErr) throw pErr;

    const start = parseISO(data.startDate);

    // 2. Insert Standard Holidays:
    // - Holiday on chosen day index (default day 3 / Wednesday)
    // - Week 1 Saturday Weekly Off (day 6)
    // - Week 2 Saturday Weekly Off (day 13)
    const holidaysToInsert = [
      {
        period_id: newPeriod.id,
        day_index: data.holidayDayIndex,
        date: format(addDays(start, data.holidayDayIndex), "yyyy-MM-dd"),
        type: "holiday",
        label: "HOLIDAY",
        is_enabled: true,
      },
      {
        period_id: newPeriod.id,
        day_index: 6,
        date: format(addDays(start, 6), "yyyy-MM-dd"),
        type: "weekly_off",
        label: "WEEKLY OFF",
        is_enabled: true,
      },
      {
        period_id: newPeriod.id,
        day_index: 13,
        date: format(addDays(start, 13), "yyyy-MM-dd"),
        type: "weekly_off",
        label: "WEEKLY OFF",
        is_enabled: true,
      },
    ];

    const { error: hErr } = await supabase.from("canteen_holidays").insert(holidaysToInsert);
    if (hErr) console.error("Error creating default holidays:", hErr);

    // Update state
    setPeriods((prev) => [newPeriod as CanteenPeriod, ...prev]);
    setCurrentPeriod(newPeriod as CanteenPeriod);
    await loadPeriodData(newPeriod.id);
  };

  // Toggle Lock status on current period
  const handleToggleLockPeriod = async () => {
    if (!currentPeriod) return;
    const nextLocked = !currentPeriod.is_locked;

    const { error } = await supabase
      .from("canteen_periods")
      .update({ is_locked: nextLocked })
      .eq("id", currentPeriod.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    const updated = { ...currentPeriod, is_locked: nextLocked };
    setCurrentPeriod(updated);
    setPeriods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    toast.success(nextLocked ? "Period locked successfully" : "Period unlocked successfully");
  };

  // Update Period footer signatures
  const handleUpdatePeriodDetails = async (preparedBy: string, verifiedBy: string) => {
    if (!currentPeriod) return;

    const { error } = await supabase
      .from("canteen_periods")
      .update({ prepared_by: preparedBy, verified_by: verifiedBy })
      .eq("id", currentPeriod.id);

    if (error) throw error;

    const updated = { ...currentPeriod, prepared_by: preparedBy, verified_by: verifiedBy };
    setCurrentPeriod(updated);
    setPeriods((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  // Employee Roster Management
  const handleAddEmployee = async (name: string, serialNumber: number, userId?: string | null) => {
    const { data: newEmp, error } = await supabase
      .from("canteen_employees")
      .insert({
        name,
        serial_number: serialNumber,
        user_id: userId || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    setEmployees((prev) =>
      [...prev, newEmp as CanteenEmployee].sort((a, b) => a.serial_number - b.serial_number),
    );
  };

  const handleUpdateEmployee = async (id: string, name: string, serialNumber: number) => {
    const { error } = await supabase
      .from("canteen_employees")
      .update({ name, serial_number: serialNumber })
      .eq("id", id);

    if (error) throw error;

    setEmployees((prev) =>
      prev
        .map((e) => (e.id === id ? { ...e, name, serial_number: serialNumber } : e))
        .sort((a, b) => a.serial_number - b.serial_number),
    );
  };

  const handleDeleteEmployee = async (id: string) => {
    const { error } = await supabase.from("canteen_employees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    setEmployees((prev) => prev.filter((e) => e.id !== id));
    toast.success("Employee removed from canteen roster");
  };

  const handleReorderEmployee = async (id: string, direction: "up" | "down") => {
    const idx = employees.findIndex((e) => e.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= employees.length) return;

    const currentEmp = employees[idx];
    const targetEmp = employees[targetIdx];

    const currentSerial = currentEmp.serial_number;
    const targetSerial = targetEmp.serial_number;

    // Swap serial numbers
    await Promise.all([
      supabase.from("canteen_employees").update({ serial_number: targetSerial }).eq("id", currentEmp.id),
      supabase.from("canteen_employees").update({ serial_number: currentSerial }).eq("id", targetEmp.id),
    ]);

    setEmployees((prev) => {
      const updated = [...prev];
      updated[idx] = { ...currentEmp, serial_number: targetSerial };
      updated[targetIdx] = { ...targetEmp, serial_number: currentSerial };
      return updated.sort((a, b) => a.serial_number - b.serial_number);
    });
  };

  // Sync registered staff into canteen roster
  const handleSyncRegisteredProfiles = async () => {
    const existingNames = new Set(employees.map((e) => e.name.trim().toLowerCase()));
    let nextSerial = employees.length ? Math.max(...employees.map((e) => e.serial_number)) + 1 : 1;

    const toInsert = systemProfiles
      .filter((p) => p.full_name && !existingNames.has(p.full_name.trim().toLowerCase()))
      .map((p) => ({
        name: p.full_name,
        user_id: p.user_id,
        serial_number: nextSerial++,
        is_active: true,
      }));

    if (toInsert.length === 0) {
      toast.info("All registered profiles are already in the canteen roster");
      return;
    }

    const { data, error } = await supabase
      .from("canteen_employees")
      .insert(toInsert)
      .select();

    if (error) {
      toast.error(error.message);
      return;
    }

    setEmployees((prev) => [...prev, ...(data as CanteenEmployee[])].sort((a, b) => a.serial_number - b.serial_number));
    toast.success(`Synced ${toInsert.length} new staff members into roster`);
  };

  // Save updated holidays for the period
  const handleSaveHolidayConfig = async (
    updatedHolidays: {
      dayIndex: number;
      type: "holiday" | "weekly_off" | "working";
      label: string;
      isEnabled: boolean;
    }[],
  ) => {
    if (!currentPeriod) return;

    // Remove existing holidays for this period
    await supabase.from("canteen_holidays").delete().eq("period_id", currentPeriod.id);

    const nonWorking = updatedHolidays.filter((h) => h.type !== "working");
    if (nonWorking.length > 0) {
      const start = parseISO(currentPeriod.start_date);
      const rows = nonWorking.map((h) => ({
        period_id: currentPeriod.id,
        day_index: h.dayIndex,
        date: format(addDays(start, h.dayIndex), "yyyy-MM-dd"),
        type: h.type as "holiday" | "weekly_off",
        label: h.label,
        is_enabled: h.isEnabled,
      }));

      const { error } = await supabase.from("canteen_holidays").insert(rows);
      if (error) throw error;
    }

    await loadPeriodData(currentPeriod.id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-muted-foreground">
        <Loader2 size={32} className="animate-spin text-primary mb-3" />
        <p className="text-sm font-semibold">Loading Canteen Attendance Sheet...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Canteen Attendance"
        subtitle="Official ASLENIX Tech and Solution Canteen Log Sheet"
        actions={
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Utensils size={13} className="text-primary" />
              {isAdmin ? "Admin View" : "Employee View"}
            </span>
          </div>
        }
      />

      {/* Admin Controls Toolbar (Export, Periods, Employee Roster, Holidays, Reports) */}
      <CanteenAdminControls
        periods={periods}
        currentPeriod={currentPeriod}
        onSelectPeriod={handleSelectPeriod}
        onCreatePeriod={handleCreatePeriod}
        onToggleLockPeriod={handleToggleLockPeriod}
        onUpdatePeriodDetails={handleUpdatePeriodDetails}
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onUpdateEmployee={handleUpdateEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onReorderEmployee={handleReorderEmployee}
        onSyncRegisteredProfiles={handleSyncRegisteredProfiles}
        days={days}
        holidays={holidays}
        onSaveHolidayConfig={handleSaveHolidayConfig}
        attendance={attendance}
        isAdmin={isAdmin}
        highlightEmployeeId={highlightEmployeeId}
        onHighlightEmployee={setHighlightEmployeeId}
        showTotalColumn={showTotalColumn}
        onToggleShowTotalColumn={() => setShowTotalColumn((prev) => !prev)}
        systemProfiles={systemProfiles}
      />

      {/* Exact Spreadsheet-Style Canteen Log Sheet */}
      {currentPeriod ? (
        <div className="w-full min-w-0 max-w-full">
          <CanteenLogSheet
            period={currentPeriod}
            employees={employees}
            days={days}
            holidays={holidays}
            attendance={attendance}
            onToggleAttendance={handleToggleAttendance}
            canEditEmployee={canEditEmployee}
            currentUserId={user?.id}
            currentUserName={profile?.full_name}
            isAdmin={isAdmin}
            highlightEmployeeId={highlightEmployeeId}
            showTotalColumn={showTotalColumn}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground bg-card">
          <Utensils size={36} className="mx-auto mb-2 text-muted-foreground/60" />
          <h3 className="font-bold text-foreground">No Canteen Periods Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first 2-week canteen attendance period to begin logging meals.
          </p>
        </div>
      )}
    </>
  );
}
