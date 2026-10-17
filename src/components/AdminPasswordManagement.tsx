import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KeyRound,
  Lock,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Copy,
  Check,
  Search,
  User,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  ShieldCheck,
  UserCog,
  Briefcase,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  adminResetEmployeePassword,
  changeOwnPassword,
  generateSecurePassword,
  fetchRecentPasswordResets,
  PasswordResetLog,
} from "@/lib/password-management";

interface ProfileItem {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  employee_code?: string | null;
  approval_status?: string | null;
  is_suspended?: boolean;
}

const DEPARTMENTS = ["All", "Development", "UI/UX", "AI/ML", "HR", "Marketing", "Management"];

interface AdminPasswordManagementProps {
  initialEmployeeId?: string;
}

export function AdminPasswordManagement({ initialEmployeeId }: AdminPasswordManagementProps) {
  const { profile: currentAdmin } = useAuth();

  // Employee list state
  const [employees, setEmployees] = useState<ProfileItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  // Selection & Employee Reset State
  const [selectedEmployee, setSelectedEmployee] = useState<ProfileItem | null>(null);
  const [empPassword, setEmpPassword] = useState("");
  const [showEmpPassword, setShowEmpPassword] = useState(false);
  const [resettingEmployee, setResettingEmployee] = useState(false);

  // Success Modal State after resetting employee password
  const [successModalData, setSuccessModalData] = useState<{
    employeeName: string;
    employeeEmail: string;
    newPassword: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Self Password Reset State (Admin's own password)
  const [selfNewPassword, setSelfNewPassword] = useState("");
  const [selfConfirmPassword, setSelfConfirmPassword] = useState("");
  const [showSelfNew, setShowSelfNew] = useState(false);
  const [showSelfConfirm, setShowSelfConfirm] = useState(false);
  const [savingSelf, setSavingSelf] = useState(false);

  // Audit Logs State
  const [logs, setLogs] = useState<PasswordResetLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Load employees and audit logs
  const loadData = async () => {
    try {
      setLoadingEmployees(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, department, position, avatar_url, employee_code, approval_status, is_suspended")
        .eq("approval_status", "approved")
        .order("full_name", { ascending: true });

      if (error) {
        toast.error("Failed to load employees: " + error.message);
      } else {
        setEmployees(data || []);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch employees");
    } finally {
      setLoadingEmployees(false);
    }

    refreshLogs();
  };

  const refreshLogs = async () => {
    setLoadingLogs(true);
    const recentLogs = await fetchRecentPasswordResets(10);
    setLogs(recentLogs);
    setLoadingLogs(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-select employee if provided in props
  useEffect(() => {
    if (initialEmployeeId && employees.length > 0) {
      const match = employees.find((e) => e.user_id === initialEmployeeId || e.id === initialEmployeeId);
      if (match) {
        setSelectedEmployee(match);
      }
    }
  }, [initialEmployeeId, employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesDept = departmentFilter === "All" || emp.department === departmentFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        emp.full_name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employee_code?.toLowerCase().includes(q) ||
        emp.position?.toLowerCase().includes(q);
      return matchesDept && matchesSearch;
    });
  }, [employees, departmentFilter, searchQuery]);

  // Handle generating secure password for selected employee
  const handleGeneratePassword = () => {
    const pw = generateSecurePassword();
    setEmpPassword(pw);
    setShowEmpPassword(true);
    toast.info("Generated a secure password");
  };

  // Handle resetting employee password
  const handleResetEmployeePassword = async () => {
    if (!selectedEmployee) {
      toast.error("Please select an employee first.");
      return;
    }

    if (!empPassword || empPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    try {
      setResettingEmployee(true);
      const result = await adminResetEmployeePassword(selectedEmployee.user_id, empPassword);

      toast.success(result.message || `Password changed for ${selectedEmployee.full_name}`);

      // Open success modal so admin can easily copy credentials to share with employee
      setSuccessModalData({
        employeeName: selectedEmployee.full_name,
        employeeEmail: selectedEmployee.email,
        newPassword: empPassword,
      });

      // Clear password field
      setEmpPassword("");
      refreshLogs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset password. Please verify permissions.");
    } finally {
      setResettingEmployee(false);
    }
  };

  // Handle admin self password change
  const handleSelfPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selfNewPassword || selfNewPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    if (selfNewPassword !== selfConfirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    try {
      setSavingSelf(true);
      await changeOwnPassword(selfNewPassword);
      toast.success("Your administrator password has been updated successfully!");
      setSelfNewPassword("");
      setSelfConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update your password.");
    } finally {
      setSavingSelf(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, label = "Password") => {
    navigator.clipboard.writeText(text);
    setCopiedSuccess(true);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Feature Intro */}
      <GlassCard className="relative overflow-hidden border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Password & Access Management</h2>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
                  Admin Controlled
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Reset passwords for any employee upon request, update your own administrator credentials,
                and maintain security audit records.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loadingEmployees}
              className="h-9 rounded-xl border-border hover:bg-muted text-xs"
            >
              <RefreshCw size={13} className={`mr-1.5 ${loadingEmployees ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Main Grid: Left = Employee Password Reset, Right = Admin Self Password + Audit Logs */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Column 1: Manage Employee Passwords */}
        <div className="space-y-5">
          <GlassCard className="border-border bg-card p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
                  <UserCog size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Reset Employee Password</h3>
                  <p className="text-xs text-muted-foreground">Select an employee and set a new password</p>
                </div>
              </div>
              {selectedEmployee && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedEmployee(null);
                    setEmpPassword("");
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or code..."
                  className="h-10 pl-9 text-xs"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="h-10 w-full sm:w-44 text-xs">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept} className="text-xs">
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employee Quick Selector Grid / List */}
            <div className="mb-5 max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-muted/20 p-2 pr-1">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                  <Loader2 size={16} className="mr-2 animate-spin text-primary" />
                  Loading employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No employees found matching the filters.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployee?.user_id === emp.user_id;
                  return (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`group flex items-center justify-between rounded-xl p-2.5 transition-all cursor-pointer border ${
                        isSelected
                          ? "border-primary/50 bg-primary/10 shadow-sm"
                          : "border-transparent hover:border-border hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {emp.avatar_url ? (
                          <img
                            src={emp.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover ring-1 ring-border shrink-0"
                          />
                        ) : (
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-foreground"
                            style={{ background: "var(--gradient-brand)" }}
                          >
                            {emp.full_name?.slice(0, 2).toUpperCase() || "EM"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {emp.full_name}
                            </span>
                            {emp.employee_code && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {emp.employee_code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate">{emp.email}</span>
                            {emp.department && (
                              <>
                                <span>•</span>
                                <span className="truncate">{emp.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        {isSelected ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check size={13} />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">
                            Select
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Employee Action Card */}
            {selectedEmployee ? (
              <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    {selectedEmployee.avatar_url ? (
                      <img
                        src={selectedEmployee.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/30"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-foreground"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        {selectedEmployee.full_name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                        {selectedEmployee.full_name}
                        <Badge variant="outline" className="text-[10px] py-0 border-success/30 bg-success/10 text-success">
                          Active
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <Mail size={11} /> {selectedEmployee.email}
                        {selectedEmployee.position && (
                          <>
                            <span>•</span>
                            <Briefcase size={11} /> {selectedEmployee.position}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Password Input & Generator */}
                <div className="space-y-3.5">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        New Password
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleGeneratePassword}
                        className="h-7 px-2 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        <Sparkles size={12} className="mr-1" />
                        Generate Strong Password
                      </Button>
                    </div>

                    <div className="relative">
                      <Input
                        type={showEmpPassword ? "text" : "password"}
                        value={empPassword}
                        onChange={(e) => setEmpPassword(e.target.value)}
                        placeholder="Enter or generate new password..."
                        className="h-11 pr-20 font-mono text-sm"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {empPassword && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(empPassword, "Generated password")}
                            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
                            title="Copy Password"
                          >
                            <Copy size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowEmpPassword(!showEmpPassword)}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition"
                          title={showEmpPassword ? "Hide password" : "Show password"}
                        >
                          {showEmpPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Must be at least 6 characters. You can copy and safely send this to the employee.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={handleResetEmployeePassword}
                      disabled={resettingEmployee || !empPassword || empPassword.length < 6}
                      className="neon-button h-11 flex-1 rounded-xl text-xs font-semibold"
                    >
                      {resettingEmployee ? (
                        <>
                          <Loader2 size={14} className="mr-2 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <KeyRound size={14} className="mr-2" />
                          Reset Password for {selectedEmployee.full_name}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <User size={24} className="mx-auto mb-2 text-muted-foreground/50" />
                Select an employee from the list above to reset their password.
              </div>
            )}
          </GlassCard>
        </div>

        {/* Column 2: Admin Self Password + Recent Audit Logs */}
        <div className="space-y-5">
          {/* Admin Self Password Reset Card */}
          <GlassCard className="border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Change My Password</h3>
                <p className="text-xs text-muted-foreground">
                  Update your own administrator account password
                </p>
              </div>
            </div>

            <form onSubmit={handleSelfPasswordChange} className="space-y-3.5">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
                <Shield size={14} className="text-primary shrink-0" />
                <span className="truncate">
                  Logged in as: <strong className="text-foreground">{currentAdmin?.email || "Admin"}</strong>
                </span>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    type={showSelfNew ? "text" : "password"}
                    value={selfNewPassword}
                    onChange={(e) => setSelfNewPassword(e.target.value)}
                    placeholder="Enter new admin password..."
                    required
                    className="h-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfNew(!showSelfNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSelfNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    type={showSelfConfirm ? "text" : "password"}
                    value={selfConfirmPassword}
                    onChange={(e) => setSelfConfirmPassword(e.target.value)}
                    placeholder="Confirm new admin password..."
                    required
                    className="h-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSelfConfirm(!showSelfConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSelfConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={savingSelf || !selfNewPassword || selfNewPassword.length < 6}
                className="w-full h-10 rounded-xl neon-button text-xs font-semibold"
              >
                {savingSelf ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Updating My Password...
                  </>
                ) : (
                  <>
                    <KeyRound size={14} className="mr-2" />
                    Update Admin Password
                  </>
                )}
              </Button>
            </form>
          </GlassCard>

          {/* Recent Audit Logs Card */}
          <GlassCard className="border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} className="text-muted-foreground" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-foreground">
                  Password Reset History
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshLogs}
                disabled={loadingLogs}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RefreshCw size={11} className={`mr-1 ${loadingLogs ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            <div className="space-y-2">
              {loadingLogs ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <Loader2 size={14} className="mx-auto mb-1 animate-spin text-primary" />
                  Loading audit logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No password reset events recorded yet.
                </div>
              ) : (
                logs.map((log) => {
                  const targetName = log.details?.target_name || "Employee";
                  const targetEmail = log.details?.target_email || "";
                  const timestamp = log.created_at || log.details?.timestamp;
                  const timeAgo = timestamp
                    ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
                    : "Recently";

                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 p-2.5 text-xs transition hover:bg-muted/20"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <CheckCircle2 size={13} className="text-success shrink-0" />
                          <span className="truncate">{targetName}</span>
                        </div>
                        {targetEmail && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {targetEmail}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock size={10} />
                          {timeAgo}
                        </div>
                        <Badge variant="outline" className="mt-1 text-[9px] py-0 border-success/30 text-success">
                          Success
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Success Dialog: Credentials Copy Modal */}
      <Dialog
        open={Boolean(successModalData)}
        onOpenChange={(open) => !open && setSuccessModalData(null)}
      >
        <DialogContent className="max-w-md border-border bg-card">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border border-success/30 bg-success/10 text-success">
              <CheckCircle2 size={24} />
            </div>
            <DialogTitle className="text-center text-base font-bold">
              Password Reset Successful!
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              New credentials for <strong className="text-foreground">{successModalData?.employeeName}</strong> have been configured.
            </DialogDescription>
          </DialogHeader>

          {successModalData && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Employee:</span>
                  <span className="font-semibold text-foreground">{successModalData.employeeName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-medium">Email / Login:</span>
                  <span className="font-mono text-foreground">{successModalData.employeeEmail}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <span className="text-muted-foreground font-medium">New Password:</span>
                  <span className="font-mono font-bold text-primary text-sm bg-primary/10 px-2 py-0.5 rounded">
                    {successModalData.newPassword}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-foreground flex items-start gap-2">
                <AlertCircle size={15} className="text-blue-500 shrink-0 mt-0.5" />
                <span>
                  Share this new password with the employee immediately. They can sign in and change it anytime.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl text-xs h-10"
              onClick={() => {
                if (successModalData) {
                  const credentialText = `Login Credentials for ASLENIX HRMS:\nEmail: ${successModalData.employeeEmail}\nPassword: ${successModalData.newPassword}`;
                  copyToClipboard(credentialText, "Full credentials");
                }
              }}
            >
              <Copy size={13} className="mr-1.5" />
              {copiedSuccess ? "Copied!" : "Copy Full Details"}
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl neon-button text-xs h-10"
              onClick={() => setSuccessModalData(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
