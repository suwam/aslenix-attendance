export const TASK_STATUSES = ["todo", "in_progress", "review", "completed", "blocked", "changes_requested"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
  blocked: "Blocked",
  changes_requested: "Changes Requested"
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "oklch(0.68 0.025 255)",
  in_progress: "oklch(0.64 0.19 255)",
  review: "oklch(0.82 0.17 75)",
  completed: "oklch(0.7 0.17 150)",
  blocked: "oklch(0.5 0.2 20)",
  changes_requested: "oklch(0.6 0.2 20)"
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  todo: "border-slate-400/25 bg-slate-500/12 text-slate-300",
  in_progress: "border-blue-400/25 bg-blue-500/12 text-blue-300",
  review: "border-amber-400/30 bg-amber-500/14 text-amber-300",
  completed: "border-emerald-400/25 bg-emerald-500/12 text-emerald-300",
  blocked: "border-red-400/30 bg-red-500/14 text-red-300",
  changes_requested: "border-orange-400/30 bg-orange-500/14 text-orange-300"
};

export type WorkflowTransition = "review" | "completed" | null;

export function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

export function statusForProgress(progressValue: number): TaskStatus {
  const progress = clampProgress(progressValue);
  if (progress === 0) return "todo";
  if (progress === 100) return "review";
  return "in_progress";
}

export function progressForStatus(status: TaskStatus, progressValue: number) {
  const progress = clampProgress(progressValue);
  if (status === "todo") return 0;
  if (status === "completed") return 100;
  if (status === "review") return 100;
  return Math.min(99, Math.max(1, progress));
}

export function syncTaskWorkflow(status: TaskStatus, progressValue: number) {
  const progress = clampProgress(progressValue);
  const nextStatus =
    progress === 100 && status === "completed" ? "completed" : statusForProgress(progress);
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

export type TaskCommentMention = {
  id: string;
  comment_id: string;
  mentioned_user_id: string;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  parent_comment_id: string | null;
  attachment: any | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  author?: string;
  avatar_url?: string | null;
  mentions?: TaskCommentMention[];
  replies?: TaskComment[];
};

export type TaskActivityLog = {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  old_value: any | null;
  new_value: any | null;
  created_at: string;
  author?: string;
};
