import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CreditCard,
  History,
  IdCard,
  Loader2,
  LogIn,
  LogOut,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Scanner } from "@yudiel/react-qr-scanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/card-reader-attendance")({
  component: CardReaderAttendancePage,
});

type EmployeeProfile = {
  user_id: string;
  full_name: string;
  employee_code: string | null;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  qr_token?: string | null;
  joining_date?: string | null;
};

type AttendanceSnapshot = {
  id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
  work_hours: number | null;
};

type ScanResult = {
  status: "employee_found" | "unknown_card" | "completed";
  message: string;
  card_uid: string;
  reader_id: string;
  reader_name: string;
  employee?: EmployeeProfile;
  attendance?: AttendanceSnapshot | null;
  available_action?: "check_in" | "check_out" | "completed";
};

type AuditEvent = {
  id: string;
  attendance_id: string | null;
  employee_id: string | null;
  employee_code: string | null;
  employee_name: string;
  admin_id: string | null;
  admin_name: string;
  action: string;
  attendance_method: string;
  card_uid: string;
  reader_id: string | null;
  reader_name: string | null;
  reason: string | null;
  created_at: string;
};

const DEFAULT_REASON = "Employee missed normal attendance";
const FORCE_REASONS = [
  "Forgot to check in",
  "ID card not registered",
  "Card reader/system issue",
  "Device issue",
  "Attendance correction",
  "Late attendance correction",
  "Other",
];
type AttendanceAction = "check_in" | "check_out";

