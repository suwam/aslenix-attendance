import { motion } from "framer-motion";
import { Flag, FolderKanban, Target } from "lucide-react";
import {
  PRIORITY_COLORS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-utils";
import { formatNepaliDate } from "@/lib/nepali-calendar";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  deadline: string | null;
  assigned_to: string;
  module_name: string;
  module_assignment_id: string;
  role: string;
  assignee_name?: string;
  weight: number;
}

export function TaskCard({
  task,
  onClick,
  onDragStart,
  autoMoved = false,
  draggable = true,
}: {
  task: TaskCardData;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  autoMoved?: boolean;
  draggable?: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onClick={onClick}
        className={`glass kanban-task-card rounded-xl p-3.5 select-none border border-border hover:border-primary/40 hover:-translate-y-0.5 transition-all ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${autoMoved ? "kanban-task-card-auto-moved" : ""}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium leading-tight line-clamp-2">{task.title}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <FolderKanban size={12} className="shrink-0" />
              <span className="truncate">{task.module_name} ({task.role})</span>
            </div>
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
          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {task.progress}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground truncate">
            {task.deadline ? (
              <>
                <Target size={12} className="shrink-0" />
                <span className="truncate">Target: {task.deadline}</span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold">{task.assignee_name || 'User'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
