import type { TaskStatus } from "../types/task";

const labels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  ready_for_review: "Ready For Review",
  approved: "Approved",
  completed: "Completed",
};

const classes: Record<TaskStatus, string> = {
  todo: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  in_progress: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  ready_for_review: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  completed: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}
