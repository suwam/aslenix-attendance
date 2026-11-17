import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/GlassCard";
import {
  Activity,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Search,
  Laptop,
  ArrowRight,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

export type LiveEmployeePresence = {
  userId: string;
  fullName: string;
  email: string;
  department: string;
  designation?: string;
  avatarUrl?: string | null;
  status: "present" | "late" | "wfh" | "absent" | "leave";
  checkInTime?: string | null;
  checkOutTime?: string | null;
  lateMinutes?: number | null;
  workLocation?: string | null;
  phone?: string | null;
};

export type LiveWorkforceRadarProps = {
  roster: LiveEmployeePresence[];
  activeCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  wfhCount: number;
  pct: number;
};

type FilterType = "all" | "present" | "late" | "absent" | "wfh";

function formatCheckInTime(raw?: string | null): string {
  if (!raw) return "Not recorded";
  if (raw.includes(":") && !raw.includes("T")) {
    const parts = raw.split(":");
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (!isNaN(hour) && !isNaN(minute)) {
      const period = hour >= 12 ? "PM" : "AM";
      const formattedHour = hour % 12 || 12;
      return `${String(formattedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
    }
  }
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
  } catch {
    // fallback
  }
  return raw;
}

function getShiftProgress() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const shiftStartMinutes = 9 * 60; // 09:00 AM
  const shiftEndMinutes = 18 * 60; // 06:00 PM
  const totalShiftMinutes = shiftEndMinutes - shiftStartMinutes;

  if (currentMinutes < shiftStartMinutes) {
    const minsUntil = shiftStartMinutes - currentMinutes;
    const hours = Math.floor(minsUntil / 60);
    const mins = minsUntil % 60;
    return {
      status: "upcoming" as const,
      progressPct: 0,
      label: `Shift begins in ${hours > 0 ? `${hours}h ` : ""}${mins}m · 09:00 AM`,
    };
  }

  if (currentMinutes >= shiftEndMinutes) {
    return {
      status: "completed" as const,
      progressPct: 100,
      label: "Workday shift concluded at 06:00 PM",
    };
  }

  const elapsed = currentMinutes - shiftStartMinutes;
  const remaining = shiftEndMinutes - currentMinutes;
  const progressPct = Math.min(100, Math.round((elapsed / totalShiftMinutes) * 100));
  const elHours = Math.floor(elapsed / 60);
  const elMins = elapsed % 60;
  const remHours = Math.floor(remaining / 60);
  const remMins = remaining % 60;

  return {
    status: "active" as const,
    progressPct,
    label: `${elHours}h ${elMins}m elapsed · ${remHours}h ${remMins}m to close (${progressPct}%)`,
  };
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "EM"
  );
}

export function LiveWorkforceRadar({
  roster,
  activeCount,
  presentCount,
  lateCount,
  absentCount,
  wfhCount,
  pct,
}: LiveWorkforceRadarProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shiftProgress, setShiftProgress] = useState(getShiftProgress);

  useEffect(() => {
    const interval = setInterval(() => {
      setShiftProgress(getShiftProgress());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredRoster = useMemo(() => {
    return roster.filter((item) => {
      if (filter === "present" && item.status !== "present") return false;
      if (filter === "late" && item.status !== "late") return false;
      if (filter === "absent" && item.status !== "absent") return false;
      if (filter === "wfh" && item.status !== "wfh") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.fullName.toLowerCase().includes(query);
        const matchesDept = item.department.toLowerCase().includes(query);
        return matchesName || matchesDept;
      }
      return true;
    });
  }, [roster, filter, searchQuery]);

  return (
    <GlassCard className="mb-6 overflow-hidden">
      {/* 1. Header with Live Status & Shift Time Gauge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              <span>Live Workforce Presence Radar</span>
            </h3>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live Office</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Instant on-site roster, punctuality tracking & workday shift timeline
          </p>
        </div>

        {/* Workday Shift Progress Gauge */}
        <div className="flex flex-col sm:items-end min-w-[260px]">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Clock size={13} className="text-primary" />
            <span>Core Shift · 09:00 AM – 06:00 PM</span>
          </div>
          <div className="mt-1.5 w-full sm:w-64 h-2 rounded-full bg-muted/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${shiftProgress.progressPct}%` }}
            />
          </div>
          <span className="mt-1 text-[11px] font-medium text-muted-foreground">
            {shiftProgress.label}
          </span>
        </div>
      </div>

      {/* 2. Visual Segmented Attendance Breakdown */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-muted-foreground">Real-time Presence Distribution</span>
          <span className="text-foreground tabular-nums font-bold">
            {presentCount} of {activeCount} staff present ({pct}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/70 overflow-hidden flex gap-0.5">
          {presentCount > 0 && (
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${(presentCount / (activeCount || 1)) * 100}%` }}
              title={`Present: ${presentCount}`}
            />
          )}
          {lateCount > 0 && (
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${(lateCount / (activeCount || 1)) * 100}%` }}
              title={`Late: ${lateCount}`}
            />
          )}
          {wfhCount > 0 && (
            <div
              className="h-full bg-violet-500 transition-all"
              style={{ width: `${(wfhCount / (activeCount || 1)) * 100}%` }}
              title={`WFH: ${wfhCount}`}
            />
          )}
          {absentCount > 0 && (
            <div
              className="h-full bg-rose-400/80 transition-all"
              style={{ width: `${(absentCount / (activeCount || 1)) * 100}%` }}
              title={`Absent: ${absentCount}`}
            />
          )}
        </div>
      </div>

      {/* 3. Filter Pills & Fast Search Bar */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              filter === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Staff ({roster.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("present")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filter === "present"
                ? "bg-emerald-600 text-white shadow-xs"
                : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Present ({presentCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("late")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filter === "late"
                ? "bg-amber-600 text-white shadow-xs"
                : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Late ({lateCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("absent")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filter === "absent"
                ? "bg-rose-600 text-white shadow-xs"
                : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Absent ({absentCount})</span>
          </button>
          {wfhCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("wfh")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filter === "wfh"
                  ? "bg-violet-600 text-white shadow-xs"
                  : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Laptop size={12} />
              <span>WFH ({wfhCount})</span>
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/80 bg-white/70 dark:bg-card/70 pl-8.5 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
        </div>
      </div>

      {/* 4. Live Employee Roster Cards Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {filteredRoster.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground">
            No employees found for this filter.
          </div>
        ) : (
          filteredRoster.map((emp) => {
            const isPresent = emp.status === "present";
            const isLate = emp.status === "late";
            const isWfh = emp.status === "wfh";
            const isAbsent = emp.status === "absent";

            return (
              <div
                key={emp.userId}
                className={`flex flex-col justify-between rounded-xl border p-3 transition-all duration-200 ${
                  isPresent
                    ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10 hover:border-emerald-500/40"
                    : isLate
                      ? "border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/10 hover:border-amber-500/40"
                      : isWfh
                        ? "border-violet-500/20 bg-violet-50/30 dark:bg-violet-950/10 hover:border-violet-500/40"
                        : "border-border/70 bg-white/50 dark:bg-card/50 hover:border-border hover:bg-card"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar with Status Dot */}
                  <div className="relative shrink-0">
                    {emp.avatarUrl ? (
                      <img
                        src={emp.avatarUrl}
                        alt=""
                        className="h-9 w-9 rounded-full object-cover ring-1 ring-border"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-gradient-to-br from-primary/10 to-primary/20 text-xs font-bold text-foreground">
                        {initials(emp.fullName)}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                        isPresent
                          ? "bg-emerald-500"
                          : isLate
                            ? "bg-amber-500"
                            : isWfh
                              ? "bg-violet-500"
                              : "bg-rose-500"
                      }`}
                      title={emp.status.toUpperCase()}
                    />
                  </div>

                  {/* Name and Department */}
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-xs font-bold text-foreground leading-tight">
                      {emp.fullName}
                    </h4>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                      <span>{emp.department}</span>
                      {emp.designation && <span>· {emp.designation}</span>}
                    </div>
                  </div>
                </div>

                {/* Status Badge & Check-in Time */}
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                  <div>
                    {isPresent && (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        In: {formatCheckInTime(emp.checkInTime)}
                      </span>
                    )}
                    {isLate && (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        In: {formatCheckInTime(emp.checkInTime)}{" "}
                        {emp.lateMinutes ? `(+${emp.lateMinutes}m)` : ""}
                      </span>
                    )}
                    {isWfh && (
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        Remote: {formatCheckInTime(emp.checkInTime)}
                      </span>
                    )}
                    {isAbsent && (
                      <span className="font-semibold text-rose-500 dark:text-rose-400">
                        Not Checked In
                      </span>
                    )}
                  </div>

                  <Link
                    to="/admin/attendance"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    <span>{isAbsent ? "Clock In" : "Details"}</span>
                    <ArrowRight size={10} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
