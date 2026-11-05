import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Plus,
  Pencil,
  Users,
  Timer,
  CheckCircle2,
  AlertCircle,
  Coffee,
  CalendarDays,
  Loader2,
  Sparkles,
  ShieldCheck,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Shift,
  DEFAULT_MORNING_SHIFT,
  DEFAULT_AFTERNOON_SHIFT,
  fetchAllShifts,
  formatTime12Hour,
  getShiftExpectedHours,
  parseTimeString,
} from "@/lib/attendance-engine";

export const Route = createFileRoute("/_app/admin/shifts")({
  component: ShiftManagementPage,
});

const ALL_WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ShiftForm = {
  id?: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_period_mins: number;
  checkout_grace_period_mins: number;
  break_duration_mins: number;
  working_days: string[];
  description: string;
  is_active: boolean;
  is_default: boolean;
};

const DEFAULT_FORM: ShiftForm = {
  name: "",
  code: "",
  start_time: "09:00",
  end_time: "18:00",
  grace_period_mins: 10,
  checkout_grace_period_mins: 0,
  break_duration_mins: 60,
  working_days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  description: "",
  is_active: true,
  is_default: false,
};

function ShiftManagementPage() {
  const { isAdmin } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [employeeShiftIdsByUser, setEmployeeShiftIdsByUser] = useState<Record<string, string>>({});

  // Dialog states
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ShiftForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // View employees assigned to shift
  const [selectedShiftForStaff, setSelectedShiftForStaff] = useState<Shift | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsData, assignmentsRes, profilesRes] = await Promise.all([
        fetchAllShifts(),
        supabase
          .from("employee_shift_assignments")
          .select("shift_id, user_id, status, effective_from, effective_to")
          .in("status", ["active", "temporary"])
          .order("effective_from", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, full_name, email, department, position, employee_code")
          .eq("approval_status", "approved")
          .order("full_name"),
      ]);

      setShifts(shiftsData);
      setAllEmployees(profilesRes.data ?? []);

      // Map each approved employee to their current shift or the default shift.
      const today = format(new Date(), "yyyy-MM-dd");
      const currentAssignments = (assignmentsRes.data ?? []).filter(
        (a: any) => a.effective_from <= today && (!a.effective_to || a.effective_to >= today),
      );
      const defaultShift =
        shiftsData.find((shift) => shift.is_default) ||
        shiftsData.find((shift) => shift.code === "SHIFT_A");
      const shiftIdsByUser: Record<string, string> = {};
      const counts: Record<string, number> = {};
      for (const employee of profilesRes.data ?? []) {
        const assignment = currentAssignments.find((a: any) => a.user_id === employee.user_id);
        const shiftId = assignment?.shift_id ?? defaultShift?.id;
        if (shiftId) {
          shiftIdsByUser[employee.user_id] = shiftId;
          counts[shiftId] = (counts[shiftId] || 0) + 1;
        }
      }

      setEmployeeShiftIdsByUser(shiftIdsByUser);
      setEmployeeCounts(counts);
    } catch (err: any) {
      toast.error(err.message || "Failed to load shift configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setForm({
      ...DEFAULT_FORM,
      code: `SHIFT_${String.fromCharCode(65 + shifts.length)}`,
      name: `Shift ${String.fromCharCode(65 + shifts.length)}`,
    });
    setModalOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setIsEditing(true);
    setForm({
      id: shift.id,
      name: shift.name,
      code: shift.code,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      grace_period_mins: shift.grace_period_mins,
      checkout_grace_period_mins: shift.checkout_grace_period_mins || 0,
      break_duration_mins: shift.break_duration_mins,
      working_days: shift.working_days || [],
      description: shift.description || "",
      is_active: shift.is_active,
      is_default: shift.is_default,
    });
    setModalOpen(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      return toast.error("Shift name and code are required");
    }

    setSaving(true);
    try {
      const shiftPayload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
        end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
        grace_period_mins: Number(form.grace_period_mins) || 0,
        checkout_grace_period_mins: Number(form.checkout_grace_period_mins) || 0,
        break_duration_mins: Number(form.break_duration_mins) || 0,
        working_days: form.working_days,
        description: form.description.trim() || null,
        is_active: form.is_active,
        is_default: form.is_default,
      };

      if (isEditing && form.id) {
        const { error } = await supabase
          .from("shifts")
          .update(shiftPayload)
          .eq("id", form.id);
        if (error) throw error;
        toast.success(`Shift "${form.name}" updated successfully`);
      } else {
        const { error } = await supabase.from("shifts").insert(shiftPayload);
        if (error) throw error;
        toast.success(`New shift "${form.name}" created successfully`);
      }

      setModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const toggleShiftActive = async (shift: Shift) => {
    try {
      const nextActive = !shift.is_active;
      const { error } = await supabase
        .from("shifts")
        .update({ is_active: nextActive })
        .eq("id", shift.id);

      if (error) throw error;
      toast.success(
        nextActive
          ? `Shift "${shift.name}" activated`
          : `Shift "${shift.name}" deactivated`,
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update shift status");
    }
  };

  const viewShiftStaff = (shift: Shift) => {
    setSelectedShiftForStaff(shift);
    setStaffSearch("");
    setStaffModalOpen(true);
  };

  const getLateThresholdLabel = (shift: Shift) => {
    const { hour, minute } = parseTimeString(shift.start_time);
    const lateMin = minute + shift.grace_period_mins;
    const finalHour = hour + Math.floor(lateMin / 60);
    const finalMinute = lateMin % 60;
    const ampm = finalHour >= 12 ? "PM" : "AM";
    const hour12 = finalHour % 12 || 12;
    return `After ${String(hour12).padStart(2, "0")}:${String(finalMinute).padStart(2, "0")} ${ampm}`;
  };

  const filteredStaff = allEmployees.filter((employee) => {
    if (employeeShiftIdsByUser[employee.user_id] !== selectedShiftForStaff?.id) return false;
    const search = staffSearch.toLowerCase();
    return (
      !search ||
      employee.full_name?.toLowerCase().includes(search) ||
      employee.email?.toLowerCase().includes(search) ||
      employee.department?.toLowerCase().includes(search) ||
      employee.employee_code?.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <PageHeader
        title="Shift Management"
        subtitle="Configure flexible work shifts, reporting times, grace periods, and employee assignments"
        actions={
          <Button onClick={openCreateModal} className="neon-button rounded-lg">
            <Plus size={15} className="mr-1.5" />
            Add New Shift
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-muted-foreground">Total Shifts</div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 tabular-nums">{shifts.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Configured shifts in company</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-muted-foreground">Shift A (Morning)</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Timer size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 tabular-nums">
            {employeeCounts[shifts.find((s) => s.code === "SHIFT_A")?.id || ""] || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">09:00 AM – 06:00 PM (9 hrs)</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-muted-foreground">Shift B (Afternoon)</div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Coffee size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 tabular-nums">
            {employeeCounts[shifts.find((s) => s.code === "SHIFT_B")?.id || ""] || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">01:00 PM – 06:00 PM (5 hrs)</div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-medium text-muted-foreground">Common Closing</div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2 tabular-nums">06:00 PM</div>
          <div className="text-xs text-muted-foreground mt-1">Standard office closing time</div>
        </GlassCard>
      </div>

      {/* Shifts Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shifts.map((shift) => {
            const expectedDuration = getShiftExpectedHours(shift);
            const staffCount = employeeCounts[shift.id] || 0;

            return (
              <GlassCard
                key={shift.id}
                className={`relative overflow-hidden transition-all duration-200 border ${
                  shift.is_active ? "border-border/80" : "border-border/40 opacity-75"
                }`}
              >
                {/* Top header badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">{shift.name}</h3>
                      {shift.is_default && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          Default
                        </Badge>
                      )}
                      {!shift.is_active && (
                        <Badge variant="destructive" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      Code: {shift.code}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(shift)}
                      className="h-8 px-2.5 text-xs rounded-lg"
                    >
                      <Pencil size={12} className="mr-1" />
                      Edit
                    </Button>
                    <Switch
                      checked={shift.is_active}
                      onCheckedChange={() => toggleShiftActive(shift)}
                      title={shift.is_active ? "Deactivate shift" : "Activate shift"}
                    />
                  </div>
                </div>

                {/* Description */}
                {shift.description && (
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                    {shift.description}
                  </p>
                )}

                {/* Schedule Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 mb-4 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Reporting Time
                    </span>
                    <span className="font-semibold text-foreground text-sm tabular-nums">
                      {formatTime12Hour(shift.start_time)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Closing Time
                    </span>
                    <span className="font-semibold text-foreground text-sm tabular-nums">
                      {formatTime12Hour(shift.end_time)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Expected Duration
                    </span>
                    <span className="font-semibold text-foreground text-sm tabular-nums">
                      {expectedDuration} hrs
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Grace Period
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-medium">
                      {shift.grace_period_mins} mins
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Late Threshold
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 font-medium">
                      {getLateThresholdLabel(shift)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                      Break Time
                    </span>
                    <span className="font-medium text-foreground">
                      {shift.break_duration_mins ? `${shift.break_duration_mins} mins` : "None"}
                    </span>
                  </div>
                </div>

                {/* Working Days */}
                <div className="mb-4">
                  <div className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <CalendarDays size={12} />
                    Working Days ({shift.working_days?.length || 0} days/week):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALL_WEEK_DAYS.map((day) => {
                      const isWorking = shift.working_days?.includes(day);
                      return (
                        <span
                          key={day}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${
                            isWorking
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted/40 text-muted-foreground/50 border-border/40 line-through"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Bar: Assigned staff */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => viewShiftStaff(shift)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <Users size={14} className="text-primary" />
                    <span>
                      <strong className="text-foreground">{staffCount}</strong> assigned employees
                    </span>
                    <span className="text-[10px] text-primary group-hover:underline ml-1">
                      (View List →)
                    </span>
                  </button>

                  <Badge variant="outline" className="text-[11px] font-mono">
                    {shift.code}
                  </Badge>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT SHIFT DIALOG */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Shift Configuration" : "Create New Work Shift"}</DialogTitle>
            <DialogDescription>
              Configure shift reporting times, common closing time, grace periods, and working days.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveShift} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shift-name" className="text-xs">
                  Shift Name *
                </Label>
                <Input
                  id="shift-name"
                  placeholder="e.g. Shift A – Morning Shift"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shift-code" className="text-xs">
                  Shift Code *
                </Label>
                <Input
                  id="shift-code"
                  placeholder="e.g. SHIFT_A"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="uppercase font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time" className="text-xs">
                  Reporting Time (Check-in) *
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
                <span className="text-[10px] text-muted-foreground">
                  e.g. 09:00 AM (Morning) or 01:00 PM (Afternoon)
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="end-time" className="text-xs">
                  Closing Time (Check-out) *
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
                <span className="text-[10px] text-muted-foreground">
                  ASLENIX common closing time: 06:00 PM (18:00)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="grace-period" className="text-xs">
                  Arrival Grace (Mins)
                </Label>
                <Input
                  id="grace-period"
                  type="number"
                  min="0"
                  max="120"
                  value={form.grace_period_mins}
                  onChange={(e) => setForm({ ...form, grace_period_mins: Number(e.target.value) })}
                />
                <span className="text-[10px] text-muted-foreground">Default: 10 mins</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="checkout-grace" className="text-xs">
                  Early Grace (Mins)
                </Label>
                <Input
                  id="checkout-grace"
                  type="number"
                  min="0"
                  max="120"
                  value={form.checkout_grace_period_mins}
                  onChange={(e) => setForm({ ...form, checkout_grace_period_mins: Number(e.target.value) })}
                />
                <span className="text-[10px] text-muted-foreground">Departure tolerance</span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="break-mins" className="text-xs">
                  Break Duration (Mins)
                </Label>
                <Input
                  id="break-mins"
                  type="number"
                  min="0"
                  max="180"
                  value={form.break_duration_mins}
                  onChange={(e) => setForm({ ...form, break_duration_mins: Number(e.target.value) })}
                />
                <span className="text-[10px] text-muted-foreground">e.g. 60m lunch or 0</span>
              </div>
            </div>

            {/* Working Days */}
            <div className="space-y-1.5">
              <Label className="text-xs">Working Days</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_WEEK_DAYS.map((day) => {
                  const isChecked = form.working_days.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        const next = isChecked
                          ? form.working_days.filter((d) => d !== day)
                          : [...form.working_days, day];
                        setForm({ ...form, working_days: next });
                      }}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                        isChecked
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="shift-desc" className="text-xs">
                Description / Notes
              </Label>
              <Textarea
                id="shift-desc"
                placeholder="Optional notes or details about shift schedule..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Switch
                  id="shift-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="shift-active" className="text-xs cursor-pointer">
                  Shift is Active
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="shift-default"
                  checked={form.is_default}
                  onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
                />
                <Label htmlFor="shift-default" className="text-xs cursor-pointer">
                  Company Default Shift
                </Label>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="neon-button">
                {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Shift"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW ASSIGNED EMPLOYEES MODAL */}
      <Dialog open={staffModalOpen} onOpenChange={setStaffModalOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 pb-4 pt-6 pr-12 text-left">
            <DialogTitle className="flex items-center gap-3 text-base">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Users size={17} />
              </span>
              <span className="min-w-0">
                <span className="block truncate">
                  Employees Assigned to {selectedShiftForStaff?.name}
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {formatTime12Hour(selectedShiftForStaff?.start_time)} –{" "}
                  {formatTime12Hour(selectedShiftForStaff?.end_time)} ·{" "}
                  {getShiftExpectedHours(selectedShiftForStaff)} hrs
                </span>
              </span>
              <Badge variant="secondary" className="ml-auto shrink-0 tabular-nums">
                {filteredStaff.length}
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Search and view employees assigned to this shift.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by name, email, department, or employee ID..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="h-10 rounded-xl border-border/70 bg-background/70 pl-9 text-sm shadow-sm transition-colors focus-visible:border-primary/50"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {filteredStaff.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 text-center">
                  <Users size={22} className="text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">No employees found</p>
                  <p className="text-xs text-muted-foreground">
                    {staffSearch
                      ? "Try another search term."
                      : "There are no employees assigned to this shift yet."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStaff.map((emp) => (
                    <div
                      key={emp.user_id}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/[0.03] hover:shadow-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
                          <span>{emp.full_name}</span>
                          {emp.employee_code && (
                            <span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {emp.employee_code}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {emp.department || "No Department"} · {emp.position || "Employee"}
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className="shrink-0 gap-1.5 border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-400"
                      >
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/10 px-6 py-4">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setStaffModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
