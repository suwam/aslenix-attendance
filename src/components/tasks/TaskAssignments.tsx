import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Flag,
  Gauge,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldQuestion,
  ThumbsDown,
  Timer,
  UserCheck,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  WorkAssignmentModal,
  WorkAssignmentData,
  TaskAssignmentStatus,
} from "./WorkAssignmentModal";
import { TASK_COMPLEXITY_LABELS, type TaskComplexity } from "@/lib/employee-scoring";
import type { Database } from "@/integrations/supabase/types";

type TaskPriority = Database["public"]["Enums"]["task_priority"];

interface UserOption {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface TaskAssignmentsProps {
  assignments: WorkAssignmentData[];
  employees: UserOption[];
  onAdd: (data: WorkAssignmentData) => void;
  onUpdate: (data: WorkAssignmentData) => void;
  onRemove: (id: string) => void;
  onProgressChange?: (id: string, progress: number) => void;
  onComment?: () => void;
  canEditAny: boolean;
  currentUserId: string;
  taskTitle?: string;
  taskDescription?: string | null;
  taskDeadline?: string | null;
  taskPriority?: TaskPriority;
  attachmentsCount?: number;
  verifierName?: string;
}

const COMPLEXITY_HOURS: Record<TaskComplexity, number> = {
  small: 4,
  medium: 8,
  large: 16,
  epic: 32,
};

const COMPLEXITY_STYLES: Record<TaskComplexity, string> = {
  small: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  large: "border-amber-200 bg-amber-50 text-amber-700",
  epic: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600",
  medium: "border-blue-200 bg-blue-50 text-blue-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

function isThisWeek(dateValue?: string | null) {
  if (!dateValue) return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return date >= start && date < end;
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return "No due date";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatUpdated(dateValue?: string | null) {
  if (!dateValue) return "Just now";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getStatusDisplay(status: TaskAssignmentStatus) {
  switch (status) {
    case "not_started":
      return {
        label: "Not Started",
        icon: Clock3,
        className: "border-slate-200 bg-slate-50 text-slate-600",
        dot: "bg-slate-400",
      };
    case "in_progress":
      return {
        label: "In Progress",
        icon: Zap,
        className: "border-blue-200 bg-blue-50 text-blue-700",
        dot: "bg-blue-500",
      };
    case "under_review":
      return {
        label: "Under Review",
        icon: ShieldQuestion,
        className: "border-violet-200 bg-violet-50 text-violet-700",
        dot: "bg-violet-500",
      };
    case "completed":
      return {
        label: "Completed",
        icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
      };
    case "blocked":
      return {
        label: "Blocked",
        icon: AlertTriangle,
        className: "border-red-200 bg-red-50 text-red-700",
        dot: "bg-red-500",
      };
    case "approved":
      return {
        label: "Verified",
        icon: ShieldCheck,
        className: "border-green-200 bg-green-50 text-green-700",
        dot: "bg-green-500",
      };
    case "rejected":
      return {
        label: "Rejected",
        icon: ThumbsDown,
        className: "border-rose-200 bg-rose-50 text-rose-700",
        dot: "bg-rose-500",
      };
  }
}

function getVerificationDisplay(status: TaskAssignmentStatus) {
  if (status === "approved") {
    return {
      label: "Verified",
      icon: ShieldCheck,
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }
  if (status === "rejected") {
    return {
      label: "Rejected",
      icon: ThumbsDown,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (status === "under_review" || status === "completed") {
    return {
      label: "Pending Review",
      icon: ShieldQuestion,
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }
  return {
    label: "Waiting Verification",
    icon: AlertCircle,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof CheckCircle2;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0 text-[10px] font-semibold uppercase leading-4 text-slate-500">
          {label}
        </span>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}`}>
          <Icon size={13} />
        </span>
      </div>
      <div className="mt-3 truncate text-2xl font-semibold leading-none text-slate-950">
        {value}
      </div>
    </div>
  );
}

export function TaskAssignments({
  assignments,
  employees,
  onAdd,
  onUpdate,
  onProgressChange,
  onComment,
  canEditAny,
  currentUserId,
  taskTitle = "Untitled task",
  taskDescription,
  taskDeadline,
  taskPriority = "medium",
  attachmentsCount = 0,
  verifierName = "Team Lead",
}: TaskAssignmentsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<WorkAssignmentData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskAssignmentStatus>("all");

  const sprintAssignments = useMemo(
    () =>
      assignments.filter((assignment) =>
        isThisWeek(assignment.due_date || taskDeadline || assignment.assigned_at),
      ),
    [assignments, taskDeadline],
  );

  const summary = useMemo(() => {
    const source = sprintAssignments;
    const weightFor = (assignment: WorkAssignmentData) =>
      COMPLEXITY_HOURS[assignment.complexity || "medium"];
    const totalWeight = source.reduce((sum, assignment) => sum + weightFor(assignment), 0);
    const completedWeight = source.reduce(
      (sum, assignment) =>
        sum + weightFor(assignment) * (Math.min(100, Math.max(0, assignment.progress || 0)) / 100),
      0,
    );

    return {
      total: source.length,
      completed: source.filter((a) => a.status === "completed" || a.status === "approved").length,
      inProgress: source.filter((a) => a.status === "in_progress").length,
      underReview: source.filter((a) => a.status === "under_review" || a.status === "completed")
        .length,
      blocked: source.filter((a) => a.status === "blocked").length,
      verified: source.filter((a) => a.status === "approved").length,
      waitingVerification: source.filter((a) =>
        ["not_started", "in_progress", "blocked"].includes(a.status),
      ).length,
      weightedProgress: totalWeight ? Math.round((completedWeight / totalWeight) * 100) : 0,
    };
  }, [sprintAssignments]);

  const filteredAssignments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return assignments.filter((assignment) => {
      if (statusFilter !== "all" && assignment.status !== statusFilter) return false;
      if (!query) return true;

      const employee = employees.find((e) => e.user_id === assignment.user_id);
      return (
        employee?.full_name.toLowerCase().includes(query) ||
        assignment.responsibility.toLowerCase().includes(query) ||
        assignment.notes?.toLowerCase().includes(query)
      );
    });
  }, [assignments, employees, searchQuery, statusFilter]);

  const handleEdit = (assignment: WorkAssignmentData) => {
    setEditingData(assignment);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingData(null);
    setIsModalOpen(true);
  };

  const handleSave = (data: WorkAssignmentData) => {
    if (data.id) {
      onUpdate(data);
    } else {
      onAdd(data);
    }
  };

  const handleVerify = (assignment: WorkAssignmentData) => {
    if (!canEditAny) return;
    onUpdate({ ...assignment, status: "approved", progress: 100 });
  };

  const existingAssignments = assignments.filter((a) => a !== editingData);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                Weekly Sprint Summary
              </Badge>
              <Badge
                variant="outline"
                className={`gap-1.5 capitalize ${PRIORITY_STYLES[taskPriority]}`}
              >
                <Flag size={12} />
                {taskPriority} priority
              </Badge>
            </div>
            <h3 className="mt-2 text-base font-semibold text-slate-950">{taskTitle}</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              {taskDescription || "Track ownership, delivery progress, and review readiness."}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Weighted progress</span>
              <span className="font-semibold text-slate-950">{summary.weightedProgress}%</span>
            </div>
            <Progress value={summary.weightedProgress} className="mt-2 h-2" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">
          <StatTile
            label="Total tasks"
            value={summary.total}
            icon={FileText}
            tone="bg-slate-100 text-slate-700"
          />
          <StatTile
            label="Completed"
            value={summary.completed}
            icon={CheckCircle2}
            tone="bg-emerald-100 text-emerald-700"
          />
          <StatTile
            label="In progress"
            value={summary.inProgress}
            icon={Zap}
            tone="bg-blue-100 text-blue-700"
          />
          <StatTile
            label="Under review"
            value={summary.underReview}
            icon={ShieldQuestion}
            tone="bg-violet-100 text-violet-700"
          />
          <StatTile
            label="Blocked"
            value={summary.blocked}
            icon={AlertTriangle}
            tone="bg-red-100 text-red-700"
          />
          <StatTile
            label="Verified"
            value={summary.verified}
            icon={ShieldCheck}
            tone="bg-green-100 text-green-700"
          />
          <StatTile
            label="Waiting"
            value={summary.waitingVerification}
            icon={Clock3}
            tone="bg-amber-100 text-amber-700"
          />
          <StatTile
            label="Weighted"
            value={`${summary.weightedProgress}%`}
            icon={Gauge}
            tone="bg-cyan-100 text-cyan-700"
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px]">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search member, task, or note"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-md border-slate-200 bg-white pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="approved">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEditAny && (
          <Button onClick={openNewModal} size="sm" className="h-9 rounded-md lg:justify-self-end">
            <Plus size={16} className="mr-2" /> Add Assignment
          </Button>
        )}
      </div>

      <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
        {filteredAssignments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/50 bg-background/30 py-12 text-center text-sm text-muted-foreground backdrop-blur-sm">
            No work assignments found.
          </div>
        ) : (
          filteredAssignments.map((assignment) => {
            const employee = employees.find((e) => e.user_id === assignment.user_id);
            const statusDisplay = getStatusDisplay(assignment.status);
            const verificationDisplay = getVerificationDisplay(assignment.status);
            const StatusIcon = statusDisplay.icon;
            const VerificationIcon = verificationDisplay.icon;
            const complexity = assignment.complexity || "medium";
            const estimatedHours = COMPLEXITY_HOURS[complexity];
            const completedHours = Math.round(estimatedHours * ((assignment.progress || 0) / 100));
            const canEditThis = canEditAny || currentUserId === assignment.user_id;

            return (
              <article
                key={assignment.id || `${assignment.user_id}-${assignment.responsibility}`}
                className="rounded-xl border border-border/50 bg-background/40 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(210px,0.75fr)_minmax(320px,1.35fr)_minmax(260px,0.9fr)_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-200">
                      <AvatarImage src={employee?.avatar_url || ""} />
                      <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                        {employee?.full_name?.substring(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-950">
                        {employee?.full_name || "Unknown User"}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <UserCheck size={12} />
                        Assigned member
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="min-w-0 truncate text-sm font-semibold text-slate-950">
                        {assignment.responsibility}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-[11px] capitalize ${COMPLEXITY_STYLES[complexity]}`}
                      >
                        <Timer size={12} />
                        {TASK_COMPLEXITY_LABELS[complexity]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-[11px] capitalize ${PRIORITY_STYLES[taskPriority]}`}
                      >
                        <Flag size={12} />
                        {taskPriority}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                      {assignment.notes || taskDescription || "No short description added yet."}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      {canEditThis ? (
                        <Slider
                          value={[assignment.progress || 0]}
                          onValueChange={(vals) => {
                            if (onProgressChange && assignment.id) {
                              onProgressChange(assignment.id, vals[0]);
                            } else {
                              onUpdate({ ...assignment, progress: vals[0] });
                            }
                          }}
                          max={100}
                          step={1}
                          className="min-w-[160px] flex-1"
                        />
                      ) : (
                        <Progress
                          value={assignment.progress || 0}
                          className="h-2 min-w-[160px] flex-1"
                        />
                      )}
                      <span className="w-11 text-right text-xs font-semibold text-slate-700">
                        {assignment.progress || 0}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 xl:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Due
                      </div>
                      <div className="mt-1 font-semibold text-slate-700">
                        {formatDate(assignment.due_date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Updated
                      </div>
                      <div className="mt-1 font-semibold text-slate-700">
                        {formatUpdated(assignment.updated_at || assignment.assigned_at)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Effort
                      </div>
                      <div className="mt-1 font-semibold text-slate-700">
                        {completedHours}h / {estimatedHours}h
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        Files
                      </div>
                      <div className="mt-1 flex items-center gap-1 font-semibold text-slate-700">
                        <FileText size={12} />
                        {attachmentsCount}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Badge variant="outline" className={`gap-1.5 ${statusDisplay.className}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDisplay.dot}`} />
                        <StatusIcon size={12} />
                        {statusDisplay.label}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`gap-1.5 ${verificationDisplay.className}`}
                      >
                        <VerificationIcon size={12} />
                        {verificationDisplay.label}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 xl:text-right">
                      Verifier: <span className="font-medium text-slate-700">{verifierName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 xl:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md border-slate-200"
                        title="View assignment"
                        onClick={() => handleEdit(assignment)}
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md border-slate-200"
                        title="Edit assignment"
                        onClick={() => handleEdit(assignment)}
                        disabled={!canEditThis}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md border-slate-200"
                        title="Comment"
                        onClick={onComment}
                      >
                        <MessageSquare size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-md border-green-200 text-green-700 hover:bg-green-50"
                        title="Verify assignment"
                        onClick={() => handleVerify(assignment)}
                        disabled={!canEditAny || assignment.status === "approved"}
                      >
                        <ShieldCheck size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <WorkAssignmentModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={handleSave}
        initialData={editingData}
        employees={employees}
        existingAssignments={existingAssignments}
        canEditCoreFields={canEditAny}
      />
    </div>
  );
}
