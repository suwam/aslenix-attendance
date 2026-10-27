import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { EmployeeQRCard } from "@/components/EmployeeQRCard";
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
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Camera,
  ClipboardList,
  HeartPulse,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
  MessageCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";
import { DEPARTMENTS, DEPARTMENT_POSITIONS } from "@/lib/departments";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

const DEFAULT_JOINING_DATE = "2026-05-01";

function ProfilePage() {
  const { profile, user, roles, refresh } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [isCustomPosition, setIsCustomPosition] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const shouldBackfillJoiningDate =
      profile.approval_status === "approved" && !profile.joining_date;
    const nextProfile = shouldBackfillJoiningDate
      ? { ...profile, joining_date: DEFAULT_JOINING_DATE }
      : profile;

    setForm(nextProfile);

    const dept = nextProfile.department || "";
    const isKnownDept = DEPARTMENTS.includes(dept as any);
    setIsCustomDept(!isKnownDept && Boolean(dept));

    const positions = DEPARTMENT_POSITIONS[dept] || [];
    const pos = nextProfile.position || "";
    if (pos && positions.length > 0 && !positions.includes(pos)) {
      setIsCustomPosition(true);
    } else {
      setIsCustomPosition(false);
    }

    if (shouldBackfillJoiningDate) {
      supabase
        .from("profiles")
        .update({ joining_date: DEFAULT_JOINING_DATE })
        .eq("id", profile.id)
        .then(({ error }) => {
          if (error) console.error("Unable to backfill joining date", error);
          else refresh();
        });
    }
  }, [profile, refresh]);
  if (!form) return null;

  const completionFields = [
    form.full_name,
    form.email,
    form.phone,
    form.department,
    form.position,
    form.address,
    form.blood_group,
    form.emergency_contact,
    form.avatar_url,
  ];
  const completedFields = completionFields.filter(Boolean).length;
  const completion = Math.round((completedFields / completionFields.length) * 100);
  const initials = getInitials(form.full_name);
  const roleLabel = roles[0]?.replaceAll("_", " ") || "employee";
  const statusLabel = form.is_suspended
    ? "Suspended"
    : form.approval_status
      ? `${form.approval_status.charAt(0).toUpperCase()}${form.approval_status.slice(1)}`
      : "Pending";
  const effectiveJoiningDate =
    form.joining_date || (form.approval_status === "approved" ? DEFAULT_JOINING_DATE : null);
  const joinedLabel = effectiveJoiningDate
    ? `${formatNepaliDate(effectiveJoiningDate, "DD MMMM YYYY")} BS`
    : "Not set";

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", form.id);
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    setForm({ ...form, avatar_url: publicUrl });
    toast.success("Profile photo updated");
    refresh();
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        department: form.department,
        position: form.position,
        joining_date: form.joining_date,
        address: form.address,
        blood_group: form.blood_group,
        emergency_contact: form.emergency_contact,
        whatsapp_number: form.whatsapp_number,
        whatsapp_notifications: form.whatsapp_notifications,
        whatsapp_checkin: form.whatsapp_checkin,
        whatsapp_checkout: form.whatsapp_checkout,
        whatsapp_late: form.whatsapp_late,
        whatsapp_early: form.whatsapp_early,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refresh();
  };

  const availablePositions = form.department ? DEPARTMENT_POSITIONS[form.department] || [] : [];

  const handleDepartmentChange = (dept: string) => {
    if (dept === "other") {
      setIsCustomDept(true);
      setIsCustomPosition(true);
      setForm((prev: any) => ({ ...prev, department: "", position: "" }));
      return;
    }

    setIsCustomDept(false);
    setIsCustomPosition(false);
    const newPositions = DEPARTMENT_POSITIONS[dept] || [];
    setForm((prev: any) => {
      const keepPosition = newPositions.includes(prev?.position);
      return {
        ...prev,
        department: dept,
        position: keepPosition ? prev.position : "",
      };
    });
  };

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal information and employee identity"
        actions={
          <div className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold capitalize text-muted-foreground">
            {roleLabel}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid gap-5">
          <GlassCard className="overflow-hidden border-border bg-card text-center">
            <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles size={12} />
              Employee profile
            </div>
            <div className="relative mx-auto h-32 w-32">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="Avatar"
                  className="h-32 w-32 rounded-3xl object-cover ring-2 ring-primary/40"
                />
              ) : (
                <div
                  className="flex h-32 w-32 items-center justify-center rounded-3xl text-3xl font-bold text-foreground shadow-sm"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {initials}
                </div>
              )}
              <label
                className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-border text-foreground ring-4 ring-background transition hover:scale-105"
                style={{ background: "var(--gradient-brand)" }}
              >
                {uploading ? <Loader2 size={17} className="animate-spin" /> : <Camera size={17} />}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadAvatar}
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="mt-6 text-2xl font-bold text-foreground">
              {form.full_name || "Unnamed employee"}
            </div>
            {form.position && (
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Briefcase size={12} className="text-primary" />
                <span>{form.position}</span>
              </div>
            )}
            <div className="mt-1 flex min-w-0 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Mail size={14} className="shrink-0" />
              <span className="truncate">{form.email}</span>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <ProfilePill icon={Briefcase} label={form.department || "Unassigned"} />
              {form.position && <ProfilePill icon={IdCard} label={form.position} />}
              <ProfilePill icon={ShieldCheck} label={statusLabel} />
            </div>
          </GlassCard>

          {completion < 100 && (
            <GlassCard className="border-border bg-card">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">Profile completion</h3>
                  <p className="text-xs text-muted-foreground">
                    {completedFields} of {completionFields.length} details filled
                  </p>
                </div>
                <div className="text-3xl font-bold tabular-nums gradient-text">{completion}%</div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-card">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${completion}%`, background: "var(--gradient-brand)" }}
                />
              </div>
            </GlassCard>
          )}

          <GlassCard className="border-border bg-card">
            <h3 className="mb-4 font-semibold text-foreground">Quick links</h3>
            <div className="grid gap-2">
              <QuickProfileLink to="/my-attendance" icon={CalendarDays} label="My attendance" />
              <QuickProfileLink to="/my-leaves" icon={ClipboardList} label="My leaves" />
              <QuickProfileLink to="/notifications" icon={BadgeCheck} label="Notifications" />
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-5">
          {form.approval_status === "approved" && form.qr_status === "active" && (
            <div className="flex flex-col items-center justify-center gap-2 lg:flex-row lg:items-start lg:justify-start rounded-2xl bg-card p-5 border border-border">
              <div className="flex flex-col gap-1 w-full max-w-sm mr-auto text-left mb-4 lg:mb-0">
                <h3 className="text-lg font-semibold text-foreground">Digital Employee ID</h3>
                <p className="text-sm text-muted-foreground">
                  Use this QR code for fast, contactless check-ins at the office scanner.
                </p>
              </div>
              <EmployeeQRCard profile={form as any} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InfoTile
              icon={IdCard}
              label="Employee code"
              value={form.employee_code || "Not assigned"}
            />
            <InfoTile icon={CalendarDays} label="Joining date" value={joinedLabel} />
            <InfoTile
              icon={HeartPulse}
              label="Emergency ready"
              value={form.emergency_contact ? "Available" : "Missing"}
            />
          </div>

          <GlassCard className="border-border bg-card">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Personal information</h3>
                <p className="text-sm text-muted-foreground">
                  Keep your contact and workplace details up to date.
                </p>
              </div>
              <Button onClick={save} disabled={saving} className="neon-button h-11 rounded-xl">
                {saving ? (
                  <Loader2 size={14} className="mr-2 animate-spin" />
                ) : (
                  <Save size={14} className="mr-2" />
                )}
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProfileField label="Full name" icon={UserRound}>
                <Input
                  value={form.full_name || ""}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </ProfileField>
              <ProfileField label="Phone" icon={Phone}>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </ProfileField>
              <ProfileField
                label="Department"
                icon={Briefcase}
                action={
                  isCustomDept && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomDept(false);
                        handleDepartmentChange(DEPARTMENTS[0]);
                      }}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Choose from list
                    </button>
                  )
                }
              >
                {!isCustomDept ? (
                  <Select
                    value={
                      DEPARTMENTS.includes(form.department as any)
                        ? form.department
                        : form.department
                          ? "custom"
                          : ""
                    }
                    onValueChange={(val) => {
                      if (val === "other") {
                        setIsCustomDept(true);
                        setIsCustomPosition(true);
                        setForm((prev: any) => ({ ...prev, department: "", position: "" }));
                      } else if (val !== "custom") {
                        handleDepartmentChange(val);
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-card">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                      {form.department && !DEPARTMENTS.includes(form.department as any) && (
                        <SelectItem value="custom">
                          {form.department} (Current)
                        </SelectItem>
                      )}
                      <SelectItem value="other">Other (Type custom department...)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-1.5">
                    <Input
                      placeholder="e.g. Frontend, Operations, QA"
                      value={form.department || ""}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                      <span>Standard:</span>
                      {DEPARTMENTS.slice(0, 4).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleDepartmentChange(d)}
                          className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary cursor-pointer transition"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </ProfileField>

              <ProfileField
                label="Position"
                icon={IdCard}
                action={
                  availablePositions.length > 0 &&
                  isCustomPosition && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomPosition(false);
                        setForm((prev: any) => ({
                          ...prev,
                          position: availablePositions[0] || "",
                        }));
                      }}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Choose from list
                    </button>
                  )
                }
              >
                {availablePositions.length > 0 && !isCustomPosition ? (
                  <Select
                    value={
                      availablePositions.includes(form.position)
                        ? form.position
                        : form.position
                          ? "other"
                          : ""
                    }
                    onValueChange={(val) => {
                      if (val === "other") {
                        setIsCustomPosition(true);
                      } else {
                        setForm((prev: any) => ({ ...prev, position: val }));
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-border bg-card">
                      <SelectValue
                        placeholder={
                          form.department === "Frontend"
                            ? "Select position (e.g. UI/UX Designer)"
                            : "Select position"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePositions.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {pos}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other (Type custom position...)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-1.5">
                    <Input
                      placeholder={
                        form.department === "Frontend"
                          ? "e.g. UI/UX Designer, Frontend Developer"
                          : form.department === "Backend"
                            ? "e.g. Backend Developer, API Engineer"
                            : "e.g. Software Engineer, Specialist"
                      }
                      value={form.position || ""}
                      onChange={(e) => setForm({ ...form, position: e.target.value })}
                    />
                    {availablePositions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                        <span>Common for {form.department}:</span>
                        {availablePositions.slice(0, 4).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setForm((prev: any) => ({ ...prev, position: p }));
                              setIsCustomPosition(false);
                            }}
                            className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary cursor-pointer transition"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ProfileField>
              <ProfileField label="Joining date (BS)" icon={CalendarDays}>
                <BSDateInput
                  value={form.joining_date ? formatBsInput(form.joining_date) : ""}
                  onChange={(value) =>
                    setForm({ ...form, joining_date: value ? bsInputToAdDateString(value) : null })
                  }
                />
              </ProfileField>
              <ProfileField label="Address" icon={MapPin} className="sm:col-span-2">
                <Input
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </ProfileField>
              <ProfileField label="Blood group" icon={HeartPulse}>
                <Select
                  value={form.blood_group || "not-set"}
                  onValueChange={(value) =>
                    setForm({ ...form, blood_group: value === "not-set" ? "" : value })
                  }
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not-set">Not set</SelectItem>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ProfileField>
              <ProfileField label="Emergency contact" icon={Phone}>
                <Input
                  value={form.emergency_contact || ""}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                />
              </ProfileField>
            </div>
          </GlassCard>

          <GlassCard className="border-border bg-card">
             <div className="mb-5">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                   <MessageCircle size={18} className="text-green-500" /> WhatsApp Notifications
                </h3>
                <p className="text-sm text-muted-foreground">
                   Receive automatic attendance updates on WhatsApp.
                </p>
             </div>
             
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <Label className="font-semibold text-sm">Enable WhatsApp Updates</Label>
                   <Switch 
                      checked={form.whatsapp_notifications ?? true}
                      onCheckedChange={(c) => setForm({ ...form, whatsapp_notifications: c })}
                   />
                </div>
                {form.whatsapp_notifications !== false && (
                   <>
                      <ProfileField label="WhatsApp Number" icon={Phone}>
                         <Input
                           placeholder="+9779812345678"
                           value={form.whatsapp_number || ""}
                           onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
                         />
                      </ProfileField>
                      
                      <div className="space-y-3 pt-3 border-t">
                         <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">Check-In</Label>
                            <Switch checked={form.whatsapp_checkin ?? true} onCheckedChange={(c) => setForm({ ...form, whatsapp_checkin: c })} />
                         </div>
                         <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">Check-Out</Label>
                            <Switch checked={form.whatsapp_checkout ?? true} onCheckedChange={(c) => setForm({ ...form, whatsapp_checkout: c })} />
                         </div>
                         <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">Late Check-In</Label>
                            <Switch checked={form.whatsapp_late ?? true} onCheckedChange={(c) => setForm({ ...form, whatsapp_late: c })} />
                         </div>
                         <div className="flex items-center justify-between">
                            <Label className="text-sm text-muted-foreground">Early Check-Out</Label>
                            <Switch checked={form.whatsapp_early ?? true} onCheckedChange={(c) => setForm({ ...form, whatsapp_early: c })} />
                         </div>
                      </div>
                   </>
                )}
             </div>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function ProfilePill({ icon: Icon, label }: { icon: typeof Briefcase; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
      <Icon size={13} className="shrink-0 text-primary" />
      <span className="truncate capitalize">{label}</span>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IdCard;
  label: string;
  value: string;
}) {
  return (
    <GlassCard className="border-border bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-3 truncate text-xl font-bold text-foreground">{value}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function QuickProfileLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/my-attendance" | "/my-leaves" | "/notifications";
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-card"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground transition group-hover:text-primary">
          <Icon size={16} />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="text-xs text-muted-foreground transition group-hover:text-primary">
        Open
      </span>
    </Link>
  );
}

function ProfileField({
  label,
  icon: Icon,
  children,
  className = "",
  action,
}: {
  label: string;
  icon: typeof UserRound;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon size={14} className="text-primary" />
          {label}
        </Label>
        {action}
      </div>
      {children}
    </div>
  );
}

function getInitials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "ME"
  );
}
