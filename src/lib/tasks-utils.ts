export const TASK_STATUSES = ["todo", "in_progress", "review", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "oklch(0.68 0.025 255)",
  in_progress: "oklch(0.64 0.19 255)",
  review: "oklch(0.82 0.17 75)",
  completed: "oklch(0.7 0.17 150)",
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  todo: "border-slate-400/25 bg-slate-500/12 text-slate-300",
  in_progress: "border-blue-400/25 bg-blue-500/12 text-blue-300",
  review: "border-amber-400/30 bg-amber-500/14 text-amber-300",
  completed: "border-emerald-400/25 bg-emerald-500/12 text-emerald-300",
};

export type WorkflowTransition = "review" | "completed" | null;

export function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

export function statusForProgress(progressValue: number): TaskStatus {
  const progress = clampProgress(progressValue);
  if (progress === 0) return "todo";
  if (progress === 100) return "completed";
  if (progress >= 98) return "review";
  return "in_progress";
}

export function progressForStatus(status: TaskStatus, progressValue: number) {
  const progress = clampProgress(progressValue);
  if (status === "todo") return 0;
  if (status === "completed") return 100;
  if (status === "review") return Math.min(99, Math.max(98, progress));
  return Math.min(97, Math.max(1, progress));
}

export function syncTaskWorkflow(status: TaskStatus, progressValue: number) {
  const progress = clampProgress(progressValue);
  const nextStatus = statusForProgress(progress);
  const transition: WorkflowTransition =
    status === "in_progress" && nextStatus === "review"
      ? "review"
      : status === "review" && nextStatus === "completed"
        ? "completed"
        : null;

  return {
    status: nextStatus,
    progress,
    transition,
    completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
  };
}

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof PRIORITIES)[number];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "oklch(0.7 0.05 250)",
  medium: "oklch(0.6 0.25 260)",
  high: "oklch(0.82 0.17 75)",
  urgent: "oklch(0.65 0.27 22)",
};

export function productivityScore(opts: {
  completed: number;
  total: number;
  onTimeRate: number; // 0..1
  hours: number;
  targetHours: number;
}) {
  const completion = opts.total ? opts.completed / opts.total : 0;
  const hoursRatio = Math.min(1, opts.hours / Math.max(1, opts.targetHours));
  const score = (completion * 0.5 + opts.onTimeRate * 0.3 + hoursRatio * 0.2) * 100;
  return Math.round(Math.min(100, Math.max(0, score)));
}
