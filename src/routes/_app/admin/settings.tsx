import { createFileRoute } from "@tanstack/react-router";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { GlassTimeInput } from "@/components/BSDateInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Clock3,
  Loader2,
  MapPin,
  Navigation,
  Radar,
  RotateCcw,
  Save,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [initial, setInitial] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [supportsAutoCheckout, setSupportsAutoCheckout] = useState(true);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const next = { auto_checkout_time: "19:00", attendance_radius_meters: 20, ...data };
        setSupportsAutoCheckout(Boolean(data && "auto_checkout_time" in data));
        setS(next);
        setInitial(next);
      });
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      company_name: s.company_name,
      office_start_time: s.office_start_time,
      office_end_time: s.office_end_time,
      late_after_time: s.late_after_time,
      office_latitude: parseOptionalNumber(s.office_latitude),
      office_longitude: parseOptionalNumber(s.office_longitude),
      attendance_radius_meters: Number(s.attendance_radius_meters) || 20,
    };

    if (supportsAutoCheckout) {
      updates.auto_checkout_time = s.auto_checkout_time;
    }

    const { error } = await supabase.from("settings").update(updates).eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setInitial(s);
    toast.success("Settings saved");
  };

  const isDirty = useMemo(() => JSON.stringify(s) !== JSON.stringify(initial), [s, initial]);

  if (!s) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  const officeStart = s.office_start_time?.slice(0, 5) || "";
  const officeEnd = s.office_end_time?.slice(0, 5) || "";
  const lateAfter = s.late_after_time?.slice(0, 5) || "";
  const autoCheckout = s.auto_checkout_time?.slice(0, 5) || "";
  const hasLocation =
    s.office_latitude !== "" &&
    s.office_latitude != null &&
    s.office_longitude !== "" &&
    s.office_longitude != null;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Company configuration, attendance windows, and office check-in rules"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={!isDirty || saving}
              onClick={() => setS(initial)}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Reset
            </Button>
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
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SettingMetric
          icon={Building2}
          label="Company"
          value={s.company_name || "Not set"}
          tone="red"
        />
        <SettingMetric
          icon={Clock3}
          label="Office hours"
          value={`${officeStart || "--:--"} - ${officeEnd || "--:--"}`}
          tone="blue"
        />
        <SettingMetric
          icon={TimerReset}
          label="Late after"
          value={lateAfter || "--:--"}
          tone="amber"
        />
        <SettingMetric
          icon={Radar}
          label="Radius"
          value={`${s.attendance_radius_meters ?? 20}m`}
          tone="green"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-5">
          <SettingsSection
            icon={Building2}
            title="Company Profile"
            subtitle="This name appears across the HRMS and employee-facing screens."
          >
            <Field label="Company name">
              <Input
                value={s.company_name || ""}
                onChange={(e) => setS({ ...s, company_name: e.target.value })}
                placeholder="ASLENIX"
                className="h-11"
              />
            </Field>
          </SettingsSection>

          <SettingsSection
            icon={Clock3}
            title="Working Hours"
            subtitle="Define the official attendance window and late threshold."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Office start">
                <GlassTimeInput
                  value={officeStart}
                  onChange={(value) => setS({ ...s, office_start_time: value })}
                />
              </Field>
              <Field label="Office end">
                <GlassTimeInput
                  value={officeEnd}
                  onChange={(value) => setS({ ...s, office_end_time: value })}
                />
              </Field>
              <Field label="Late after">
                <GlassTimeInput
                  value={lateAfter}
                  onChange={(value) => setS({ ...s, late_after_time: value })}
                />
              </Field>
              <Field label="Auto checkout">
                <GlassTimeInput
                  value={autoCheckout}
                  onChange={(value) => setS({ ...s, auto_checkout_time: value })}
                  className={!supportsAutoCheckout ? "pointer-events-none opacity-60" : undefined}
                />
              </Field>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
              {supportsAutoCheckout
                ? "Employees who forget to check out can be automatically checked out at the configured time."
                : "Auto checkout needs the pending database migration before it can be saved."}
            </div>
            <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/10 p-3 text-xs leading-5 text-foreground">
              Keep the radius tight, usually 20-50 meters. Employees outside this fence, or with
              weak GPS accuracy, will be blocked from checking in or checking out.
            </div>
          </SettingsSection>

          <SettingsSection
            icon={MapPin}
            title="Office Location"
            subtitle="Control the location fence used for check-in and check-out."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Latitude">
                <Input
                  type="number"
                  step="any"
                  value={s.office_latitude ?? ""}
                  onChange={(e) => setS({ ...s, office_latitude: e.target.value })}
                  placeholder="27.7172"
                  className="h-11"
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  step="any"
                  value={s.office_longitude ?? ""}
                  onChange={(e) => setS({ ...s, office_longitude: e.target.value })}
                  placeholder="85.3240"
                  className="h-11"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Allowed radius (meters)">
                  <Input
                    type="number"
                    min={1}
                    value={s.attendance_radius_meters ?? 20}
                    onChange={(e) => setS({ ...s, attendance_radius_meters: e.target.value })}
                    className="h-11"
                  />
                </Field>
              </div>
            </div>
          </SettingsSection>
        </div>

        <div className="grid content-start gap-5">
          <GlassCard className="overflow-hidden border-border bg-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-foreground">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Rule Summary</h3>
                <p className="text-xs text-muted-foreground">Current attendance enforcement</p>
              </div>
            </div>
            <div className="space-y-3">
              <SummaryRow
                label="Working window"
                value={`${officeStart || "--:--"} to ${officeEnd || "--:--"}`}
              />
              <SummaryRow label="Late threshold" value={lateAfter || "Not set"} />
              <SummaryRow
                label="Auto checkout"
                value={supportsAutoCheckout ? autoCheckout || "Not set" : "Unavailable"}
              />
              <SummaryRow
                label="Location fence"
                value={
                  hasLocation ? `${s.attendance_radius_meters ?? 20} meters` : "Not configured"
                }
              />
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden border-border bg-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-600 ">
                <Navigation size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Location Preview</h3>
                <p className="text-xs text-muted-foreground">
                  Coordinates used by attendance checks
                </p>
              </div>
            </div>
            {hasLocation ? (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pinned office
                </div>
                <div className="mt-2 break-all text-sm font-semibold text-foreground">
                  {s.office_latitude}, {s.office_longitude}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${s.office_latitude},${s.office_longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground"
                >
                  Open in Maps
                </a>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
                Add office latitude and longitude to enable location-aware attendance.
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function SettingsSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="border-border bg-card">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SettingMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building2;
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
          <div className="mt-2 truncate text-lg font-bold text-foreground">{value}</div>
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-3 py-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold text-muted-foreground">{value}</span>
    </div>
  );
}

function parseOptionalNumber(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
