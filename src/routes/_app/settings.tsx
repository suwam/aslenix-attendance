import { createFileRoute, Link } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BadgeCheck,
  BellDot,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Moon,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { changeOwnPassword } from "@/lib/password-management";

export const Route = createFileRoute("/_app/settings")({ component: EmployeeSettingsPage });

type EmployeePreferences = {
  compactCards: boolean;
  attendanceReminders: boolean;
  taskReviewAlerts: boolean;
  meetingPopups: boolean;
  weeklySummary: boolean;
};

const DEFAULT_PREFS: EmployeePreferences = {
  compactCards: false,
  attendanceReminders: true,
  taskReviewAlerts: true,
  meetingPopups: true,
  weeklySummary: true,
};

function EmployeeSettingsPage() {
  const { profile, roles } = useAuth();
  const storageKey = profile?.user_id
    ? `employee-settings:${profile.user_id}`
    : "employee-settings";
  const [preferences, setPreferences] = useState<EmployeePreferences>(DEFAULT_PREFS);
  const [initial, setInitial] = useState<EmployeePreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = readPreferences(storageKey);
    setPreferences(saved);
    setInitial(saved);
  }, [storageKey]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    try {
      setChangingPassword(true);
      await changeOwnPassword(newPassword);
      toast.success("Your password has been changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const isDirty = useMemo(
    () => JSON.stringify(preferences) !== JSON.stringify(initial),
    [preferences, initial],
  );

  const save = () => {
    setSaving(true);
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    window.setTimeout(() => {
      setInitial(preferences);
      setSaving(false);
      toast.success("Settings saved");
    }, 250);
  };

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const roleLabel = roles[0]?.replaceAll("_", " ") || "employee";
  const statusLabel = profile.is_suspended
    ? "Suspended"
    : profile.approval_status
      ? `${profile.approval_status.charAt(0).toUpperCase()}${profile.approval_status.slice(1)}`
      : "Pending";

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Personal preferences, notifications, and account shortcuts"
        actions={
          <Button
            onClick={save}
            disabled={saving || !isDirty}
            className="h-11 rounded-xl neon-button"
          >
            {saving ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Save size={14} className="mr-2" />
            )}
            {saving ? "Saving..." : "Save changes"}
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <EmployeeMetric
          icon={UserRound}
          label="Profile"
          value={profile.full_name || "Employee"}
          tone="red"
        />
        <EmployeeMetric icon={ShieldCheck} label="Status" value={statusLabel} tone="green" />
        <EmployeeMetric icon={IdCard} label="Role" value={roleLabel} tone="blue" />
        <EmployeeMetric icon={Mail} label="Email" value={profile.email || "Not set"} tone="amber" />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <SettingsPanel
            icon={Lock}
            title="Security & Password"
            subtitle="Change your login password anytime to keep your employee account protected."
          >
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters..."
                      required
                      className="h-10 pr-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password..."
                      required
                      className="h-10 pr-10 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Minimum 6 characters. Use letters, numbers, and symbols for high security.
                </span>
                <Button
                  type="submit"
                  disabled={changingPassword || !newPassword || newPassword.length < 6}
                  className="neon-button h-10 rounded-xl text-xs font-semibold px-4 self-end sm:self-auto"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <KeyRound size={13} className="mr-1.5" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </SettingsPanel>

          <SettingsPanel
            icon={BellDot}
            title="Notification Preferences"
            subtitle="Choose which in-app alerts should stay prominent for your daily workflow."
          >
            <div className="grid gap-3">
              <PreferenceToggle
                icon={Clock3}
                label="Attendance reminders"
                description="Keep check-in and checkout reminders visible."
                checked={preferences.attendanceReminders}
                onChange={(checked) =>
                  setPreferences({ ...preferences, attendanceReminders: checked })
                }
              />
              <PreferenceToggle
                icon={ClipboardList}
                label="Task review alerts"
                description="Highlight task completion and review request notifications."
                checked={preferences.taskReviewAlerts}
                onChange={(checked) =>
                  setPreferences({ ...preferences, taskReviewAlerts: checked })
                }
              />
              <PreferenceToggle
                icon={CalendarDays}
                label="Meeting popups"
                description="Show meeting schedule and reschedule popups on the dashboard."
                checked={preferences.meetingPopups}
                onChange={(checked) => setPreferences({ ...preferences, meetingPopups: checked })}
              />
              <PreferenceToggle
                icon={BadgeCheck}
                label="Weekly summary"
                description="Keep weekly performance and achievement summary cards enabled."
                checked={preferences.weeklySummary}
                onChange={(checked) => setPreferences({ ...preferences, weeklySummary: checked })}
              />
            </div>
          </SettingsPanel>

          <SettingsPanel
            icon={Moon}
            title="Display"
            subtitle="Tune the personal workspace density used by employee screens."
          >
            <PreferenceToggle
              icon={Smartphone}
              label="Compact cards"
              description="Use tighter cards for faster scanning on smaller screens."
              checked={preferences.compactCards}
              onChange={(checked) => setPreferences({ ...preferences, compactCards: checked })}
            />
          </SettingsPanel>
        </div>

        <div className="grid content-start gap-5">
          <GlassCard className="border-border bg-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Settings size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Account</h3>
                <p className="text-xs text-muted-foreground">Your signed-in employee identity</p>
              </div>
            </div>
            <div className="space-y-3">
              <InfoRow label="Name" value={profile.full_name || "Not set"} />
              <InfoRow label="Department" value={profile.department || "Unassigned"} />
              <InfoRow label="Position" value={profile.position || "Employee"} />
              <InfoRow label="Phone" value={profile.phone || "Not set"} />
            </div>
          </GlassCard>

          <GlassCard className="border-border bg-card">
            <h3 className="mb-4 font-semibold text-foreground">Quick Actions</h3>
            <div className="grid gap-2">
              <QuickLink to="/profile" icon={UserRound} label="Edit profile" />
              <QuickLink to="/notifications" icon={BellDot} label="Open notifications" />
              <QuickLink to="/my-attendance" icon={Clock3} label="View attendance" />
              <QuickLink to="/my-leaves" icon={CalendarDays} label="Manage leaves" />
            </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function SettingsPanel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Settings;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="border-border bg-card">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-foreground">
          <Icon size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function PreferenceToggle({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: typeof Settings;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:border-border hover:bg-card ${
        checked ? "border-border bg-card" : "border-border bg-card"
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground">
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-muted-foreground">{label}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition ${
          checked
            ? "justify-end border-cyan-300/30 bg-cyan-300/20"
            : "justify-start border-border bg-card"
        }`}
        aria-hidden="true"
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full ${checked ? "bg-cyan-200 text-background" : "bg-card"}`}
        >
          {checked && <Check size={11} />}
        </span>
      </span>
    </button>
  );
}

function EmployeeMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Settings;
  label: string;
  value: string;
  tone: "red" | "blue" | "amber" | "green";
}) {
  const colors = {
    red: "border-primary/20 bg-primary/10 text-primary",
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-600 ",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-600 ",
    green: "border-success/20 bg-success/10 text-success",
  };

  return (
    <GlassCard className="border-border bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 truncate text-lg font-bold capitalize text-foreground">{value}</div>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}
        >
          <Icon size={17} />
        </div>
      </div>
    </GlassCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="truncate text-right text-sm font-semibold text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/profile" | "/notifications" | "/my-attendance" | "/my-leaves";
  icon: typeof Settings;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground"
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}

function readPreferences(storageKey: string): EmployeePreferences {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}
