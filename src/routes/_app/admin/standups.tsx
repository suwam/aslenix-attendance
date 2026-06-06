import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CalendarCheck2, Clock, Loader2, Search } from "lucide-react";
import { format } from "date-fns";
import { formatWorkHours } from "@/lib/work-hours";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";

export const Route = createFileRoute("/_app/admin/standups")({ component: AdminStandupsPage });

function AdminStandupsPage() {
  const [bsDate, setBsDate] = useState(formatBsInput());
  const date = bsInputToAdDateString(bsDate) ?? new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: standups }, { data: profiles }, { data: roleRows }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("date", date)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("user_id, full_name, email, department, avatar_url")
          .eq("approval_status", "approved"),
        supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
      ]);

      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
      const employeeProfiles = (profiles || []).filter((profile) => !adminUserIds.has(profile.user_id));
      const employeeUserIds = new Set(employeeProfiles.map((profile) => profile.user_id));
      const profileByUser = new Map(employeeProfiles.map((profile) => [profile.user_id, profile]));
      setRows(
        (standups || [])
          .filter((standup) => employeeUserIds.has(standup.user_id))
          .map((standup) => ({
            ...standup,
            profile: profileByUser.get(standup.user_id),
          })),
      );
      setLoading(false);
    })();
  }, [date]);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          row.profile?.full_name?.toLowerCase().includes(query) ||
          row.profile?.email?.toLowerCase().includes(query) ||
          row.profile?.department?.toLowerCase().includes(query)
        );
      }),
    [rows, search],
  );

  const totalHours = filtered.reduce((sum, row) => sum + Number(row.work_hours || 0), 0);
  const blockerCount = filtered.filter((row) => row.blockers?.trim()).length;

  return (
    <>
      <PageHeader
        title="Daily Standups"
        subtitle="Review what the team worked on today, tomorrow's plans, hours, and blockers"
        actions={
          <BSDateInput
            value={bsDate}
            onChange={setBsDate}
            className="w-auto"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Submitted" value={filtered.length} icon={CalendarCheck2} accent="green" />
        <StatCard
          label="Total hours"
          value={formatWorkHours(totalHours)}
          icon={Clock}
          accent="blue"
        />
        <StatCard
          label="Avg hours"
          value={formatWorkHours(totalHours / Math.max(1, filtered.length))}
          icon={Clock}
          accent="amber"
        />
        <StatCard label="Blockers" value={blockerCount} icon={AlertTriangle} accent="red" />
      </div>

      <div className="relative max-w-md mb-5">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search employee..."
          className="pl-9"
        />
      </div>

      <GlassCard className="overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Today worked on</th>
                  <th className="p-4">Tomorrow plan</th>
                  <th className="p-4">Blockers</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/40 hover:bg-muted/20 align-top"
                  >
                    <td className="p-4 min-w-56">
                      <EmployeeCell profile={row.profile} userId={row.user_id} />
                    </td>
                    <td className="p-4 min-w-64 text-muted-foreground">
                      {row.yesterday || "No work update"}
                    </td>
                    <td className="p-4 min-w-64">{row.today || "No plan shared"}</td>
                    <td className="p-4 min-w-56">
                      {row.blockers?.trim() ? (
                        <span className="text-destructive">{row.blockers}</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="p-4 tabular-nums">{formatWorkHours(row.work_hours)}</td>
                    <td className="p-4 text-muted-foreground whitespace-nowrap">
                      {formatNepaliDate(row.updated_at, "DD MMMM YYYY")} BS · {format(new Date(row.updated_at), "HH:mm")}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-sm text-muted-foreground">
                      No standups found for this date
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </>
  );
}

function EmployeeCell({ profile, userId }: { profile?: any; userId: string }) {
  const name = profile?.full_name || "Unknown user";
  const initials = name
    .split(" ")
    .map((part: string) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" />
      ) : (
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ background: "var(--gradient-brand)" }}
        >
          {initials}
        </div>
      )}
      <div className="min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {profile?.department || profile?.email || userId}
        </div>
      </div>
    </div>
  );
}
