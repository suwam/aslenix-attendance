import React, { useState } from "react";
import {
  CanteenPeriod,
  CanteenEmployee,
  CanteenHoliday,
  DayInfo,
  exportCanteenSheetToPDF,
  exportCanteenSheetToExcel,
  exportCanteenSheetToCSV,
  WEEK_DAYS,
} from "@/lib/canteen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Plus,
  Printer,
  Sparkles,
  Unlock,
  Users,
  Utensils,
  BarChart3,
  CalendarCheck,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";

type CanteenAdminControlsProps = {
  periods: CanteenPeriod[];
  currentPeriod: CanteenPeriod | null;
  onSelectPeriod: (periodId: string) => void;
  onCreatePeriod: (data: {
    title: string;
    startDate: string;
    endDate: string;
    preparedBy: string;
    verifiedBy: string;
    holidayDayIndex: number;
  }) => Promise<void>;
  onToggleLockPeriod: () => Promise<void>;
  onUpdatePeriodDetails: (preparedBy: string, verifiedBy: string) => Promise<void>;
  employees: CanteenEmployee[];
  onAddEmployee: (name: string, serialNumber: number, userId?: string | null) => Promise<void>;
  onUpdateEmployee: (id: string, name: string, serialNumber: number) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onReorderEmployee: (id: string, direction: "up" | "down") => Promise<void>;
  onSyncRegisteredProfiles: () => Promise<void>;
  days: DayInfo[];
  holidays: Record<number, CanteenHoliday>;
  onSaveHolidayConfig: (updatedHolidays: { dayIndex: number; type: "holiday" | "weekly_off" | "working"; label: string; isEnabled: boolean }[]) => Promise<void>;
  attendance: Record<string, boolean>;
  isAdmin: boolean;
  highlightEmployeeId: string | null;
  onHighlightEmployee: (id: string | null) => void;
  showTotalColumn: boolean;
  onToggleShowTotalColumn: () => void;
  systemProfiles: { user_id: string; full_name: string; email: string }[];
};

