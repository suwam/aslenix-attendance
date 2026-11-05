import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BSDateInput } from "@/components/BSDateInput";
import {
  Search,
  Mail,
  Phone,
  Briefcase,
  Loader2,
  Pencil,
  Check,
  Sparkles,
  Clock,
  Timer,
  History,
  Calendar,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DEPARTMENTS as DEPARTMENTS_LIST,
  DEPARTMENT_POSITIONS,
  ADMIN_DEPARTMENT_FILTERS,
} from "@/lib/departments";
import {
  Shift,
  EmployeeShiftAssignment,
  fetchAllShifts,
  formatTime12Hour,
  assignEmployeeShift,
  DEFAULT_MORNING_SHIFT,
} from "@/lib/attendance-engine";
import { formatBsInput, bsInputToAdDateString, formatNepaliDate } from "@/lib/nepali-calendar";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin/employees")({ component: EmployeesPage });

const FILTER_DEPARTMENTS = ADMIN_DEPARTMENT_FILTERS;

function EmployeesPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employeeShifts, setEmployeeShifts] = useState<Record<string, { shift: Shift; assignment: any }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [shiftFilter, setShiftFilter] = useState("All");

  // Role Edit state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editDept, setEditDept] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Shift Assignment state
  const [shiftModalUser, setShiftModalUser] = useState<any | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [bsEffectiveFrom, setBsEffectiveFrom] = useState(formatBsInput());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [bsEffectiveTo, setBsEffectiveTo] = useState(formatBsInput());
  const [isTemporary, setIsTemporary] = useState(false);
  const [shiftNotes, setShiftNotes] = useState("");
  const [savingShift, setSavingShift] = useState(false);
  const [userShiftHistory, setUserShiftHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: profs }, { data: roleRows }, shiftsData, { data: assignments }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("approval_status", "approved")
            .order("full_name"),
          supabase
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["admin", "super_admin", "hr_manager"]),
          fetchAllShifts(),
          supabase
            .from("employee_shift_assignments")
            .select("*, shift:shifts(*)")
            .in("status", ["active", "temporary"])
            .order("effective_from", { ascending: false }),
        ]);

      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
      const filteredEmployees = (profs ?? []).filter((user) => !adminUserIds.has(user.user_id));
      setUsers(filteredEmployees);
      setShifts(shiftsData);

      const defaultShift =
        shiftsData.find((s) => s.is_default) ||
        shiftsData.find((s) => s.code === "SHIFT_A") ||
        DEFAULT_MORNING_SHIFT;

      const today = format(new Date(), "yyyy-MM-dd");
      const shiftMap: Record<string, { shift: Shift; assignment: any }> = {};

      filteredEmployees.forEach((emp) => {
        const userAssignments = (assignments ?? []).filter((a: any) => a.user_id === emp.user_id);
        const activeAssignment = userAssignments.find(
          (a: any) => a.effective_from <= today && (!a.effective_to || a.effective_to >= today),
        );

        if (activeAssignment && activeAssignment.shift) {
          shiftMap[emp.user_id] = {
            shift: activeAssignment.shift as Shift,
            assignment: activeAssignment,
          };
        } else {
          shiftMap[emp.user_id] = {
            shift: defaultShift,
            assignment: null,
          };
        }
      });

      setEmployeeShifts(shiftMap);
    } catch (err: any) {
      toast.error(err.message || "Failed to load employee list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Edit Department / Role Modal
  const openEditModal = (u: any) => {
    setEditingUser(u);
    const d = u.department || "";
    setEditDept(d);
    setEditPosition(u.position || "");

    const isKnownDept = DEPARTMENTS_LIST.includes(d as any);
    setIsCustomDept(!isKnownDept && Boolean(d));

    const positions = DEPARTMENT_POSITIONS[d] || [];
    if (u.position && positions.length > 0 && !positions.includes(u.position)) {
      setIsCustomPosition(true);
    } else {
      setIsCustomPosition(false);
    }
  };

  const handleDeptChange = (newDept: string) => {
    if (newDept === "other") {
      setIsCustomDept(true);
      setIsCustomPosition(true);
      setEditDept("");
      setEditPosition("");
      return;
    }
    setIsCustomDept(false);
    setIsCustomPosition(false);
    setEditDept(newDept);
    const positions = DEPARTMENT_POSITIONS[newDept] || [];
    if (!positions.includes(editPosition)) {
      setEditPosition(positions[0] || "");
    }
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update({
        department: editDept,
        position: editPosition,
      })
      .eq("id", editingUser.id)
      .select()
      .maybeSingle();
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Employee department and position updated");
    setUsers((prev) =>
      prev.map((item) =>
        item.id === editingUser.id
          ? { ...item, ...(updatedProfile || { department: editDept, position: editPosition }) }
          : item,
      ),
    );
    setEditingUser(null);
  };

  // Open Shift Assignment Modal
  const openShiftModal = async (u: any) => {
    setShiftModalUser(u);
    const current = employeeShifts[u.user_id];
    setSelectedShiftId(current?.shift?.id || shifts[0]?.id || "");
    setBsEffectiveFrom(formatBsInput());
    setHasEndDate(false);
    setBsEffectiveTo(formatBsInput());
    setIsTemporary(current?.assignment?.is_temporary || false);
    setShiftNotes("");

    // Load assignment history for this user
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("employee_shift_assignments")
        .select("*, shift:shifts(*), assigner:profiles!assigned_by(full_name)")
        .eq("user_id", u.user_id)
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false });

      setUserShiftHistory(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveShiftAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftModalUser || !selectedShiftId) return;

    setSavingShift(true);
    const effectiveFromAd = bsInputToAdDateString(bsEffectiveFrom) || format(new Date(), "yyyy-MM-dd");
    const effectiveToAd = hasEndDate ? bsInputToAdDateString(bsEffectiveTo) : null;

    const res = await assignEmployeeShift({
      userId: shiftModalUser.user_id,
      shiftId: selectedShiftId,
      effectiveFrom: effectiveFromAd,
      effectiveTo: effectiveToAd,
      isTemporary,
      notes: shiftNotes.trim() || null,
      assignedBy: user?.id,
    });

    setSavingShift(false);
    if (!res.success) {
      toast.error(res.error || "Failed to update shift assignment");
      return;
    }

    const assignedShift = shifts.find((s) => s.id === selectedShiftId);
    toast.success(`Assigned ${assignedShift?.name || "shift"} to ${shiftModalUser.full_name}`);
    setShiftModalUser(null);
    await loadData();
  };

  const editAvailablePositions = editDept ? DEPARTMENT_POSITIONS[editDept] || [] : [];

  const filtered = users.filter((u) => {
    const matchesDept = dept === "All" || u.department === dept;
    const matchesSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.employee_code?.toLowerCase().includes(search.toLowerCase());

    const userShift = employeeShifts[u.user_id]?.shift;
    const matchesShift = shiftFilter === "All" || userShift?.id === shiftFilter || userShift?.code === shiftFilter;

    return matchesDept && matchesSearch && matchesShift;
  });

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${filtered.length} active ${filtered.length === 1 ? "employee" : "employees"} · Shift schedules & roles`}
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee ID…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Department Filter */}
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {FILTER_DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Shift Filter */}
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Shifts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Work Shifts</SelectItem>
              {shifts.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({formatTime12Hour(s.start_time)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          No employees found matching the selected filters.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((u) => {
            const shiftInfo = employeeShifts[u.user_id];
            const shift = shiftInfo?.shift || DEFAULT_MORNING_SHIFT;
            const assignment = shiftInfo?.assignment;
            const isMorning = shift.code === "SHIFT_A" || shift.start_time.startsWith("09");

            return (
              <GlassCard
                key={u.id}
                className="flex flex-col justify-between hover:scale-[1.01] transition-transform relative overflow-hidden"
              >
                <div>
                  <div className="flex flex-col items-center text-center">
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/40"
                      />
                    ) : (
                      <div
                        className="h-20 w-20 rounded-full flex items-center justify-center text-foreground text-xl font-bold"
                        style={{
                          background: "var(--gradient-brand)",
                          boxShadow: "var(--shadow-neon-red)",
                        }}
                      >
                        {u.full_name
                          ?.split(" ")
                          .map((s: string) => s[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="mt-3 font-semibold text-foreground text-base">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Briefcase size={12} className="text-primary" />
                      <span>{u.position || "—"}</span>
                    </div>

                    <div
                      className="text-xs px-2.5 py-1 rounded-full mt-2 font-medium"
                      style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}
                    >
                      {u.department || "Unassigned"}
                    </div>
                  </div>

                  {/* Assigned Shift Card Section */}
                  <div className="mt-4 p-2.5 rounded-xl border border-border/60 bg-muted/30">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Clock size={11} className="text-primary" />
                        Assigned Shift
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          isMorning
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}
                      >
                        {assignment?.is_temporary ? "Temporary" : "Active"}
                      </Badge>
                    </div>

                    <div className="text-xs font-semibold text-foreground">
                      {shift.name}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
                      <span>Reporting: <strong className="text-foreground">{formatTime12Hour(shift.start_time)}</strong></span>
                      <span>Closing: <strong className="text-foreground">{formatTime12Hour(shift.end_time)}</strong></span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 mt-1 border-t border-border/40 pt-1">
                      <span>Grace: {shift.grace_period_mins} mins</span>
                      <span>
                        Effective: {assignment?.effective_from ? formatNepaliDate(assignment.effective_from, "DD MMMM YYYY") : "Permanent"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="shrink-0" />
                        <span>{u.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {u.employee_code || "No ID"}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] rounded-lg gap-1 hover:border-primary/40 hover:text-primary transition"
                      onClick={() => openShiftModal(u)}
                    >
                      <Timer size={11} className="text-primary" />
                      Shift
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] rounded-lg gap-1 hover:border-primary/40 hover:text-primary transition"
                      onClick={() => openEditModal(u)}
                    >
                      <Pencil size={11} />
                      Role
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* SHIFT ASSIGNMENT MODAL */}
      <Dialog open={Boolean(shiftModalUser)} onOpenChange={(open) => !open && setShiftModalUser(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Timer size={19} className="text-primary" />
              Assign Work Shift Schedule
            </DialogTitle>
            <DialogDescription>
              Assign or update reporting shift for <span className="font-semibold text-foreground">{shiftModalUser?.full_name}</span>.
              Previous attendance records will be permanently preserved.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveShiftAssignment} className="space-y-4 py-2 text-xs">
            {/* Shift Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Shift *</Label>
              <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Choose a shift..." />
                </SelectTrigger>
                <SelectContent>
                  {shifts
                    .filter((s) => s.is_active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({formatTime12Hour(s.start_time)} – {formatTime12Hour(s.end_time)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedShiftId && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-muted-foreground mt-1 text-[11px] space-y-0.5">
                  {(() => {
                    const sel = shifts.find((s) => s.id === selectedShiftId);
                    if (!sel) return null;
                    return (
                      <>
                        <div className="text-foreground font-medium">{sel.name}</div>
                        <div>Reporting: {formatTime12Hour(sel.start_time)} · Closing: {formatTime12Hour(sel.end_time)}</div>
                        <div>Grace period: {sel.grace_period_mins} mins · Late after: {formatTime12Hour(new Date(`2000-01-01T${sel.start_time}`).getTime() + sel.grace_period_mins * 60000)}</div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Effective Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Effective From (BS) *</Label>
                <BSDateInput value={bsEffectiveFrom} onChange={setBsEffectiveFrom} />
                <span className="text-[10px] text-muted-foreground">
                  {formatNepaliDate(bsInputToAdDateString(bsEffectiveFrom) || new Date(), "ddd DD, MMMM YYYY")} BS
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Effective To (BS)</Label>
                  <label className="text-[10px] text-primary flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="rounded"
                    />
                    End date
                  </label>
                </div>
                {hasEndDate ? (
                  <>
                    <BSDateInput value={bsEffectiveTo} onChange={setBsEffectiveTo} />
                    <span className="text-[10px] text-muted-foreground">
                      {formatNepaliDate(bsInputToAdDateString(bsEffectiveTo) || new Date(), "ddd DD, MMMM YYYY")} BS
                    </span>
                  </>
                ) : (
                  <div className="h-9 flex items-center px-3 rounded-md bg-muted/30 border border-dashed border-border/80 text-[11px] text-muted-foreground">
                    Ongoing (Indefinite)
                  </div>
                )}
              </div>
            </div>

            {/* Temporary Assignment toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <div className="font-semibold text-foreground text-xs">Temporary Assignment</div>
                <div className="text-[10px] text-muted-foreground">
                  Temporary shift will automatically yield back after the end date.
                </div>
              </div>
              <Switch checked={isTemporary} onCheckedChange={setIsTemporary} />
            </div>

            {/* Notes / Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="shift-notes" className="text-xs font-semibold">
                Reason / Assignment Notes
              </Label>
              <Textarea
                id="shift-notes"
                placeholder="e.g. Moved to Afternoon shift for Project Alpha support..."
                rows={2}
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
              />
            </div>

            {/* Previous Shift History Audit Trail */}
            {userShiftHistory.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                  <History size={13} className="text-primary" />
                  Previous Shift Assignment History
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {userShiftHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-2 rounded-lg bg-muted/30 border border-border/50 text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{h.shift?.name || "Shift"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          From: {h.effective_from} · To: {h.effective_to || "Present"}
                          {h.notes ? ` · "${h.notes}"` : ""}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px]">
                        {h.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t border-border/60">
              <Button type="button" variant="outline" onClick={() => setShiftModalUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingShift} className="neon-button">
                {savingShift && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                Confirm Shift Assignment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ROLE MODAL */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles size={18} className="text-primary" />
              Edit Employee Department & Position
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Update workplace assignment for <span className="font-semibold text-foreground">{editingUser?.full_name}</span>.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase size={14} className="text-primary" />
                  Department
                </Label>
                {isCustomDept && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDept(false);
                      handleDeptChange(DEPARTMENTS_LIST[0]);
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Use standard department list
                  </button>
                )}
              </div>

              {!isCustomDept ? (
                <Select value={editDept} onValueChange={handleDeptChange}>
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS_LIST.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (Type custom department...)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. Research & Development, Marketing"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase size={14} className="text-primary" />
                  Position / Designation
                </Label>
                {isCustomPosition && (
                  <button
                    type="button"
                    onClick={() => setIsCustomPosition(false)}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Pick from suggested
                  </button>
                )}
              </div>

              {!isCustomPosition && editAvailablePositions.length > 0 ? (
                <Select
                  value={editPosition}
                  onValueChange={(val) => {
                    if (val === "other") {
                      setIsCustomPosition(true);
                    } else {
                      setEditPosition(val);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {editAvailablePositions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (Type custom position...)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. UI/UX Designer, Frontend Developer"
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              disabled={savingEdit}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={savingEdit}
              className="neon-button rounded-xl"
            >
              {savingEdit ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