function CardReaderAttendancePage() {
  const { isAdmin, profile, roles } = useAuth();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [readerId, setReaderId] = useState(
    () =>
      (typeof window !== "undefined" && window.localStorage.getItem("admin-card-reader-id")) ||
      "ADMIN-READER-01",
  );
  const [readerName, setReaderName] = useState(
    () =>
      (typeof window !== "undefined" && window.localStorage.getItem("admin-card-reader-name")) ||
      "Admin RFID/NFC Reader",
  );
  const [connected, setConnected] = useState(false);
  const [readerStatus, setReaderStatus] = useState<any>(null);
  const [scanValue, setScanValue] = useState("");
  const [lastRawCardUid, setLastRawCardUid] = useState("");
  const [lastScannedCard, setLastScannedCard] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingReader, setCheckingReader] = useState(false);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [registerEmployeeId, setRegisterEmployeeId] = useState("");
  const [history, setHistory] = useState<AuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AttendanceAction | null>(null);
  const [forceCheckIn, setForceCheckIn] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [forceOtherReason, setForceOtherReason] = useState("");
  const [now, setNow] = useState(() => new Date());

  const selectedRegisterEmployee = useMemo(
    () => employees.find((employee) => employee.user_id === registerEmployeeId),
    [employees, registerEmployeeId],
  );
  const detectedRegisterEmployee = useMemo(
    () => findEmployeeFromScannedValue(lastRawCardUid, employees),
    [employees, lastRawCardUid],
  );

  useEffect(() => {
    if (!isAdmin) return;
    loadEmployees();
    loadHistory();
  }, [isAdmin]);

  useEffect(() => {
    if (!connected) return;
    scanInputRef.current?.focus();
  }, [connected]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!unknownOpen || registerEmployeeId || !detectedRegisterEmployee) return;
    setRegisterEmployeeId(detectedRegisterEmployee.user_id);
  }, [detectedRegisterEmployee, registerEmployeeId, unknownOpen]);

  useEffect(() => {
    if (!scanResult?.employee) {
      setSelectedAction(null);
      setForceCheckIn(false);
      return;
    }

    if (scanResult.available_action === "check_in" || scanResult.available_action === "check_out") {
      setSelectedAction(scanResult.available_action);
    } else {
      setSelectedAction(null);
    }

    setForceCheckIn(false);
    setForceReason("");
    setForceOtherReason("");
  }, [scanResult?.employee?.user_id, scanResult?.available_action]);

  const loadEmployees = async () => {
    const [{ data, error }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,full_name,employee_code,department,position,avatar_url,qr_token,joining_date")
        .eq("approval_status", "approved")
        .eq("is_suspended", false)
        .order("full_name", { ascending: true }),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "super_admin", "hr_manager"]),
    ]);

    if (error) return toast.error(error.message);
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    setEmployees(
      ((data ?? []) as EmployeeProfile[]).filter((row) => !adminUserIds.has(row.user_id)),
    );
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_card_reader_audit_history");
    setHistoryLoading(false);
    if (error) return toast.error(error.message);
    setHistory((data ?? []) as AuditEvent[]);
  };

  const loadTodayAttendance = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("attendance")
      .select("id,date,status,check_in_time,check_out_time,work_hours")
      .eq("user_id", employeeId)
      .eq("date", format(new Date(), "yyyy-MM-dd"))
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      toast.error(error.message);
      return null;
    }

    return (data ?? null) as AttendanceSnapshot | null;
  };

  const checkReader = async () => {
    if (!readerId.trim()) return toast.error("Reader ID is required");
    setCheckingReader(true);
    const { data, error } = await (supabase as any).rpc("admin_card_reader_status", {
      _reader_id: readerId.trim(),
      _reader_name: readerName.trim() || "Admin RFID/NFC Reader",
    });
    setCheckingReader(false);
    if (error) {
      setConnected(false);
      return toast.error(error.message);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin-card-reader-id", readerId.trim());
      window.localStorage.setItem("admin-card-reader-name", readerName.trim());
    }
    setReaderStatus(data);
    setConnected(Boolean(data?.connected));
    toast.success("Card reader connected");
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const disconnectReader = () => {
    setConnected(false);
    setReaderStatus(null);
    setScanResult(null);
    setScanValue("");
  };

  const handleScanSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!connected) return toast.error("Connect the card reader first");
    const cardUid = scanValue.trim();
    if (!cardUid) return;
    await scanCard(cardUid);
  };

  const scanCard = async (cardUid: string) => {
    setBusy(true);
    setLastRawCardUid(cardUid);
    const { data, error } = await (supabase as any).rpc("admin_card_reader_scan", {
      _card_uid: cardUid,
      _reader_id: readerId.trim(),
      _reader_name: readerName.trim() || "Admin RFID/NFC Reader",
    });
    setBusy(false);
    setScanValue("");

    if (error) return toast.error(error.message);

    let result = enrichScanResult(data as ScanResult, employees);
    if (!result.employee) {
      const detectedEmployee = findEmployeeFromScannedValue(cardUid, employees);
      if (detectedEmployee) {
        const attendance = await loadTodayAttendance(detectedEmployee.user_id);
        result = {
          ...result,
          employee: detectedEmployee,
          attendance,
          available_action: deriveAvailableAction(attendance),
        };
      }
    }
    setScanResult(result);
    setLastScannedCard(result.card_uid);

    if (result.status === "unknown_card") {
      setUnknownOpen(true);
      toast.warning("Card not registered");
    } else if (result.status === "completed" || result.available_action === "completed") {
      toast.info("Attendance already completed for today");
    } else if (result.employee) {
      toast.success("Employee identified");
    }

    await loadHistory();
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const processAttendance = async () => {
    if (!scanResult?.employee) return toast.error("Scan an employee card first");

    const action = forceCheckIn ? "check_in" : selectedAction;
    if (!action) return toast.error("Choose an attendance action");

    const finalReason =
      forceCheckIn && forceReason === "Other"
        ? forceOtherReason.trim()
        : forceCheckIn
          ? forceReason
          : DEFAULT_REASON;

    if (forceCheckIn && !finalReason) {
      return toast.error("Reason is required for force check-in");
    }

    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_card_reader_record_attendance", {
      _employee_id: scanResult.employee.user_id,
      _card_uid: lastRawCardUid,
      _reader_id: readerId.trim(),
      _action: action,
      _reason: finalReason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const next = data as { attendance: AttendanceSnapshot; employee: EmployeeProfile };
    setScanResult({
      ...scanResult,
      employee: { ...scanResult.employee, ...next.employee },
      status: next.attendance.check_out_time ? "completed" : "employee_found",
      attendance: next.attendance,
      available_action: next.attendance.check_out_time ? "completed" : "check_out",
    });
    setForceCheckIn(false);
    setForceReason("");
    setForceOtherReason("");
    await loadHistory();
    
    toast.success(
      action === "check_in"
        ? `Checked in ${scanResult.employee.full_name}`
        : `Checked out ${scanResult.employee.full_name}`,
    );
  };

  const registerCard = async () => {
    if (!registerEmployeeId) return toast.error("Select an employee");
    if (!lastRawCardUid) return toast.error("Scan a card first");
    setBusy(true);
    const { error } = await (supabase as any).rpc("register_employee_card", {
      _employee_id: registerEmployeeId,
      _card_uid: lastRawCardUid,
      _reader_id: readerId.trim(),
      _reason: DEFAULT_REASON,
    });
    setBusy(false);
    if (error) return toast.error(error.message);

    setUnknownOpen(false);
    setRegisterEmployeeId("");
    toast.success(`Card registered to ${selectedRegisterEmployee?.full_name || "employee"}`);
    await loadHistory();
    await scanCard(lastRawCardUid);
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader
          title="Card Reader Attendance"
          subtitle="Restricted admin and HR attendance tool"
        />
        <GlassCard className="p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <div className="text-lg font-semibold">Admin access required</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Employees cannot access card reader attendance.
          </p>
        </GlassCard>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={scanResult?.employee ? "Employee Identified" : "Card Reader Attendance"}
        subtitle={
          scanResult?.employee
            ? "ID card scanned successfully and employee verified."
            : "Admin RFID/NFC attendance for missed employee check-ins and check-outs"
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <GlassCard className="p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Reader / Device Name</Label>
                  <Input
                    value={readerName}
                    onChange={(event) => setReaderName(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Reader ID</Label>
                  <Input value={readerId} onChange={(event) => setReaderId(event.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={checkReader} disabled={checkingReader}>
                  {checkingReader ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Radio className="mr-2 h-4 w-4" />
                  )}
                  Check Reader
                </Button>
                <Button variant="outline" onClick={disconnectReader} disabled={!connected}>
                  Disconnect
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <StatusTile
                label="Connection"
                value={connected ? "Connected" : "Disconnected"}
                icon={connected ? Wifi : WifiOff}
                tone={connected ? "text-emerald-600" : "text-destructive"}
              />
              <StatusTile label="Device" value={readerName || "-"} icon={CreditCard} />
              <StatusTile label="Reader ID" value={readerId || "-"} icon={BadgeCheck} />
              <StatusTile
                label="Last scanned card"
                value={compactCardLabel(lastScannedCard || readerStatus?.last_card_uid)}
                icon={History}
              />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">Scan Employee Card</div>
                <div className="text-sm text-muted-foreground">
                  {connected ? "Waiting for employee card..." : "Connect the reader to begin."}
                </div>
              </div>
              <Badge className={connected ? "bg-amber-100 text-amber-700" : ""} variant="outline">
                {connected ? "Waiting for Card" : "Reader Disconnected"}
              </Badge>
            </div>

            <form onSubmit={handleScanSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={(event) => setScanValue(event.target.value)}
                  disabled={!connected || busy}
                  className="h-11 pl-9"
                  placeholder="Waiting for employee card..."
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setCameraOpen(true)} disabled={!connected || busy}>
                  <Camera className="mr-2 h-4 w-4" />
                  Camera
                </Button>
                <Button type="submit" disabled={!connected || busy || !scanValue.trim()}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Process Scan
                </Button>
              </div>
            </form>
          </GlassCard>

          {scanResult?.employee && (
            <IdentifiedAttendanceWorkspace
              result={scanResult}
              connected={connected}
              selectedAction={selectedAction}
              setSelectedAction={setSelectedAction}
              forceCheckIn={forceCheckIn}
              setForceCheckIn={setForceCheckIn}
              forceReason={forceReason}
              setForceReason={setForceReason}
              forceOtherReason={forceOtherReason}
              setForceOtherReason={setForceOtherReason}
              now={now}
              busy={busy}
              adminName={profile?.full_name || "Administrator"}
              adminRole={formatAdminRole(roles)}
              onCancel={() => {
                setScanResult(null);
                setSelectedAction(null);
                setForceCheckIn(false);
                setForceReason("");
                setForceOtherReason("");
                requestAnimationFrame(() => scanInputRef.current?.focus());
              }}
              onConfirm={processAttendance}
            />
          )}

          {scanResult?.status === "unknown_card" && (
            <GlassCard className="border-destructive/30 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-1 h-5 w-5 text-destructive" />
                <div>
                  <div className="font-semibold text-destructive">Card not registered.</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Scanned card {compactCardLabel(scanResult.card_uid)} can be registered to an
                    active employee.
                  </p>
                  <Button className="mt-3" onClick={() => setUnknownOpen(true)}>
                    Register Card
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>

        <GlassCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Audit History</div>
              <div className="text-xs text-muted-foreground">Admin card reader attendance log</div>
            </div>
            <Button variant="outline" size="icon" onClick={loadHistory} disabled={historyLoading}>
              <RefreshCw className={`h-4 w-4 ${historyLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
            {history.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No card reader audit events yet.
              </div>
            ) : (
              history.map((event) => <AuditRow key={event.id} event={event} />)
            )}
          </div>
        </GlassCard>
      </div>

      <Dialog open={unknownOpen} onOpenChange={setUnknownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card Not Registered</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Scanned Card
              </div>
              <div className="mt-1 font-mono text-base font-semibold">
                {compactCardLabel(lastScannedCard)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Confirmed from reader scan. No manual card entry is required.
              </div>
            </div>
            {detectedRegisterEmployee ? (
              <div className="grid gap-2">
                <Label>Detected Employee</Label>
                <EmployeeIdentity employee={detectedRegisterEmployee} />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Confirm Employee</Label>
                <Select value={registerEmployeeId} onValueChange={setRegisterEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select active employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.user_id} value={employee.user_id}>
                        {employee.full_name}{" "}
                        {employee.employee_code ? `(${employee.employee_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  No employee match was found in the database for this scanned value.
                </div>
              </div>
            )}
            {selectedRegisterEmployee && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Ready to register and process attendance
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  <div>
                    Employee: {selectedRegisterEmployee.full_name}
                    {selectedRegisterEmployee.employee_code
                      ? ` (${selectedRegisterEmployee.employee_code})`
                      : ""}
                  </div>
                  <div>Card: {compactCardLabel(lastScannedCard)}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnknownOpen(false)}>
              Cancel
            </Button>
            <Button onClick={registerCard} disabled={busy || !registerEmployeeId}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Register & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan Employee QR Code</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg">
            {cameraOpen && (
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    setCameraOpen(false);
                    scanCard(result[0].rawValue);
                  }
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusTile({
  label,
  value,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  icon: typeof Wifi;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-4 w-4 ${tone}`} />
        {label}
      </div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function IdentifiedAttendanceWorkspace({
  result,
  connected,
  selectedAction,
  setSelectedAction,
  forceCheckIn,
  setForceCheckIn,
  forceReason,
  setForceReason,
  forceOtherReason,
  setForceOtherReason,
  now,
  busy,
  adminName,
  adminRole,
  onCancel,
  onConfirm,
}: {
  result: ScanResult;
  connected: boolean;
  selectedAction: AttendanceAction | null;
  setSelectedAction: (action: AttendanceAction | null) => void;
  forceCheckIn: boolean;
  setForceCheckIn: (enabled: boolean) => void;
  forceReason: string;
  setForceReason: (reason: string) => void;
  forceOtherReason: string;
  setForceOtherReason: (reason: string) => void;
  now: Date;
  busy: boolean;
  adminName: string;
  adminRole: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!result.employee) return null;

  const attendance = result.attendance;
  const cardRegistered = result.status !== "unknown_card";
  const checkedIn = Boolean(attendance?.check_in_time);
  const checkedOut = Boolean(attendance?.check_out_time);
  const completed = result.available_action === "completed" || checkedOut;
  const checkInEnabled = cardRegistered && !checkedIn && !completed;
  const checkOutEnabled = cardRegistered && checkedIn && !checkedOut && !completed;
  const forceReasonReady = !forceCheckIn || Boolean((forceReason === "Other" ? forceOtherReason : forceReason).trim());
  const canConfirm =
    !busy &&
    cardRegistered &&
    (forceCheckIn ? checkInEnabled && forceReasonReady : Boolean(selectedAction) && !completed);
  const confirmLabel = forceCheckIn
    ? "Confirm Force Check-In"
    : selectedAction === "check_out"
      ? "Confirm Check-Out"
      : "Confirm Check-In";

  return (
    <div className="space-y-5">
      <GlassCard className="overflow-hidden border-primary/15 p-0 shadow-[0_24px_80px_rgba(79,70,229,0.12)]">
        <div className="relative p-5 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-primary to-pink-500" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <IdCard className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-emerald-400/60" />
                <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-emerald-500" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Card Verified
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    Card: {compactCardLabel(result.card_uid)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("rounded-full", connected && "border-emerald-200 text-emerald-700")}
                  >
                    Reader: {connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Secure scan completed at {format(now, "d MMM yyyy, h:mm a")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">
              <Sparkles className="h-4 w-4" />
              Verification active
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <VerifiedProfileCard employee={result.employee} now={now} />
        <TodayAttendanceCard attendance={attendance} now={now} />
      </div>

      {!cardRegistered && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" />
            Card Not Registered
          </div>
          <p className="mt-1 text-amber-800">
            The employee was identified from database information, but this physical card must be
            registered before attendance can be processed.
          </p>
        </div>
      )}

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">Attendance Action</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            Choose how today's attendance should be processed.
          </div>
        </div>
        {completed ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              Attendance Completed
            </div>
            <p className="mt-1 text-emerald-700">
              This employee already has check-in and check-out recorded for today.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <ActionChoiceCard
              action="check_in"
              title="Check In"
              description="Mark today's attendance"
              meta={format(now, "h:mm a")}
              icon={CheckCircle2}
              enabled={checkInEnabled}
              selected={!forceCheckIn && selectedAction === "check_in"}
              onSelect={() => {
                setForceCheckIn(false);
                setSelectedAction("check_in");
              }}
            />
            <ActionChoiceCard
              action="check_out"
              title="Check Out"
              description="Complete today's attendance"
              meta={checkOutEnabled ? format(now, "h:mm a") : "Available after Check In"}
              icon={LogOut}
              enabled={checkOutEnabled}
              selected={!forceCheckIn && selectedAction === "check_out"}
              onSelect={() => {
                setForceCheckIn(false);
                setSelectedAction("check_out");
              }}
            />
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-muted-foreground">Force Check-In</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Use force check-in only when normal attendance processing is unavailable.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold">
            <Checkbox
              checked={forceCheckIn}
              disabled={!checkInEnabled || busy}
              onCheckedChange={(checked) => {
                const enabled = checked === true;
                setForceCheckIn(enabled);
                if (enabled) setSelectedAction(null);
              }}
            />
            Enable Force Check-In
          </label>
        </div>

        {forceCheckIn && (
          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label>Reason for Force Check-In *</Label>
              <Select value={forceReason} onValueChange={setForceReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {FORCE_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {forceReason === "Other" && (
              <div className="grid gap-2">
                <Label>Enter reason *</Label>
                <Textarea
                  value={forceOtherReason}
                  onChange={(event) => setForceOtherReason(event.target.value)}
                  placeholder="Write the reason here..."
                />
              </div>
            )}
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-5 w-5" />
                Administrative Override
              </div>
              <p className="mt-1 text-amber-800">
                Force check-in will be recorded in the attendance history with the selected reason
                and the admin who processed it.
              </p>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 text-xs font-bold uppercase text-muted-foreground">Processed By</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoPanel label="Admin Name" value={adminName} />
          <InfoPanel label="Admin Role" value={adminRole} />
          <InfoPanel label="Processed At" value={format(now, "d MMM yyyy 'at' h:mm a")} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className={cn("h-2.5 w-2.5 rounded-full", connected ? "bg-emerald-500" : "bg-destructive")} />
          Reader Status: {connected ? "Connected" : "Disconnected"}
        </div>
      </GlassCard>

      <div className="sticky bottom-4 z-10 rounded-2xl border border-border/70 bg-background/85 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {forceCheckIn
              ? "Force check-in requires a reason before confirmation."
              : !cardRegistered
                ? "Register this scanned card before processing attendance."
              : selectedAction
                ? `${humanizeAction(selectedAction)} selected for ${result.employee.full_name}.`
                : "Select an attendance action to continue."}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onConfirm} disabled={!canConfirm} className="min-w-44">
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : forceCheckIn ? (
                <Zap className="mr-2 h-4 w-4" />
              ) : selectedAction === "check_out" ? (
                <LogOut className="mr-2 h-4 w-4" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifiedProfileCard({ employee, now }: { employee: EmployeeProfile; now: Date }) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative mx-auto sm:mx-0">
          <Avatar className="h-28 w-28 border-4 border-white shadow-xl">
            <AvatarImage src={employee.avatar_url || ""} />
            <AvatarFallback className="text-2xl">{initials(employee.full_name)}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-4 border-background bg-emerald-500 text-white">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-bold text-foreground">{employee.full_name}</h2>
            <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Verified
            </Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoPanel label="Employee ID" value={employee.employee_code || "Not assigned"} />
            <InfoPanel label="Role" value={employee.position || "Employee"} />
            <InfoPanel label="Department" value={employee.department || "Unassigned"} />
            <InfoPanel label="Join Date" value={formatDate(employee.joining_date)} />
            <InfoPanel label="Status" value="Active" tone="success" />
          </div>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
        <div className="text-xs font-bold uppercase text-cyan-900">Verification Status</div>
        <div className="mt-2 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 font-semibold text-cyan-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Verified by ASLENIX
          </div>
          <div className="text-cyan-800">Last Verified: {format(now, "d MMM yyyy, h:mm a")}</div>
        </div>
      </div>
    </GlassCard>
  );
}

function TodayAttendanceCard({
  attendance,
  now,
}: {
  attendance?: AttendanceSnapshot | null;
  now: Date;
}) {
  const checkedIn = Boolean(attendance?.check_in_time);
  const checkedOut = Boolean(attendance?.check_out_time);
  const status = !checkedIn ? "Not Checked In" : checkedOut ? "Attendance Completed" : "Checked In";
  const previous = !checkedIn
    ? "No check-in recorded today"
    : checkedOut
      ? `Checked out at ${formatTime(attendance?.check_out_time)}`
      : `Checked in at ${formatTime(attendance?.check_in_time)}`;

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground">Today's Attendance</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{status}</div>
        </div>
        <Badge
          className={cn(
            "rounded-full px-3 py-1",
            checkedOut
              ? "bg-emerald-100 text-emerald-700"
              : checkedIn
                ? "bg-cyan-100 text-cyan-700"
                : "bg-slate-100 text-slate-700",
          )}
        >
          {checkedIn && !checkedOut ? "Live" : checkedOut ? "Done" : "Pending"}
        </Badge>
      </div>
      <div className="grid gap-3">
        <InfoPanel label="Date" value={format(now, "d MMM yyyy")} />
        <InfoPanel label="Scheduled" value="09:00 AM - 06:00 PM" />
        <InfoPanel label="Current Status" value={status} />
        <InfoPanel label="Previous Attendance" value={previous} />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoPanel label="Check-In" value={formatTime(attendance?.check_in_time)} />
          <InfoPanel label="Check-Out" value={formatTime(attendance?.check_out_time)} />
        </div>
      </div>
    </GlassCard>
  );
}

function ActionChoiceCard({
  action,
  title,
  description,
  meta,
  icon: Icon,
  enabled,
  selected,
  onSelect,
}: {
  action: AttendanceAction;
  title: string;
  description: string;
  meta: string;
  icon: typeof CheckCircle2;
  enabled: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onSelect}
      className={cn(
        "group min-h-40 rounded-3xl border p-5 text-left transition-all",
        "bg-background/70 shadow-sm",
        enabled && "hover:-translate-y-0.5 hover:shadow-xl",
        selected
          ? "border-primary bg-gradient-to-br from-primary/10 via-cyan-50 to-pink-50 shadow-[0_16px_50px_rgba(79,70,229,0.16)]"
          : "border-border/70",
        !enabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "grid h-12 w-12 place-items-center rounded-2xl",
            action === "check_in" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700",
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
      </div>
      <div className="mt-5 text-xl font-bold uppercase text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      <div className="mt-4 rounded-full bg-muted/70 px-3 py-1 text-sm font-semibold text-foreground">
        {meta}
      </div>
    </button>
  );
}

function InfoPanel({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="text-[11px] font-bold uppercase text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 break-words text-sm font-semibold text-foreground",
          tone === "success" && "text-emerald-700",
        )}
      >
        {tone === "success" ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function EmployeeIdentity({ employee }: { employee: EmployeeProfile }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-background/50 p-4">
      <Avatar className="h-16 w-16 border">
        <AvatarImage src={employee.avatar_url || ""} />
        <AvatarFallback>{initials(employee.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold">{employee.full_name}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          Employee ID: {employee.employee_code || "Not assigned"}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {employee.department || "Unassigned"} · {employee.position || "No designation"}
        </div>
      </div>
    </div>
  );
}

function AttendanceDetails({ attendance }: { attendance?: AttendanceSnapshot | null }) {
  const status = !attendance?.check_in_time
    ? "Not Checked In"
    : attendance.check_out_time
      ? "Completed"
      : "Checked In";
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-4">
      <div className="mb-3 text-sm font-semibold">Today's Attendance</div>
      <div className="grid gap-2 text-sm">
        <InfoRow label="Status" value={status} />
        <InfoRow label="Check-In" value={formatTime(attendance?.check_in_time)} />
        <InfoRow label="Check-Out" value={formatTime(attendance?.check_out_time)} />
        <InfoRow label="Attendance Status" value={attendance?.status || "-"} />
      </div>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const actionLabel = humanizeAction(event.action);
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {event.employee_code || "Unknown"} | {event.employee_name}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {actionLabel} | Admin Card Reader | Admin: {event.admin_name}
          </div>
          {event.reason && <div className="mt-1 text-xs text-muted-foreground">{event.reason}</div>}
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          {formatTime(event.created_at)}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return format(date, "h:mm a");
}

function formatDate(value?: string | null) {
  if (!value) return "Not assigned";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not assigned";
  return format(date, "d MMM yyyy");
}

function formatAdminRole(roles: string[]) {
  if (roles.includes("super_admin")) return "Super Admin";
  if (roles.includes("admin")) return "Admin";
  if (roles.includes("hr_manager")) return "HR Manager";
  return "Administrator";
}

function deriveAvailableAction(attendance?: AttendanceSnapshot | null): ScanResult["available_action"] {
  if (!attendance?.check_in_time) return "check_in";
  if (!attendance.check_out_time) return "check_out";
  return "completed";
}

function enrichScanResult(result: ScanResult, employees: EmployeeProfile[]) {
  if (!result.employee) return result;
  const fullProfile = employees.find((employee) => employee.user_id === result.employee?.user_id);
  return {
    ...result,
    employee: fullProfile ? { ...result.employee, ...fullProfile } : result.employee,
    available_action: result.available_action || deriveAvailableAction(result.attendance),
  };
}

function compactCardLabel(value?: string | null) {
  if (!value) return "-";
  const normalized = value.trim();
  const visibleTail = normalized.replace(/^\*+/, "");
  if (normalized.startsWith("*") && visibleTail) return `****${visibleTail.slice(-4)}`;
  if (normalized.length <= 12) return normalized;
  return `****${normalized.slice(-4)}`;
}

function findEmployeeFromScannedValue(value: string, employees: EmployeeProfile[]) {
  const tokens = extractScanTokens(value);
  if (tokens.length === 0) return undefined;

  return employees.find((employee) => {
    const candidates = [
      employee.user_id,
      employee.employee_code,
      employee.qr_token,
    ].flatMap((candidate) => extractScanTokens(candidate || ""));

    return candidates.some((candidate) => tokens.includes(candidate));
  });
}

function extractScanTokens(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  const rawParts = new Set<string>([trimmed]);

  try {
    const url = new URL(trimmed);
    rawParts.add(url.pathname.split("/").filter(Boolean).at(-1) || "");
    url.searchParams.forEach((paramValue) => rawParts.add(paramValue));
  } catch {
    const verifyMatch = trimmed.match(/verify-employee\/([^/?#]+)/i);
    if (verifyMatch?.[1]) rawParts.add(verifyMatch[1]);
  }

  return Array.from(rawParts)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => [part.toLowerCase(), part.replace(/\s+/g, "").toLowerCase()])
    .filter((part, index, parts) => parts.indexOf(part) === index);
}

function humanizeAction(action: string) {
  if (action === "check_in") return "Check-In";
  if (action === "check_out") return "Check-Out";
  if (action === "unknown_card") return "Unknown Card";
  if (action === "register_card") return "Register Card";
  if (action === "duplicate") return "Duplicate Prevented";
  return action.replaceAll("_", " ");
}