export function CanteenAdminControls({
  periods,
  currentPeriod,
  onSelectPeriod,
  onCreatePeriod,
  onToggleLockPeriod,
  onUpdatePeriodDetails,
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onReorderEmployee,
  onSyncRegisteredProfiles,
  days,
  holidays,
  onSaveHolidayConfig,
  attendance,
  isAdmin,
  highlightEmployeeId,
  onHighlightEmployee,
  showTotalColumn,
  onToggleShowTotalColumn,
  systemProfiles,
}: CanteenAdminControlsProps) {
  // Modals state
  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [manageEmployeesOpen, setManageEmployeesOpen] = useState(false);
  const [holidayConfigOpen, setHolidayConfigOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editFooterOpen, setEditFooterOpen] = useState(false);

  // New Period Form
  const [newStartDate, setNewStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newPreparedBy, setNewPreparedBy] = useState("Suwam Subedi");
  const [newVerifiedBy, setNewVerifiedBy] = useState("");
  const [newHolidayDayIndex, setNewHolidayDayIndex] = useState(3); // Wednesday Week 1
  const [isCreatingPeriod, setIsCreatingPeriod] = useState(false);

  // Add/Edit Employee Form
  const [empName, setEmpName] = useState("");
  const [empSerial, setEmpSerial] = useState(employees.length + 1);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("none");
  const [editingEmp, setEditingEmp] = useState<CanteenEmployee | null>(null);
  const [isSubmittingEmp, setIsSubmittingEmp] = useState(false);

  // Holiday config draft
  const [holidayDraft, setHolidayDraft] = useState<{
    dayIndex: number;
    type: "holiday" | "weekly_off" | "working";
    label: string;
    isEnabled: boolean;
  }[]>([]);

  // Footer edit form
  const [footerPrepared, setFooterPrepared] = useState(currentPeriod?.prepared_by || "Suwam Subedi");
  const [footerVerified, setFooterVerified] = useState(currentPeriod?.verified_by || "");
  const [isSavingFooter, setIsSavingFooter] = useState(false);

  // Export states
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Total meals count summary
  const totalMealsConsumed = Object.values(attendance).filter(Boolean).length;

  const handleOpenHolidayConfig = () => {
    const draft = days.map((d) => {
      const hol = holidays[d.dayIndex];
      return {
        dayIndex: d.dayIndex,
        type: hol ? hol.type : ("working" as const),
        label: hol ? hol.label : d.isSaturday ? "WEEKLY OFF" : "HOLIDAY",
        isEnabled: hol ? hol.is_enabled : false,
      };
    });
    setHolidayDraft(draft);
    setHolidayConfigOpen(true);
  };

  const handleSaveHolidays = async () => {
    await onSaveHolidayConfig(holidayDraft);
    setHolidayConfigOpen(false);
    toast.success("Holiday and Weekly-Off settings updated");
  };

  const handleCreatePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreatingPeriod(true);
      const start = parseISO(newStartDate);
      const end = addDays(start, 13);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");
      const title = `Canteen Log Sheet (${startStr.replaceAll("-", "/")} - ${endStr.replaceAll("-", "/")})`;

      await onCreatePeriod({
        title,
        startDate: startStr,
        endDate: endStr,
        preparedBy: newPreparedBy,
        verifiedBy: newVerifiedBy,
        holidayDayIndex: newHolidayDayIndex,
      });

      setNewPeriodOpen(false);
      toast.success("New 2-week canteen period created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create period");
    } finally {
      setIsCreatingPeriod(false);
    }
  };

  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim()) return toast.error("Employee name is required");

    try {
      setIsSubmittingEmp(true);
      if (editingEmp) {
        await onUpdateEmployee(editingEmp.id, empName.trim(), Number(empSerial));
        toast.success("Employee updated");
        setEditingEmp(null);
      } else {
        const uId = selectedProfileId === "none" ? null : selectedProfileId;
        await onAddEmployee(empName.trim(), Number(empSerial), uId);
        toast.success("Employee added to roster");
      }
      setEmpName("");
      setEmpSerial(employees.length + (editingEmp ? 1 : 2));
      setSelectedProfileId("none");
    } catch (err: any) {
      toast.error(err.message || "Failed to save employee");
    } finally {
      setIsSubmittingEmp(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      const filename = `ASLENIX_Canteen_Log_${currentPeriod?.start_date || "sheet"}.pdf`;
      await exportCanteenSheetToPDF("canteen-log-sheet", filename);
      toast.success("PDF exported successfully");
    } catch (err: any) {
      toast.error("Failed to export PDF: " + err.message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportExcel = () => {
    if (!currentPeriod) return;
    const filename = `ASLENIX_Canteen_Log_${currentPeriod.start_date}.xls`;
    exportCanteenSheetToExcel(currentPeriod, employees, days, holidays, attendance, filename);
    toast.success("Excel log sheet downloaded");
  };

  const handleExportCSV = () => {
    if (!currentPeriod) return;
    const filename = `ASLENIX_Canteen_Log_${currentPeriod.start_date}.csv`;
    exportCanteenSheetToCSV(currentPeriod, employees, days, holidays, attendance, filename);
    toast.success("CSV log sheet downloaded");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="no-print mb-5 space-y-3">
      {/* Top Bar: Period Selection & Main Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-sm">
        {/* Left: Period Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <CalendarDays size={15} className="text-primary" />
            <span>Period:</span>
          </div>

          <Select
            value={currentPeriod?.id || ""}
            onValueChange={onSelectPeriod}
          >
            <SelectTrigger className="w-[260px] sm:w-[320px] rounded-xl border-border bg-background text-xs sm:text-sm font-medium">
              <SelectValue placeholder="Select Canteen Period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.title} {p.is_locked ? "🔒 (Locked)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setNewPeriodOpen(true)}
              className="rounded-xl text-xs gap-1.5 hover:border-primary/40 hover:text-primary"
            >
              <Plus size={13} />
              New 2-Week Period
            </Button>
          )}

          {isAdmin && currentPeriod && (
            <Button
              size="sm"
              variant={currentPeriod.is_locked ? "destructive" : "outline"}
              onClick={onToggleLockPeriod}
              className={`rounded-xl text-xs gap-1.5 ${
                currentPeriod.is_locked
                  ? "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
                  : "hover:border-emerald-500/40 hover:text-emerald-500"
              }`}
            >
              {currentPeriod.is_locked ? (
                <>
                  <Unlock size={13} />
                  Reopen / Unlock
                </>
              ) : (
                <>
                  <Lock size={13} />
                  Lock Period
                </>
              )}
            </Button>
          )}
        </div>

        {/* Right: Export & Print Group */}
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="rounded-xl text-xs gap-1.5 hover:border-primary/40"
          >
            {isExportingPDF ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            Export PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            className="rounded-xl text-xs gap-1.5 hover:border-emerald-500/40 hover:text-emerald-600"
          >
            <FileSpreadsheet size={13} />
            Excel (.xls)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="rounded-xl text-xs gap-1.5"
          >
            <Download size={13} />
            CSV
          </Button>

          <Button
            size="sm"
            variant="default"
            onClick={handlePrint}
            className="neon-button rounded-xl text-xs gap-1.5"
          >
            <Printer size={13} />
            Print Sheet
          </Button>
        </div>
      </div>

      {/* Second Bar: Admin Management Controls (Employees, Holidays, Reports, Filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 p-3 text-xs">
        {/* Left: Administrative Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setManageEmployeesOpen(true)}
                className="rounded-xl text-xs gap-1.5 hover:border-primary/40"
              >
                <Users size={13} className="text-primary" />
                Manage Employees ({employees.length})
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenHolidayConfig}
                className="rounded-xl text-xs gap-1.5 hover:border-red-500/40 hover:text-red-600"
              >
                <CalendarCheck size={13} className="text-red-500" />
                Configure Holidays &amp; Offs
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFooterPrepared(currentPeriod?.prepared_by || "Suwam Subedi");
                  setFooterVerified(currentPeriod?.verified_by || "");
                  setEditFooterOpen(true);
                }}
                className="rounded-xl text-xs gap-1.5 hover:border-primary/40"
              >
                <Edit2 size={13} />
                Edit Signatures
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground font-medium">
              <Utensils size={14} className="text-primary" />
              <span>Click on your row to tick ✓ canteen attendance.</span>
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setReportOpen(true)}
            className="rounded-xl text-xs gap-1.5 hover:border-cyan-500/40 hover:text-cyan-600"
          >
            <BarChart3 size={13} className="text-cyan-500" />
            Total Meals: <span className="font-bold text-foreground">{totalMealsConsumed}</span>
          </Button>
        </div>

        {/* Right: View Options & Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Highlight:</span>
            <Select
              value={highlightEmployeeId || "all"}
              onValueChange={(val) => onHighlightEmployee(val === "all" ? null : val)}
            >
              <SelectTrigger className="w-44 rounded-xl border-border bg-background text-xs h-8">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.serial_number}. {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTotalColumn}
              onChange={onToggleShowTotalColumn}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
            />
            <span>Show Total Column</span>
          </label>
        </div>
      </div>

      {/* =========================================================
          DIALOG: CREATE NEW 2-WEEK PERIOD
          ========================================================= */}
      <Dialog open={newPeriodOpen} onOpenChange={setNewPeriodOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays size={18} className="text-primary" />
              Create New Canteen Attendance Period
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreatePeriodSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Start Date (Sunday)</Label>
              <Input
                type="date"
                required
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="rounded-xl border-border"
              />
              <p className="text-[11px] text-muted-foreground">
                End date will be automatically set to 14 days later (
                {format(addDays(parseISO(newStartDate || format(new Date(), "yyyy-MM-dd")), 13), "yyyy/MM/dd")}).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Week 1 Holiday Day</Label>
              <Select
                value={String(newHolidayDayIndex)}
                onValueChange={(val) => setNewHolidayDayIndex(Number(val))}
              >
                <SelectTrigger className="rounded-xl border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Day 2 - Monday</SelectItem>
                  <SelectItem value="2">Day 3 - Tuesday</SelectItem>
                  <SelectItem value="3">Day 4 - Wednesday (Default)</SelectItem>
                  <SelectItem value="4">Day 5 - Thursday</SelectItem>
                  <SelectItem value="5">Day 6 - Friday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prepared By</Label>
                <Input
                  value={newPreparedBy}
                  onChange={(e) => setNewPreparedBy(e.target.value)}
                  placeholder="Suwam Subedi"
                  className="rounded-xl border-border"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Verified By</Label>
                <Input
                  value={newVerifiedBy}
                  onChange={(e) => setNewVerifiedBy(e.target.value)}
                  placeholder="Admin / Supervisor"
                  className="rounded-xl border-border"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewPeriodOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingPeriod}
                className="neon-button rounded-xl"
              >
                {isCreatingPeriod ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
                Create Period
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================
          DIALOG: MANAGE EMPLOYEES
          ========================================================= */}
      <Dialog open={manageEmployeesOpen} onOpenChange={setManageEmployeesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Users size={18} className="text-primary" />
              Manage Canteen Employee Roster
            </DialogTitle>
          </DialogHeader>

          {/* Add / Edit Form */}
          <form
            onSubmit={handleAddEmployeeSubmit}
            className="rounded-xl border border-border bg-background/50 p-3 space-y-3"
          >
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>{editingEmp ? "Edit Employee" : "Add New Employee to Roster"}</span>
              {editingEmp && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmp(null);
                    setEmpName("");
                    setEmpSerial(employees.length + 1);
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">Serial Number</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={empSerial}
                  onChange={(e) => setEmpSerial(Number(e.target.value))}
                  className="rounded-xl border-border h-9 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold">Full Name</Label>
                <Input
                  required
                  placeholder="e.g. Suwam Subedi"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="rounded-xl border-border h-9 text-xs"
                />
              </div>
            </div>

            {!editingEmp && (
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold">
                  Link with Registered Staff Profile (Optional)
                </Label>
                <Select
                  value={selectedProfileId}
                  onValueChange={(val) => {
                    setSelectedProfileId(val);
                    if (val !== "none") {
                      const match = systemProfiles.find((p) => p.user_id === val);
                      if (match && !empName) {
                        setEmpName(match.full_name);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border text-xs h-9">
                    <SelectValue placeholder="Select registered user..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Custom / External Diner)</SelectItem>
                    {systemProfiles.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.full_name} ({p.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSyncRegisteredProfiles}
                className="text-xs rounded-lg"
              >
                Sync with System Profiles
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingEmp}
                className="neon-button rounded-lg text-xs"
              >
                {editingEmp ? "Update Employee" : "Add to Roster"}
              </Button>
            </div>
          </form>

          {/* Current Roster Table */}
          <div className="space-y-2 mt-2">
            <Label className="text-xs font-bold text-foreground">Current Employee Roster ({employees.length})</Label>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-2 w-12 text-center">SN</th>
                    <th className="p-2">Name</th>
                    <th className="p-2 w-28 text-center">Reorder</th>
                    <th className="p-2 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp, idx) => (
                    <tr key={emp.id} className="hover:bg-muted/40 transition">
                      <td className="p-2 text-center font-bold">{emp.serial_number}</td>
                      <td className="p-2 font-medium">{emp.name}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => onReorderEmployee(emp.id, "up")}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === employees.length - 1}
                            onClick={() => onReorderEmployee(emp.id, "down")}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmp(emp);
                              setEmpName(emp.name);
                              setEmpSerial(emp.serial_number);
                            }}
                            className="p-1 text-primary hover:bg-primary/10 rounded"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove ${emp.name} from canteen roster?`)) {
                                onDeleteEmployee(emp.id);
                              }
                            }}
                            className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setManageEmployeesOpen(false)}
              className="rounded-xl text-xs"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================
          DIALOG: CONFIGURE HOLIDAYS & WEEKLY OFFS
          ========================================================= */}
      <Dialog open={holidayConfigOpen} onOpenChange={setHolidayConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <CalendarCheck size={18} className="text-red-500" />
              Configure Holidays &amp; Weekly Offs (14 Days)
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Merged labels appear in bold red vertically spanning all employee rows, disabling regular eating checkmarks for that day.
            </p>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-2 w-20">Day</th>
                    <th className="p-2 w-24">Date</th>
                    <th className="p-2 w-36">Type</th>
                    <th className="p-2">Label on Sheet</th>
                    <th className="p-2 w-28 text-center">Merged Cell</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holidayDraft.map((item, i) => {
                    const dayObj = days[i];
                    return (
                      <tr key={item.dayIndex} className="hover:bg-muted/40">
                        <td className="p-2 font-bold">
                          Week {dayObj.weekNumber} - {dayObj.dayName}
                        </td>
                        <td className="p-2 text-muted-foreground">{dayObj.displayDate}</td>
                        <td className="p-2">
                          <Select
                            value={item.type}
                            onValueChange={(val: any) => {
                              const updated = [...holidayDraft];
                              updated[i].type = val;
                              if (val === "weekly_off") {
                                updated[i].label = "WEEKLY OFF";
                                updated[i].isEnabled = true;
                              } else if (val === "holiday") {
                                updated[i].label = "HOLIDAY";
                                updated[i].isEnabled = true;
                              } else {
                                updated[i].isEnabled = false;
                              }
                              setHolidayDraft(updated);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs rounded-lg border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="working" className="text-xs">Working Day</SelectItem>
                              <SelectItem value="holiday" className="text-xs text-red-500 font-semibold">Holiday</SelectItem>
                              <SelectItem value="weekly_off" className="text-xs text-orange-500 font-semibold">Weekly Off</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            disabled={item.type === "working"}
                            value={item.label}
                            onChange={(e) => {
                              const updated = [...holidayDraft];
                              updated[i].label = e.target.value;
                              setHolidayDraft(updated);
                            }}
                            className="h-7 text-xs rounded-lg border-border"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            disabled={item.type === "working"}
                            checked={item.isEnabled}
                            onChange={(e) => {
                              const updated = [...holidayDraft];
                              updated[i].isEnabled = e.target.checked;
                              setHolidayDraft(updated);
                            }}
                            className="rounded border-border text-red-500 focus:ring-red-500 h-4 w-4"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHolidayConfigOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveHolidays}
              className="neon-button rounded-xl text-xs"
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================
          DIALOG: TOTAL MEALS REPORT & BREAKDOWN
          ========================================================= */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <BarChart3 size={18} className="text-cyan-500" />
              Canteen Meals Report
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Period: {currentPeriod?.title}
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <div className="text-xs text-muted-foreground">Total Meals Consumed</div>
                <div className="text-3xl font-black text-primary mt-1">{totalMealsConsumed}</div>
              </div>
              <div className="rounded-xl border border-border bg-background p-3 text-center">
                <div className="text-xs text-muted-foreground">Active Diners</div>
                <div className="text-3xl font-black text-foreground mt-1">{employees.length}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="p-2 w-12 text-center">SN</th>
                    <th className="p-2">Employee Name</th>
                    <th className="p-2 text-right">Meals Ate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {employees.map((emp) => {
                    let count = 0;
                    days.forEach((d) => {
                      if (attendance[`${emp.id}_${d.dateString}`]) count++;
                    });
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="p-2 text-center font-bold">{emp.serial_number}</td>
                        <td className="p-2 font-medium">{emp.name}</td>
                        <td className="p-2 text-right font-black text-primary">{count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setReportOpen(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================
          DIALOG: EDIT FOOTER SIGNATURES
          ========================================================= */}
      <Dialog open={editFooterOpen} onOpenChange={setEditFooterOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Edit2 size={16} className="text-primary" />
              Configure Footer Signatures
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prepared By</Label>
              <Input
                value={footerPrepared}
                onChange={(e) => setFooterPrepared(e.target.value)}
                placeholder="Suwam Subedi"
                className="rounded-xl border-border text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Verified By</Label>
              <Input
                value={footerVerified}
                onChange={(e) => setFooterVerified(e.target.value)}
                placeholder="e.g. Administrator Name"
                className="rounded-xl border-border text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditFooterOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSavingFooter}
              onClick={async () => {
                setIsSavingFooter(true);
                await onUpdatePeriodDetails(footerPrepared, footerVerified);
                setIsSavingFooter(false);
                setEditFooterOpen(false);
                toast.success("Footer signature details updated");
              }}
              className="neon-button rounded-xl text-xs"
            >
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
