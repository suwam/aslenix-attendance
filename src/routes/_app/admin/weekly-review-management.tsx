import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  History,
  LockKeyhole,
  Printer,
  Search,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import NepaliDate from "nepali-date-converter";
import { format } from "date-fns";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatBsInput } from "@/lib/nepali-calendar";
import { cn } from "@/lib/utils";
import logoMarkUrl from "@/assets/aslenix-mark.png";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/weekly-review-management")({
  component: WeeklyReviewManagementPage,
});

const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Ashadh",
  "Shrawan",
  "Bhadra",
  "Ashwin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
];

const BS_YEARS = [2080, 2081, 2082, 2083, 2084, 2085];
const PAGE_SIZE = 8;

type StatusFilter = "all" | "completed" | "pending" | "locked";
type WeekFilter = "all" | "1" | "2" | "3" | "4" | "5";

type ProfileRow = {
  user_id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  id: string;
  employee_id: string;
  admin_id: string | null;
  week_number: number | null;
  week_start: string | null;
  nepali_year: number | null;
  nepali_month: number | null;
  unlock_date: string | null;
  rating: string | null;
  strengths: string | null;
  improvements: string | null;
  admin_notes: string | null;
  notes: string | null;
  score: number | null;
  review_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type EmployeeReview = {
  id: string;
  employeeId: string;
  employee: string;
  department: string;
  position: string;
  weekNumber: number;
  bsRange: string;
  submissionDate: string;
  score: number;
  reviewer: string;
  status: StatusFilter;
  rating: string;
  submittedCount?: number;
  periodCount?: number;
};

type ReviewWeek = {
  weekNumber: number;
  startDay: number;
  endDay: number;
  startBs: string;
  endBs: string;
  startAd: string;
  endAd: string;
  label: string;
};

function WeeklyReviewManagementPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const currentBs = useMemo(() => new NepaliDate(), []);
  const [bsYear, setBsYear] = useState(String(currentBs.getYear()));
  const [bsMonth, setBsMonth] = useState(String(currentBs.getMonth() + 1));
  const [weekFilter, setWeekFilter] = useState<WeekFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([1]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [lockedWeeks, setLockedWeeks] = useState<number[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [dialogWeekNumber, setDialogWeekNumber] = useState(1);
  const [dialogScope, setDialogScope] = useState<"week" | "month">("month");
  const [dialogEmployeeId, setDialogEmployeeId] = useState<string | null>(null);
  const employeeTableRef = useRef<HTMLDivElement | null>(null);
  const employeeHistoryRef = useRef<HTMLDivElement | null>(null);

  const weeks = useMemo(
    () => buildBsReviewWeeks(Number(bsYear), Number(bsMonth)),
    [bsYear, bsMonth],
  );

  useEffect(() => {
    if (!weeks.some((week) => week.weekNumber === selectedWeek)) {
      setSelectedWeek(weeks[0]?.weekNumber ?? 1);
    }
  }, [selectedWeek, weeks]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const [{ data: profileData, error: profileError }, feedbackResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, department, position, avatar_url")
          .eq("approval_status", "approved")
          .eq("is_suspended", false)
          .order("full_name", { ascending: true }),
        loadWeeklyFeedbackRows(),
      ]);

      if (!mounted) return;

      if (profileError) {
        toast.error("Unable to load employees");
      }

      if (feedbackResult.error) {
        console.error("Unable to load weekly reviews", feedbackResult.error);
        toast.error("Unable to load weekly reviews");
      }

      setProfiles((profileData ?? []) as ProfileRow[]);
      setReviews((feedbackResult.data ?? []) as ReviewRow[]);
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [bsMonth, bsYear]);

  const baseReviewRows = useMemo(
    () => buildEmployeeReviewRows(profiles, reviews, weeks, Number(bsYear), Number(bsMonth)),
    [profiles, reviews, weeks, bsYear, bsMonth],
  );
  const reviewRows = useMemo(
    () =>
      baseReviewRows.map((row) => ({
        ...row,
        status:
          lockedWeeks.includes(row.weekNumber) && row.status === "pending"
            ? "locked"
            : row.status,
      })),
    [baseReviewRows, lockedWeeks],
  );

  useEffect(() => {
    if (!selectedEmployeeId && reviewRows.length) {
      setSelectedEmployeeId(reviewRows[0].employeeId);
    }
  }, [reviewRows, selectedEmployeeId]);

  const departments = useMemo(
    () => ["all", ...Array.from(new Set(reviewRows.map((row) => row.department))).sort()],
    [reviewRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviewRows.filter((row) => {
      const matchesSearch =
        !q ||
        row.employee.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.position.toLowerCase().includes(q);
      const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter;
      const matchesWeek = weekFilter === "all" || row.weekNumber === Number(weekFilter);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesDepartment && matchesWeek && matchesStatus;
    });
  }, [departmentFilter, reviewRows, search, statusFilter, weekFilter]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, search, statusFilter, weekFilter, bsMonth, bsYear]);

  const stats = useMemo(() => getStats(filteredRows, profiles.length), [filteredRows, profiles]);
  const selectedSummary = useMemo(
    () => getWeekSummary(selectedWeek, filteredRows),
    [filteredRows, selectedWeek],
  );
  const weekSummaries = useMemo(
    () => weeks.map((week) => ({ week, ...getWeekSummary(week.weekNumber, reviewRows) })),
    [reviewRows, weeks],
  );
  const chartData = useMemo(() => buildChartData(reviewRows, weeks), [reviewRows, weeks]);
  const topEmployees = useMemo(
    () =>
      filteredRows
        .filter((row) => row.status === "completed")
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [filteredRows],
  );
  const lowTrend = useMemo(
    () =>
      filteredRows
        .filter((row) => row.status === "completed")
        .sort((a, b) => a.score - b.score)
        .slice(0, 5),
    [filteredRows],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedMonthName = BS_MONTHS[Number(bsMonth) - 1] ?? "Nepali Month";
  const selectedEmployee = profiles.find((profile) => profile.user_id === selectedEmployeeId);
  const selectedEmployeeHistory = useMemo(
    () => buildEmployeeHistory(selectedEmployeeId, profiles, reviews),
    [profiles, reviews, selectedEmployeeId],
  );
  const dialogRows = useMemo(
    () =>
      buildDialogEmployeeRows(
        dialogScope === "month"
          ? reviewRows
          : reviewRows.filter((row) => row.weekNumber === dialogWeekNumber),
        profiles,
      ),
    [dialogScope, dialogWeekNumber, profiles, reviewRows],
  );
  const dialogEmployee = dialogRows.find((row) => row.employeeId === dialogEmployeeId) ?? null;
  const dialogEmployeeProfile = profiles.find((profile) => profile.user_id === dialogEmployeeId) ?? null;
  const dialogEmployeeHistory = useMemo(
    () =>
      buildEmployeePeriodHistory(
        dialogEmployeeId,
        profiles,
        reviews,
        weeks,
        Number(bsYear),
        Number(bsMonth),
        dialogScope === "week" ? dialogWeekNumber : undefined,
      ),
    [dialogEmployeeId, profiles, reviews, weeks, bsYear, bsMonth, dialogScope, dialogWeekNumber],
  );
  const monthReviewCounts = useMemo(
    () => getMonthReviewCounts(reviews, Number(bsYear)),
    [reviews, bsYear],
  );

  const exportCsv = () => {
    const csv = toCsv(filteredRows);
    downloadTextFile(
      `weekly-reviews-${bsYear}-${String(bsMonth).padStart(2, "0")}.csv`,
      csv,
      "text/csv;charset=utf-8",
    );
    toast.success("Excel-ready CSV exported");
  };

  const exportPdf = () => {
    window.print();
    toast.success("Print dialog opened for PDF export");
  };

  const showWeekEmployees = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    setWeekFilter(String(weekNumber) as WeekFilter);
    setExpandedWeeks((current) =>
      current.includes(weekNumber) ? current : [...current, weekNumber],
    );
    setPage(1);
    setDialogWeekNumber(weekNumber);
    setDialogScope("week");
    setDialogEmployeeId(null);
    setReviewDialogOpen(true);
  };

  const showMonthEmployees = (employeeId?: string | null) => {
    setWeekFilter("all");
    setPage(1);
    setDialogScope("month");
    setDialogEmployeeId(employeeId || null);
    setReviewDialogOpen(true);
  };

  const showEmployeeReviews = (row: EmployeeReview) => {
    setSelectedEmployeeId(row.employeeId);
    setSelectedWeek(row.weekNumber);
    setExpandedWeeks((current) =>
      current.includes(row.weekNumber) ? current : [...current, row.weekNumber],
    );
    setDialogWeekNumber(row.weekNumber);
    setDialogScope("month");
    setDialogEmployeeId(row.employeeId);
    setReviewDialogOpen(true);
  };

  const editWeekReviews = (weekNumber: number) => {
    showWeekEmployees(weekNumber);
    toast.message(`Opening Weekly Feedback for Week ${weekNumber}`);
    navigate({ to: "/admin/weekly-feedback" });
  };

  const editEmployeeReview = (row: EmployeeReview) => {
    showEmployeeReviews(row);
    toast.message(`Opening Weekly Feedback to edit ${row.employee}'s Week ${row.weekNumber} review`);
    navigate({ to: "/admin/weekly-feedback" });
  };

  const lockWeekReviews = (weekNumber: number) => {
    setLockedWeeks((current) =>
      current.includes(weekNumber) ? current : [...current, weekNumber],
    );
    setStatusFilter("locked");
    setWeekFilter(String(weekNumber) as WeekFilter);
    setPage(1);
    toast.success(`Week ${weekNumber} reviews locked in WR Report`);
    requestAnimationFrame(() => {
      employeeTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const lockEmployeeReview = (row: EmployeeReview) => {
    if (row.status === "completed") {
      toast.message(`${row.employee}'s Week ${row.weekNumber} review is already submitted`);
      showEmployeeReviews(row);
      return;
    }
    lockWeekReviews(row.weekNumber);
  };

  const toggleWeek = (weekNumber: number) => {
    setSelectedWeek(weekNumber);
    setExpandedWeeks((current) =>
      current.includes(weekNumber)
        ? current.filter((item) => item !== weekNumber)
        : [...current, weekNumber],
    );
  };

  return (
    <>
    <PrintableWeeklyReviewReport
      rows={reviewRows}
      weeks={weeks}
      bsYear={bsYear}
      monthName={selectedMonthName}
      stats={stats}
    />
    <div className="space-y-6 print:hidden">
      <PageHeader
        title="WR Report"
        subtitle="Manage and review weekly employee performance across all Nepali months."
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={exportCsv}>
              <FileSpreadsheet size={16} />
              Export Excel
            </Button>
            <Button className="neon-button rounded-xl" onClick={exportPdf}>
              <Download size={16} />
              Export PDF
            </Button>
          </>
        }
      />

      <div className="-mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        <span>/</span>
        <span className="font-medium text-foreground">WR Report</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Total Reviews" value={stats.total} icon={Archive} accent="blue" />
        <StatCard
          label="Current BS Month"
          value={`${selectedMonthName} ${bsYear}`}
          icon={CalendarDays}
          accent="red"
        />
        <StatCard label="Pending Reviews" value={stats.pending} icon={Clock3} accent="amber" />
        <StatCard
          label="Completed Reviews"
          value={stats.completed}
          icon={CheckCircle2}
          accent="green"
        />
        <StatCard
          label="Average Performance Score"
          value={`${stats.average}%`}
          icon={Star}
          accent="red"
        />
        <StatCard
          label="Employees Reviewed"
          value={stats.employeesReviewed}
          icon={UserCheck}
          accent="blue"
        />
      </div>

      <GlassCard className="sticky top-3 z-20 p-4 backdrop-blur-2xl">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[120px_150px_130px_170px_1fr_140px]">
          <Select value={bsYear} onValueChange={setBsYear}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="BS Year" />
            </SelectTrigger>
            <SelectContent>
              {BS_YEARS.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bsMonth} onValueChange={setBsMonth}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="BS Month" />
            </SelectTrigger>
            <SelectContent>
              {BS_MONTHS.map((month, index) => (
                <SelectItem key={month} value={String(index + 1)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={weekFilter} onValueChange={(value) => setWeekFilter(value as WeekFilter)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Weeks</SelectItem>
              {weeks.map((week) => (
                <SelectItem key={week.weekNumber} value={String(week.weekNumber)}>
                  Week {week.weekNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department} value={department}>
                  {department === "all" ? "All Departments" : department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employee, department, position"
              className="rounded-xl pl-9"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <GlassCard className="h-fit p-4 xl:sticky xl:top-28">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <History size={16} className="text-accent" />
            History
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <div className="mb-3 text-sm font-bold">{bsYear}</div>
            <div className="grid gap-1">
              {BS_MONTHS.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  onClick={() => setBsMonth(String(index + 1))}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent/10",
                    Number(bsMonth) === index + 1 && "bg-primary/10 text-primary",
                  )}
                >
                  <span>{month}</span>
                  <span className="text-xs text-muted-foreground">
                    {monthReviewCounts[index + 1] || ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>

        <div className="space-y-5">
          <GlassCard className="p-4" glow="blue">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedMonthName} {bsYear}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Auto-generated BS review weeks: 1-7, 8-14, 15-21, 22-28, and 29-last day.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {weeks.length} review periods
                </div>
                <Button variant="outline" className="rounded-xl" onClick={() => showMonthEmployees()}>
                  <Eye size={16} />
                  View Month
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl" />
                  ))
                : weekSummaries.map(({ week, completed, pending, locked, average, completion }) => {
                    const expanded = expandedWeeks.includes(week.weekNumber);
                    return (
                      <div
                        key={week.weekNumber}
                        className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm transition hover:border-primary/30"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-4 text-left"
                          onClick={() => toggleWeek(week.weekNumber)}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold">Week {week.weekNumber}</h3>
                              <span className="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                                {week.label}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {week.startBs} - {week.endBs} BS
                            </p>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-5 w-5 shrink-0 transition",
                              expanded && "rotate-180 text-primary",
                            )}
                          />
                        </button>

                        {expanded && (
                          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
                            <div className="space-y-3">
                              <div className="grid gap-3 sm:grid-cols-4">
                                <MiniMetric label="Reviews Submitted" value={completed} />
                                <MiniMetric label="Pending" value={pending} />
                                <MiniMetric label="Locked" value={locked} />
                                <MiniMetric label="Average Score" value={`${average}%`} />
                              </div>
                              <Progress value={completion} className="h-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <ActionButton
                                icon={Eye}
                                label="View"
                                onClick={() => showWeekEmployees(week.weekNumber)}
                              />
                              <ActionButton
                                icon={Edit3}
                                label="Edit"
                                disabled={!isAdmin}
                                onClick={() => editWeekReviews(week.weekNumber)}
                              />
                              <ActionButton
                                icon={LockKeyhole}
                                label="Lock"
                                disabled={!isAdmin || lockedWeeks.includes(week.weekNumber)}
                                onClick={() => lockWeekReviews(week.weekNumber)}
                              />
                              <ActionButton icon={Download} label="Export PDF" onClick={exportPdf} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          </GlassCard>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <GlassCard className="p-4">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays size={17} className="text-primary" />
                <h2 className="text-lg font-bold">BS Calendar View</h2>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {buildCalendarCells(Number(bsYear), Number(bsMonth)).map((cell, index) =>
                  cell ? (
                    <button
                      key={cell.bsDate}
                      type="button"
                      onClick={() => setSelectedWeek(cell.weekNumber)}
                      className={cn(
                        "min-h-16 rounded-xl border border-border bg-card/50 p-2 text-left transition hover:border-primary/40",
                        selectedWeek === cell.weekNumber && "border-primary bg-primary/10",
                      )}
                    >
                      <div className="font-bold">{cell.day}</div>
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        W{cell.weekNumber}
                      </div>
                    </button>
                  ) : (
                    <div key={`empty-${index}`} />
                  ),
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-4" glow="red">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 size={17} className="text-accent" />
                <h2 className="text-lg font-bold">Review Summary</h2>
              </div>
              <div className="space-y-4">
                <SummaryRow label="Selected week" value={`Week ${selectedWeek}`} />
                <SummaryRow label="Employees" value={selectedSummary.total} />
                <SummaryRow label="Completed" value={selectedSummary.completed} />
                <SummaryRow label="Pending" value={selectedSummary.pending} />
                <SummaryRow label="Completion" value={`${selectedSummary.completion}%`} />
                <SummaryRow label="Performance" value={`${selectedSummary.average}%`} />
                <Progress value={selectedSummary.completion} className="h-2" />
              </div>
            </GlassCard>
          </div>

          <div ref={employeeTableRef}>
          <GlassCard className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Employee Review Table</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredRows.length} rows after current filters
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCsv}>
                  <FileSpreadsheet size={14} />
                  Excel
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={exportPdf}>
                  <Printer size={14} />
                  Print
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : pageRows.length ? (
              <>
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>BS Date Range</TableHead>
                        <TableHead>Submission Date</TableHead>
                        <TableHead>Performance Score</TableHead>
                        <TableHead>Performance Measure</TableHead>
                        <TableHead>Reviewer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left font-semibold text-foreground transition hover:text-primary"
                              onClick={() => showEmployeeReviews(row)}
                            >
                              {row.employee}
                            </button>
                            <div className="text-xs text-muted-foreground">{row.position}</div>
                          </TableCell>
                          <TableCell>{row.department}</TableCell>
                          <TableCell>Week {row.weekNumber}</TableCell>
                          <TableCell>{row.bsRange}</TableCell>
                          <TableCell>{row.submissionDate}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="w-10 font-semibold tabular-nums">{row.score}%</span>
                              <Progress value={row.score} className="h-2 w-24" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <PerformanceMeasureBadge rating={row.rating} status={row.status} />
                          </TableCell>
                          <TableCell>{row.reviewer}</TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <IconAction
                                icon={Eye}
                                label={`View ${row.employee}`}
                                onClick={() => showEmployeeReviews(row)}
                              />
                              <IconAction
                                icon={Edit3}
                                label={`Edit ${row.employee}`}
                                disabled={!isAdmin}
                                onClick={() => editEmployeeReview(row)}
                              />
                              <IconAction
                                icon={LockKeyhole}
                                label={`Lock ${row.employee}`}
                                disabled={!isAdmin || row.status === "locked"}
                                onClick={() => lockEmployeeReview(row)}
                              />
                              <IconAction icon={Download} label="PDF" onClick={exportPdf} />
                              <IconAction icon={Printer} label="Print" onClick={exportPdf} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={page === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      disabled={page === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState />
            )}
          </GlassCard>
          </div>



          <div className="grid gap-5 xl:grid-cols-2">
            <ChartCard title="Weekly Performance Trend" icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData.weekly}>
                  <defs>
                    <linearGradient id="scoreTrend" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="var(--neon-blue)" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="var(--neon-blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="average"
                    stroke="var(--neon-blue)"
                    fill="url(#scoreTrend)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Department Comparison" icon={Users}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData.departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="department" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="average" fill="var(--neon-red)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Completion Rate" icon={CheckCircle2}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={chartData.completion}
                    innerRadius={66}
                    outerRadius={98}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.completion.map((entry, index) => (
                      <Cell key={entry.name} fill={index === 0 ? "var(--success)" : "var(--warning)"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Average Weekly Score" icon={BarChart3}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData.weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="var(--neon-red)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <RankingCard
              title="Top Performing Employees"
              icon={ShieldCheck}
              rows={topEmployees}
              tone="success"
            />
            <RankingCard
              title="Lowest Performance Trend"
              icon={TrendingDown}
              rows={lowTrend}
              tone="warning"
            />
          </div>
        </div>
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-7xl overflow-hidden rounded-3xl border-border bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
          <div className="flex max-h-[92vh] flex-col">
            <DialogHeader className="border-b border-border px-6 py-5 text-left">
              <DialogTitle className="text-2xl font-bold">
                {dialogScope === "month"
                  ? `${selectedMonthName} ${bsYear} Monthly Review Employees`
                  : `Week ${dialogWeekNumber} Review Employees`}
              </DialogTitle>
              <DialogDescription>
                {selectedMonthName} {bsYear} / select an employee to view{" "}
                {dialogScope === "month" ? "all weekly reviews for this month." : "this period's review."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[380px_minmax(0,1fr)]">
              <div className="min-h-0 overflow-y-auto border-r border-border bg-card/30 p-4">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <h3 className="font-bold">Employees</h3>
                    <p className="text-xs text-muted-foreground">
                      {dialogRows.length} in this {dialogScope}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {dialogScope === "month" ? "Full Month" : `Week ${dialogWeekNumber}`}
                  </span>
                </div>
                <div className="grid gap-2">
                  {dialogRows.map((row, index) => {
                    const profile = profiles.find((item) => item.user_id === row.employeeId);
                    return (
                      <EmployeeReviewStackItem
                        key={row.id}
                        row={row}
                        rank={index + 1}
                        avatarUrl={profile?.avatar_url}
                        active={dialogEmployeeId === row.employeeId}
                        onClick={() => setDialogEmployeeId(row.employeeId)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto bg-background p-5">
                {dialogEmployee ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-border bg-background/70 p-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar name={dialogEmployee.employee} avatarUrl={dialogEmployeeProfile?.avatar_url} size="lg" />
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-bold">{dialogEmployee.employee}</h3>
                          <p className="text-sm font-semibold text-muted-foreground">
                            {dialogEmployee.department} / {dialogEmployee.position}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniMetric
                          label={dialogScope === "month" ? "Month" : "Week"}
                          value={dialogScope === "month" ? selectedMonthName : dialogEmployee.weekNumber}
                        />
                        <MiniMetric label="Score" value={`${dialogEmployee.score}%`} />
                        <MiniMetric
                          label="Reviews"
                          value={
                            dialogEmployee.periodCount
                              ? `${dialogEmployee.submittedCount || 0}/${dialogEmployee.periodCount}`
                              : dialogEmployee.status
                          }
                        />
                        <MiniMetric label="Performance" value={formatPerformanceMeasure(dialogEmployee.rating)} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold">
                          {dialogScope === "month"
                            ? `All Weekly Reviews / ${selectedMonthName} ${bsYear}`
                            : `Week ${dialogWeekNumber} Review / ${selectedMonthName} ${bsYear}`}
                        </h4>
                        <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
                          {dialogEmployeeHistory.length} reviews
                        </span>
                      </div>
                      {dialogEmployeeHistory.length ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {dialogEmployeeHistory.map((review) => (
                            <div key={review.id} className="rounded-2xl border border-border bg-background/70 p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-bold">{review.bsLabel}</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Week {review.weekNumber} / Submitted {review.submissionDate}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-lg font-black text-primary">
                                  {review.score}%
                                </div>
                              </div>
                              <div className="mt-3">
                                <Progress value={review.score} className="h-2" />
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                                <div>
                                  <span className="font-semibold text-foreground">Rating:</span>{" "}
                                  {review.rating}
                                </div>
                                {review.summary && (
                                  <div>
                                    <span className="font-semibold text-foreground">Notes:</span>{" "}
                                    {review.summary}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                          No weekly review found for this employee in{" "}
                          {dialogScope === "month"
                            ? `${selectedMonthName} ${bsYear}`
                            : `Week ${dialogWeekNumber} of ${selectedMonthName} ${bsYear}`}.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
                    <div>
                      <Users className="mx-auto mb-3 h-10 w-10 text-primary" />
                      <h3 className="text-lg font-bold">Select an employee</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Click a card to view that employee's weekly review history here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PrintableWeeklyReviewReport({
  rows,
  weeks,
  bsYear,
  monthName,
  stats,
}: {
  rows: EmployeeReview[];
  weeks: ReviewWeek[];
  bsYear: string;
  monthName: string;
  stats: {
    total: number;
    completed: number;
    pending: number;
    locked: number;
    average: number;
    employeesReviewed: number;
    totalEmployees: number;
  };
}) {
  const completedRows = rows.filter((row) => row.status === "completed");
  const weekSummaries = weeks.map((week) => ({
    week,
    ...getWeekSummary(week.weekNumber, rows),
  }));

  return (
    <div className="hidden print:block bg-white text-black">
      <div className="mb-8">
        <div className="mb-6 flex items-start justify-between">
          <div className="mr-10 mt-6 flex flex-1 flex-col items-center justify-center">
            <h1 className="whitespace-nowrap font-serif text-[3.25rem] font-black leading-none tracking-[0.3em] text-black">
              A S L E N I X
            </h1>
            <p className="mt-4 whitespace-nowrap text-[1.1rem] font-bold tracking-[0.4em] text-black">
              T E C H & S O L U T I O N
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center">
            <div className="mb-2 font-serif text-[15px] font-bold text-black">
              PAN No: 623611557
            </div>
            <img src={logoMarkUrl} alt="Logo" className="h-[88px] w-[88px] object-contain" />
            <span className="text-xl font-black uppercase tracking-widest text-[#1065F5]">
              ASLENIX
            </span>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between border-b-[1.5px] border-black px-2 pb-2 font-serif text-[15px] font-bold text-black">
          <div>Reg No: 391840/82/83</div>
          <div>DATE: {formatBsInput()}</div>
        </div>

        <div className="mb-4 mt-8 text-center">
          <h2 className="text-xl font-bold uppercase underline decoration-2 underline-offset-4">
            WEEKLY REVIEW REPORT OF {monthName} {bsYear} BS
          </h2>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-6 gap-2 text-center text-[11px]">
        <PrintStat label="Total Reviews" value={stats.total} />
        <PrintStat label="Completed" value={stats.completed} />
        <PrintStat label="Pending" value={stats.pending} />
        <PrintStat label="Locked" value={stats.locked} />
        <PrintStat label="Avg Score" value={`${stats.average}%`} />
        <PrintStat label="Employees Reviewed" value={stats.employeesReviewed} />
      </div>

      <table className="mb-5 w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-100">
            <PrintTh>Week</PrintTh>
            <PrintTh>BS Date Range</PrintTh>
            <PrintTh>Submitted</PrintTh>
            <PrintTh>Pending</PrintTh>
            <PrintTh>Locked</PrintTh>
            <PrintTh>Average Score</PrintTh>
          </tr>
        </thead>
        <tbody>
          {weekSummaries.map(({ week, completed, pending, locked, average }) => (
            <tr key={week.weekNumber}>
              <PrintTd>Week {week.weekNumber}</PrintTd>
              <PrintTd>{week.startBs} - {week.endBs} BS</PrintTd>
              <PrintTd>{completed}</PrintTd>
              <PrintTd>{pending}</PrintTd>
              <PrintTd>{locked}</PrintTd>
              <PrintTd>{average}%</PrintTd>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-2 text-sm font-bold uppercase">Submitted Weekly Reviews</h3>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-100">
            <PrintTh>Employee</PrintTh>
            <PrintTh>Department</PrintTh>
            <PrintTh>Week</PrintTh>
            <PrintTh>BS Date Range</PrintTh>
            <PrintTh>Submitted Date</PrintTh>
            <PrintTh>Score</PrintTh>
            <PrintTh>Reviewer</PrintTh>
            <PrintTh>Status</PrintTh>
            <PrintTh>Rating</PrintTh>
          </tr>
        </thead>
        <tbody>
          {completedRows.length ? (
            completedRows.map((row) => (
              <tr key={row.id}>
                <PrintTd>{row.employee}</PrintTd>
                <PrintTd>{row.department}</PrintTd>
                <PrintTd>Week {row.weekNumber}</PrintTd>
                <PrintTd>{row.bsRange}</PrintTd>
                <PrintTd>{row.submissionDate}</PrintTd>
                <PrintTd>{row.score}%</PrintTd>
                <PrintTd>{row.reviewer}</PrintTd>
                <PrintTd>{row.status}</PrintTd>
                <PrintTd>{row.rating}</PrintTd>
              </tr>
            ))
          ) : (
            <tr>
              <PrintTd colSpan={9}>No submitted weekly reviews found for this month.</PrintTd>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 grid grid-cols-2 gap-12 text-[11px]">
        <div className="border-t border-black pt-2">Prepared By</div>
        <div className="border-t border-black pt-2 text-right">Approved By</div>
      </div>
    </div>
  );
}

function PrintStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-black p-2">
      <div className="font-bold uppercase">{label}</div>
      <div className="mt-1 text-base font-black">{value}</div>
    </div>
  );
}

function PrintTh({ children }: { children: React.ReactNode }) {
  return <th className="border border-black px-2 py-1 text-left font-bold">{children}</th>;
}

function PrintTd({
  children,
  colSpan,
}: {
  children: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className="border border-black px-2 py-1 align-top">
      {children}
    </td>
  );
}

function EmployeeReviewCard({
  row,
  rank,
  avatarUrl,
  active,
  onClick,
}: {
  row: EmployeeReview;
  rank: number;
  avatarUrl?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const attendance = row.status === "completed" ? Math.max(25, Math.min(100, row.score + 20)) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-3xl border bg-card/80 p-5 text-left shadow-xl shadow-foreground/5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2xl",
        active
          ? "border-primary/35 bg-gradient-to-br from-sky-50/80 via-card to-rose-50/80 ring-2 ring-primary/15 dark:from-sky-950/25 dark:to-rose-950/25"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-4">
        <EmployeeAvatar name={row.employee} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold text-foreground">{row.employee}</div>
          <div className="truncate text-sm font-semibold text-muted-foreground">{row.department}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700 text-base font-black text-white shadow-lg">
          #{rank}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <ReviewCardMetric label="Score" value={row.score} />
        <ReviewCardMetric label="Tasks" value={row.status === "completed" ? 1 : 0} max={5} />
        <ReviewCardMetric label="Attend" value={attendance} />
      </div>
    </button>
  );
}

function EmployeeReviewStackItem({
  row,
  rank,
  avatarUrl,
  active,
  onClick,
}: {
  row: EmployeeReview;
  rank: number;
  avatarUrl?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-background/75 p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5",
        active && "border-primary/45 bg-primary/10 ring-2 ring-primary/10",
      )}
    >
      <EmployeeAvatar name={row.employee} avatarUrl={avatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-foreground">{row.employee}</div>
        <div className="truncate text-sm font-semibold text-muted-foreground">{row.department}</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ReviewCardMetric label="Score" value={row.score} />
          <ReviewCardMetric
            label="Reviews"
            value={row.submittedCount ?? (row.status === "completed" ? 1 : 0)}
            max={row.periodCount ?? 5}
          />
          <ReviewCardMetric
            label="Attend"
            value={row.status === "completed" ? Math.max(25, Math.min(100, row.score + 20)) : 0}
          />
        </div>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-black text-white">
        #{rank}
      </div>
    </button>
  );
}

function ReviewCardMetric({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = max === 100 ? value : Math.round((value / max) * 100);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-wide text-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{max === 100 ? `${value}%` : value}</span>
      </div>
      <div className="h-2 rounded-full border border-border bg-background shadow-inner">
        <div className="h-full rounded-full bg-slate-600" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function EmployeeAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <Avatar className={cn("border border-border bg-background", size === "lg" ? "h-14 w-14" : "h-12 w-12")}>
      <AvatarImage src={avatarUrl || ""} alt={name} />
      <AvatarFallback className="font-bold text-primary">{initials || "WR"}</AvatarFallback>
    </Avatar>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: StatusFilter }) {
  const styles = {
    all: "bg-muted text-muted-foreground",
    completed: "bg-success/10 text-success border-success/20",
    pending: "bg-warning/10 text-warning border-warning/20",
    locked: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold capitalize", styles[status])}>
      {status}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: any;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="justify-start rounded-xl"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} />
      {label}
    </Button>
  );
}

function IconAction({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: any;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-lg"
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      <Icon size={14} />
    </Button>
  );
}

function ChartCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={17} className="text-primary" />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {children}
    </GlassCard>
  );
}

function RankingCard({
  title,
  icon: Icon,
  rows,
  tone,
}: {
  title: string;
  icon: any;
  rows: EmployeeReview[];
  tone: "success" | "warning";
}) {
  return (
    <GlassCard className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon size={17} className={tone === "success" ? "text-success" : "text-warning"} />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <div className="space-y-2">
        {rows.length ? (
          rows.map((row, index) => (
            <div key={`${row.id}-${index}`} className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-3">
              <div>
                <div className="font-semibold">{row.employee}</div>
                <div className="text-xs text-muted-foreground">
                  {row.department} / Week {row.weekNumber}
                </div>
              </div>
              <div className="text-xl font-bold tabular-nums">{row.score}%</div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No completed reviews yet.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <BarChart3 size={28} />
      </div>
      <h3 className="text-xl font-bold">No weekly reviews found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Try a different BS month, department, week, status, or employee search.
      </p>
    </div>
  );
}

function buildBsReviewWeeks(year: number, month: number): ReviewWeek[] {
  const lastDay = getBsMonthLastDay(year, month);
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
    [29, lastDay],
  ].filter(([start]) => start <= lastDay);

  return ranges.map(([startDay, endDay], index) => {
    const startDate = new NepaliDate(year, month - 1, startDay).toJsDate();
    const endDate = new NepaliDate(year, month - 1, endDay).toJsDate();
    return {
      weekNumber: index + 1,
      startDay,
      endDay,
      startBs: `${startDay} ${BS_MONTHS[month - 1]}`,
      endBs: `${endDay} ${BS_MONTHS[month - 1]}`,
      startAd: format(startDate, "yyyy-MM-dd"),
      endAd: format(endDate, "yyyy-MM-dd"),
      label:
        index === 4
          ? `${startDay}-Last Day of Month`
          : `${startDay}-${endDay} ${BS_MONTHS[month - 1]}`,
    };
  });
}

function buildCalendarCells(year: number, month: number) {
  const first = new NepaliDate(year, month - 1, 1);
  const lastDay = getBsMonthLastDay(year, month);
  const cells: ({ day: number; bsDate: string; weekNumber: number } | null)[] = [];

  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let day = 1; day <= lastDay; day++) {
    cells.push({
      day,
      bsDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      weekNumber: Math.min(5, Math.ceil(day / 7)),
    });
  }

  return cells;
}

function getBsMonthLastDay(year: number, month: number) {
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 0 : month;
  const end = new NepaliDate(nextYear, nextMonth, 1).toJsDate();
  end.setDate(end.getDate() - 1);
  return new NepaliDate(end).getDate();
}

function buildEmployeeReviewRows(
  profiles: ProfileRow[],
  reviews: ReviewRow[],
  weeks: ReviewWeek[],
  bsYear: number,
  bsMonth: number,
): EmployeeReview[] {
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));

  return profiles.flatMap((profile) =>
    weeks.map((week) => {
      const review = reviews.find(
        (item) =>
          item.employee_id === profile.user_id && isReviewInBsWeek(item, week, bsYear, bsMonth),
      );
      const score = Math.round(Number(review?.review_score ?? review?.score ?? 0));
      const locked = review?.unlock_date ? new Date(`${review.unlock_date}T23:59:59`) > new Date() : false;
      const status: StatusFilter = review ? "completed" : locked ? "locked" : "pending";
      const reviewerProfile = review?.admin_id ? profileMap.get(review.admin_id) : null;

      return {
        id: review?.id ?? `${profile.user_id}-${week.weekNumber}`,
        employeeId: profile.user_id,
        employee: profile.full_name || "Unnamed Employee",
        department: profile.department || "Unassigned",
        position: profile.position || "Team member",
        weekNumber: week.weekNumber,
        bsRange: `${week.startBs} - ${week.endBs}`,
        submissionDate: review?.created_at ? format(new Date(review.created_at), "MMM d, yyyy") : "-",
        score,
        reviewer: reviewerProfile?.full_name || "Admin",
        status,
        rating: review?.rating || "-",
      };
    }),
  );
}

async function loadWeeklyFeedbackRows() {
  const selectAttempts = [
    "id, employee_id, admin_id, week_number, week_start, nepali_year, nepali_month, unlock_date, rating, strengths, improvements, admin_notes, notes, score, review_score, created_at, updated_at",
    "id, employee_id, week_number, week_start, nepali_year, nepali_month, unlock_date, rating, strengths, improvements, admin_notes, notes, score, created_at, updated_at",
    "id, employee_id, admin_id, week_number, week_start, rating, strengths, improvements, admin_notes, notes, score, review_score, created_at, updated_at",
    "id, employee_id, admin_id, week_start, rating, strengths, improvements, notes, score, created_at, updated_at",
    "id, employee_id, week_start, rating, score, created_at",
  ];

  let lastError: unknown = null;

  for (const selectColumns of selectAttempts) {
    const result = await (supabase as any)
      .from("weekly_feedback")
      .select(selectColumns)
      .order("week_start", { ascending: false });

    if (!result.error) {
      return {
        data: (result.data ?? []).map(normalizeReviewRow),
        error: null,
      };
    }

    lastError = result.error;
  }

  return { data: [], error: lastError };
}

function normalizeReviewRow(row: Partial<ReviewRow>): ReviewRow {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    employee_id: String(row.employee_id ?? ""),
    admin_id: row.admin_id ?? null,
    week_number: row.week_number ?? null,
    week_start: row.week_start ?? null,
    nepali_year: row.nepali_year ?? null,
    nepali_month: row.nepali_month ?? null,
    unlock_date: row.unlock_date ?? null,
    rating: row.rating ?? null,
    strengths: row.strengths ?? null,
    improvements: row.improvements ?? null,
    admin_notes: row.admin_notes ?? null,
    notes: row.notes ?? null,
    score: row.score ?? null,
    review_score: row.review_score ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function isReviewInBsWeek(review: ReviewRow, week: ReviewWeek, bsYear: number, bsMonth: number) {
  if (review.nepali_year && review.nepali_month != null && review.week_number != null) {
    const reviewMonth = Number(review.nepali_month);
    const monthMatches = reviewMonth === bsMonth - 1 || reviewMonth === bsMonth;
    return review.nepali_year === bsYear && monthMatches && review.week_number === week.weekNumber;
  }

  if (!review.week_start) return false;
  const reviewDate = review.week_start.slice(0, 10);
  if (reviewDate >= week.startAd && reviewDate <= week.endAd) return true;

  const bsDate = new NepaliDate(new Date(`${reviewDate}T00:00:00`));
  return (
    bsDate.getYear() === bsYear &&
    bsDate.getMonth() + 1 === bsMonth &&
    Math.min(5, Math.ceil(bsDate.getDate() / 7)) === week.weekNumber
  );
}

function buildEmployeeHistory(
  employeeId: string | null,
  profiles: ProfileRow[],
  reviews: ReviewRow[],
) {
  if (!employeeId) return [];
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  return reviews
    .filter((review) => review.employee_id === employeeId)
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.week_start || a.created_at || 0).getTime();
      const bTime = new Date(b.week_start || b.created_at || 0).getTime();
      return bTime - aTime;
    })
    .map((review) => {
      const weekStart = review.week_start || review.created_at || "";
      const bsDate = weekStart ? new NepaliDate(new Date(`${weekStart.slice(0, 10)}T00:00:00`)) : null;
      const month = bsDate ? BS_MONTHS[bsDate.getMonth()] : "BS";
      const score = Math.round(Number(review.review_score ?? review.score ?? 0));
      const reviewer = review.admin_id ? profileMap.get(review.admin_id)?.full_name : null;
      return {
        id: review.id,
        weekNumber: review.week_number || (bsDate ? Math.min(5, Math.ceil(bsDate.getDate() / 7)) : 0),
        bsLabel: bsDate ? `${month} ${bsDate.getYear()} BS` : "Review period",
        submissionDate: review.created_at ? format(new Date(review.created_at), "MMM d, yyyy") : "-",
        score,
        rating: review.rating || "-",
        reviewer: reviewer || "Admin",
        summary: review.admin_notes || review.notes || review.strengths || review.improvements || "",
      };
    });
}

function buildEmployeePeriodHistory(
  employeeId: string | null,
  profiles: ProfileRow[],
  reviews: ReviewRow[],
  weeks: ReviewWeek[],
  bsYear: number,
  bsMonth: number,
  weekNumber?: number,
) {
  const matchingWeeks = weekNumber
    ? weeks.filter((week) => week.weekNumber === weekNumber)
    : weeks;
  return buildEmployeeHistory(
    employeeId,
    profiles,
    reviews.filter((review) =>
      matchingWeeks.some((week) => isReviewInBsWeek(review, week, bsYear, bsMonth)),
    ),
  );
}

function buildDialogEmployeeRows(rows: EmployeeReview[], profiles: ProfileRow[]) {
  const rowsByEmployee = new Map<string, EmployeeReview[]>();
  rows.forEach((row) => {
    rowsByEmployee.set(row.employeeId, [...(rowsByEmployee.get(row.employeeId) || []), row]);
  });

  return profiles
    .map((profile) => {
      const employeeRows = rowsByEmployee.get(profile.user_id) || [];
      if (!employeeRows.length) return null;
      const completedRows = employeeRows.filter((row) => row.status === "completed");
      const lockedRows = employeeRows.filter((row) => row.status === "locked");
      const first = employeeRows[0];
      const score = average(completedRows.map((row) => row.score));
      const status: StatusFilter =
        completedRows.length === employeeRows.length
          ? "completed"
          : lockedRows.length
            ? "locked"
            : "pending";

      return {
        ...first,
        id: `${profile.user_id}-${employeeRows.map((row) => row.id).join("-")}`,
        employee: profile.full_name || first.employee,
        department: profile.department || first.department,
        position: profile.position || first.position,
        weekNumber: employeeRows.length === 1 ? first.weekNumber : 0,
        bsRange: employeeRows.length === 1 ? first.bsRange : "Full month",
        submissionDate:
          employeeRows.length === 1
            ? first.submissionDate
            : `${completedRows.length}/${employeeRows.length} submitted`,
        score,
        status,
        submittedCount: completedRows.length,
        periodCount: employeeRows.length,
      };
    })
    .filter(Boolean) as EmployeeReview[];
}

function getMonthReviewCounts(reviews: ReviewRow[], bsYear: number) {
  return reviews.reduce<Record<number, number>>((counts, review) => {
    let month: number | null = null;
    if (review.nepali_year === bsYear && review.nepali_month != null) {
      const storedMonth = Number(review.nepali_month);
      month = storedMonth >= 0 && storedMonth <= 11 ? storedMonth + 1 : storedMonth;
    } else if (review.week_start) {
      const bsDate = new NepaliDate(new Date(`${review.week_start.slice(0, 10)}T00:00:00`));
      if (bsDate.getYear() === bsYear) month = bsDate.getMonth() + 1;
    }

    if (month) counts[month] = (counts[month] || 0) + 1;
    return counts;
  }, {});
}

function getStats(rows: EmployeeReview[], totalEmployees: number) {
  const completedRows = rows.filter((row) => row.status === "completed");
  const pending = rows.filter((row) => row.status === "pending").length;
  const locked = rows.filter((row) => row.status === "locked").length;
  return {
    total: rows.length,
    completed: completedRows.length,
    pending,
    locked,
    average: average(completedRows.map((row) => row.score)),
    employeesReviewed: new Set(completedRows.map((row) => row.employeeId)).size || 0,
    totalEmployees,
  };
}

function getWeekSummary(weekNumber: number, rows: EmployeeReview[]) {
  const weekRows = rows.filter((row) => row.weekNumber === weekNumber);
  const completed = weekRows.filter((row) => row.status === "completed").length;
  const pending = weekRows.filter((row) => row.status === "pending").length;
  const locked = weekRows.filter((row) => row.status === "locked").length;
  return {
    total: weekRows.length,
    completed,
    pending,
    locked,
    average: average(weekRows.filter((row) => row.status === "completed").map((row) => row.score)),
    completion: weekRows.length ? Math.round((completed / weekRows.length) * 100) : 0,
  };
}

function buildChartData(rows: EmployeeReview[], weeks: ReviewWeek[]) {
  const weekly = weeks.map((week) => {
    const summary = getWeekSummary(week.weekNumber, rows);
    return { week: `Week ${week.weekNumber}`, average: summary.average, completion: summary.completion };
  });

  const departments = Array.from(new Set(rows.map((row) => row.department))).map((department) => {
    const departmentRows = rows.filter(
      (row) => row.department === department && row.status === "completed",
    );
    return { department, average: average(departmentRows.map((row) => row.score)) };
  });

  const completed = rows.filter((row) => row.status === "completed").length;
  const remaining = rows.length - completed;

  return {
    weekly,
    departments,
    completion: [
      { name: "Completed", value: completed },
      { name: "Remaining", value: remaining },
    ],
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function toCsv(rows: EmployeeReview[]) {
  const headers = [
    "Employee",
    "Department",
    "Week",
    "BS Date Range",
    "Submission Date",
    "Performance Score",
    "Reviewer",
    "Status",
  ];
  const lines = rows.map((row) =>
    [
      row.employee,
      row.department,
      `Week ${row.weekNumber}`,
      row.bsRange,
      row.submissionDate,
      row.score,
      row.reviewer,
      row.status,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
