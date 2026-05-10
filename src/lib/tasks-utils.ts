export const TASK_STATUSES = ["todo", "in_progress", "review", "completed"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "oklch(0.7 0.03 250)",
  in_progress: "oklch(0.6 0.25 260)",
  review: "oklch(0.82 0.17 75)",
  completed: "oklch(0.72 0.18 155)",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = typeof PRIORITIES[number];

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
