import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  LogIn,
  LogOut,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { Scanner } from "@yudiel/react-qr-scanner";

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

function CardReaderAttendancePage() {
  const { isAdmin } = useAuth();
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

  const selectedRegisterEmployee = useMemo(
    () => employees.find((employee) => employee.user_id === registerEmployeeId),
    [employees, registerEmployeeId],
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

  const loadEmployees = async () => {
    const [{ data, error }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,full_name,employee_code,department,position,avatar_url")
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

    const result = data as ScanResult;
    setScanResult(result);
    setLastScannedCard(result.card_uid);

    if (result.status === "unknown_card") {
      setUnknownOpen(true);
      toast.warning("Card not registered");
    } else if (result.status === "completed" || result.available_action === "completed") {
      toast.info("Attendance already completed for today");
    } else if (result.employee && (result.available_action === "check_in" || result.available_action === "check_out")) {
      // Auto check-in / check-out
      await processAutoAttendance(result, cardUid);
    }

    await loadHistory();
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const processAutoAttendance = async (result: ScanResult, cardUid: string) => {
    const action = result.available_action;
    if (!result.employee || !action || action === "completed") return;
    
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_card_reader_record_attendance", {
      _employee_id: result.employee.user_id,
      _card_uid: cardUid,
      _reader_id: readerId.trim(),
      _action: action,
      _reason: DEFAULT_REASON,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const next = data as { attendance: AttendanceSnapshot; employee: EmployeeProfile };
    setScanResult({
      ...result,
      status: next.attendance.check_out_time ? "completed" : "employee_found",
      attendance: next.attendance,
      available_action: next.attendance.check_out_time ? "completed" : "check_out",
    });
    
    toast.success(action === "check_in" ? `Checked in ${result.employee.full_name}` : `Checked out ${result.employee.full_name}`);
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
        title="Card Reader Attendance"
        subtitle="Admin RFID/NFC attendance for missed employee check-ins and check-outs"
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

          {scanResult?.employee && <EmployeeScanCard result={scanResult} />}

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
            </div>
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

function EmployeeScanCard({ result }: { result: ScanResult }) {
  if (!result.employee) return null;
  const completed = result.available_action === "completed";
  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {completed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <UserRound className="h-5 w-5 text-primary" />
          )}
          <div className="font-semibold">
            {completed ? "Attendance Completed" : "Employee Found"}
          </div>
        </div>
        <Badge variant="outline">{compactCardLabel(result.card_uid)}</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <EmployeeIdentity employee={result.employee} />
        <AttendanceDetails attendance={result.attendance} />
      </div>
    </GlassCard>
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

function compactCardLabel(value?: string | null) {
  if (!value) return "-";
  const normalized = value.trim();
  const visibleTail = normalized.replace(/^\*+/, "");
  if (normalized.startsWith("*") && visibleTail) return `****${visibleTail.slice(-4)}`;
  if (normalized.length <= 12) return normalized;
  return `****${normalized.slice(-4)}`;
}

function humanizeAction(action: string) {
  if (action === "check_in") return "Check-In";
  if (action === "check_out") return "Check-Out";
  if (action === "unknown_card") return "Unknown Card";
  if (action === "register_card") return "Register Card";
  if (action === "duplicate") return "Duplicate Prevented";
  return action.replaceAll("_", " ");
}
