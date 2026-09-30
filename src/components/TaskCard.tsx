import { motion } from "framer-motion";
import { Flag, FolderKanban, Target, User } from "lucide-react";
import {
  PRIORITY_COLORS,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks-utils";

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
  project_id: string;
  project_name: string;
  sprint_id: string;
  week_number: number;
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
        className={`glass kanban-task-card rounded-xl p-4 select-none border border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg transition-all ${
          draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
        } ${autoMoved ? "kanban-task-card-auto-moved ring-2 ring-primary/50" : ""}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="text-sm font-semibold leading-tight line-clamp-2">{task.title}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-full">
                <FolderKanban size={11} className="shrink-0" />
                <span className="truncate font-medium">{task.module_name}</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {task.role}
              </span>
            </div>
          </div>
          <span
            className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md"
            style={{
              background: `color-mix(in oklab, ${PRIORITY_COLORS[task.priority] || '#888'} 15%, transparent)`,
              color: PRIORITY_COLORS[task.priority] || '#888',
            }}
          >
            <Flag size={9} className="inline -mt-0.5 mr-1" />
            {task.priority || 'NORMAL'}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span className="font-bold">{task.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            {task.deadline ? (
              <>
                <Target size={12} className="shrink-0" />
                <span>Target · {task.deadline}</span>
              </>
            ) : (
              <span>No Target</span>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STATUS_BADGE_CLASSES[task.status] || ''}`}
          >
            {STATUS_LABELS[task.status] || 'WAITING'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
