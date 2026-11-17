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
  LogIn,
  CheckCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
        const matchesRole = item.designation ? item.designation.toLowerCase().includes(query) : false;
        return matchesName || matchesDept || matchesRole;
      }
      return true;
    });
  }, [roster, filter, searchQuery]);

  return (
    <GlassCard className="mb-6 overflow-hidden rounded-2xl border border-border/80 p-4 sm:p-5 shadow-xs">
      {/* 1. Header with Live Status & Shift Time Gauge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-indigo-500/5 text-primary border border-primary/25 shadow-2xs">
              <Activity size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Live Workforce Presence Radar
                </h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span>Live Office</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Instant on-site roster, punctuality tracking & workday shift timeline
              </p>
            </div>
          </div>
        </div>

        {/* Workday Shift Progress Gauge */}
        <div className="flex flex-col sm:items-end min-w-[260px] bg-white/60 dark:bg-card/60 rounded-xl p-2.5 border border-border/60">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Clock size={13} className="text-primary" />
            <span>Core Shift · 09:00 AM – 06:00 PM</span>
          </div>
          <div className="mt-1.5 w-full sm:w-64 h-2 rounded-full bg-muted/80 overflow-hidden shadow-inner p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 transition-all duration-500 shadow-xs"
              style={{ width: `${shiftProgress.progressPct}%` }}
            />
          </div>
          <span className="mt-1 text-[11px] font-medium text-muted-foreground font-mono">
            {shiftProgress.label}
          </span>
        </div>
      </div>

      {/* 2. Visual Segmented Attendance Breakdown */}
      <div className="mt-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold mb-1.5 gap-1">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-bold">Real-time Presence Distribution</span>
            <span className="text-[11px] text-muted-foreground font-medium">
              ({presentCount} Present · {lateCount} Late · {absentCount} Absent)
            </span>
          </div>
          <span className="text-foreground tabular-nums font-extrabold text-xs">
            {presentCount} of {activeCount} staff present ({pct}%)
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted/70 overflow-hidden flex gap-1 p-0.5 shadow-inner">
          {presentCount > 0 && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
              style={{ width: `${(presentCount / (activeCount || 1)) * 100}%` }}
              title={`Present: ${presentCount}`}
            />
          )}
          {lateCount > 0 && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
              style={{ width: `${(lateCount / (activeCount || 1)) * 100}%` }}
              title={`Late: ${lateCount}`}
            />
          )}
          {wfhCount > 0 && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
              style={{ width: `${(wfhCount / (activeCount || 1)) * 100}%` }}
              title={`WFH: ${wfhCount}`}
            />
          )}
          {absentCount > 0 && (
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-400 transition-all"
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
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
              filter === "all"
                ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] shadow-xs border-transparent"
                : "border border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            All Staff ({roster.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("present")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all border",
              filter === "present"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Present ({presentCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("late")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all border",
              filter === "late"
                ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs"
                : "border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Late ({lateCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("absent")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all border",
              filter === "absent"
                ? "border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 shadow-xs"
                : "border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Absent ({absentCount})</span>
          </button>
          {wfhCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter("wfh")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all border",
                filter === "wfh"
                  ? "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 shadow-xs"
                  : "border-border/80 bg-white/60 dark:bg-card/60 text-muted-foreground hover:text-foreground",
              )}
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
            className="w-full rounded-xl border border-border/80 bg-white/80 dark:bg-card/80 pl-8.5 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Live Employee Roster Cards Grid */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredRoster.length === 0 ? (
          <div className="col-span-full py-10 text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border/80 bg-white/40 dark:bg-card/40">
            No employees match the current filter or search criteria.
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
                className={cn(
                  "flex flex-col justify-between rounded-2xl border p-3.5 transition-all duration-200 group shadow-2xs hover:shadow-xs hover:-translate-y-0.5",
                  isPresent
                    ? "border-emerald-500/25 bg-gradient-to-b from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-card dark:to-card hover:border-emerald-500/45"
                    : isLate
                      ? "border-amber-500/25 bg-gradient-to-b from-amber-50/50 via-white to-white dark:from-amber-950/20 dark:via-card dark:to-card hover:border-amber-500/45"
                      : isWfh
                        ? "border-violet-500/25 bg-gradient-to-b from-violet-50/50 via-white to-white dark:from-violet-950/20 dark:via-card dark:to-card hover:border-violet-500/45"
                        : "border-rose-500/20 bg-gradient-to-b from-rose-50/30 via-white to-white dark:from-rose-950/15 dark:via-card dark:to-card hover:border-rose-500/40",
                )}
              >
                {/* Card Top: Avatar, Names & Status Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        {emp.avatarUrl ? (
                          <img
                            src={emp.avatarUrl}
                            alt=""
                            className="h-10 w-10 rounded-xl object-cover ring-2 ring-white dark:ring-card shadow-2xs"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-xs shadow-2xs bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-indigo-500/5 text-primary border border-primary/20">
                            {initials(emp.fullName)}
                          </div>
                        )}
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-card",
                            isPresent
                              ? "bg-emerald-500"
                              : isLate
                                ? "bg-amber-500"
                                : isWfh
                                  ? "bg-violet-500"
                                  : "bg-rose-500",
                          )}
                          title={emp.status.toUpperCase()}
                        />
                      </div>

                      {/* Name and Department */}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-xs sm:text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                          {emp.fullName}
                        </h4>
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate font-medium">
                          {emp.designation || emp.department}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0 border",
                        isPresent
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : isLate
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : isWfh
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
                      )}
                    >
                      {isPresent ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Present</span>
                        </>
                      ) : isLate ? (
                        <>
                          <Clock size={10} className="stroke-[2.5]" />
                          <span>Late</span>
                        </>
                      ) : isWfh ? (
                        <>
                          <Laptop size={10} />
                          <span>Remote</span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          <span>Absent</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Department Tag */}
                  {emp.department && emp.designation && emp.department.toLowerCase() !== emp.designation.toLowerCase() && (
                    <div className="mb-2">
                      <span className="rounded-md bg-muted/80 border border-border/60 px-1.5 py-0.2 text-[9px] font-bold text-muted-foreground uppercase tracking-wide">
                        {emp.department}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Check-in Time & Action Link */}
                <div className="mt-2 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
                  <div>
                    {isPresent && (
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <LogIn size={11} className="text-emerald-500 shrink-0" />
                        <span className="text-[10px] text-muted-foreground">In:</span>
                        <strong className="text-foreground font-bold">
                          {formatCheckInTime(emp.checkInTime)}
                        </strong>
                      </div>
                    )}
                    {isLate && (
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <LogIn size={11} className="text-amber-500 shrink-0" />
                        <span className="text-[10px] text-muted-foreground">In:</span>
                        <strong className="text-foreground font-bold">
                          {formatCheckInTime(emp.checkInTime)}
                        </strong>
                        {emp.lateMinutes ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold ml-0.5">
                            +{emp.lateMinutes}m
                          </span>
                        ) : null}
                      </div>
                    )}
                    {isWfh && (
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        <Laptop size={11} className="text-violet-500 shrink-0" />
                        <span className="text-[10px] text-muted-foreground">Remote:</span>
                        <strong className="text-foreground font-bold">
                          {formatCheckInTime(emp.checkInTime)}
                        </strong>
                      </div>
                    )}
                    {isAbsent && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                        <AlertTriangle size={11} className="shrink-0" />
                        <span>Not Checked In</span>
                      </div>
                    )}
                  </div>

                  <Link
                    to="/admin/attendance"
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all",
                      isAbsent
                        ? "bg-gradient-to-r from-[#c4daff] via-[#d5d3ff] to-[#e5ccff] text-[#0f172a] shadow-2xs hover:shadow-xs font-bold"
                        : "text-primary hover:bg-primary/10",
                    )}
                  >
                    <span>{isAbsent ? "Clock In" : "Details"}</span>
                    <ArrowRight size={11} />
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
