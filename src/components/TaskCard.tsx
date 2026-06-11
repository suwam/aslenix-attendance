import { motion } from "framer-motion";
import { Calendar, Flag, MessageSquare, Paperclip } from "lucide-react";
import { isPast } from "date-fns";
import {
  PRIORITY_COLORS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-utils";
import {
  TASK_COMPLEXITY_LABELS,
  normalizedTaskComplexity,
  type TaskComplexity,
} from "@/lib/employee-scoring";
import { formatNepaliDate } from "@/lib/nepali-calendar";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_complexity?: TaskComplexity | null;
  progress: number;
  deadline: string | null;
  assigned_to: string;
  tags: string[] | null;
  comments_count?: number;
  attachments_count?: number;
  assignee_name?: string;
  assignee_names?: string[];
}

export function TaskCard({
  task,
  onClick,
  onDragStart,
  autoMoved = false,
}: {
  task: TaskCardData;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  autoMoved?: boolean;
}) {
  const overdue = task.deadline && isPast(new Date(task.deadline)) && task.status !== "completed";
  const complexity = normalizedTaskComplexity(task.task_complexity);
  const dueCountdown = task.deadline ? getDueCountdown(task.deadline, task.status) : null;
  const assigneeNames = task.assignee_names?.length
    ? task.assignee_names
    : task.assignee_name
      ? [task.assignee_name]
      : ["User"];
  const visibleAssignees = assigneeNames.slice(0, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onClick={onClick}
        className={`glass kanban-task-card rounded-xl p-3.5 cursor-grab active:cursor-grabbing select-none border border-border hover:border-primary/40 hover:-translate-y-0.5 transition-all ${
          autoMoved ? "kanban-task-card-auto-moved" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-tight line-clamp-2">{task.title}</div>
          </div>
          <span
            className="shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: `color-mix(in oklab, ${PRIORITY_COLORS[task.priority]} 22%, transparent)`,
              color: PRIORITY_COLORS[task.priority],
            }}
          >
            <Flag size={9} className="inline -mt-0.5 mr-0.5" />
            {task.priority}
          </span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_BADGE_CLASSES[task.status]}`}
          >
            {STATUS_LABELS[task.status]}
          </span>
          <span className="inline-flex items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
            {TASK_COMPLEXITY_LABELS[complexity]}
          </span>
        </div>

        {task.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</div>
        )}

        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${task.progress}%`, background: "var(--gradient-brand)" }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {task.progress}%
          </div>
        </div>

        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {task.deadline && (
              <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                <Calendar size={11} />
                {formatNepaliDate(task.deadline, "DD MMM")} BS
                {dueCountdown && <span className="font-medium">({dueCountdown})</span>}
              </span>
            )}
            {!!task.comments_count && (
              <span className="flex items-center gap-1">
                <MessageSquare size={11} />
                {task.comments_count}
              </span>
            )}
            {!!task.attachments_count && (
              <span className="flex items-center gap-1">
                <Paperclip size={11} />
                {task.attachments_count}
              </span>
            )}
          </div>
          <div className="flex -space-x-1" title={assigneeNames.join(", ")}>
            {visibleAssignees.map((name) => {
              const initials = name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div
                  key={name}
                  className="h-6 w-6 rounded-full border border-background flex items-center justify-center text-[10px] font-semibold text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {initials}
                </div>
              );
            })}
            {assigneeNames.length > visibleAssignees.length && (
              <div className="h-6 w-6 rounded-full border border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                +{assigneeNames.length - visibleAssignees.length}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function getDueCountdown(deadline: string, status: TaskStatus) {
  if (status === "completed") return "done";

  const due = new Date(deadline);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  if (diffMs < 0) {
    const overdueDays = Math.floor(absMs / dayMs);
    if (overdueDays >= 1) return `${overdueDays}d overdue`;
    return "overdue";
  }

  const days = Math.floor(diffMs / dayMs);
  if (days >= 1) return `${days}d left`;

  const hours = Math.ceil(diffMs / hourMs);
  if (hours > 1) return `${hours}h left`;
  return "due soon";
}
