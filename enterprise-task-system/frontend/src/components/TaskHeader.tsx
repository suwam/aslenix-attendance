import { CalendarClock, Fingerprint, UserRound } from "lucide-react";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { Task } from "../types/task";

export function TaskHeader({ task }: { task: Task }) {
  return (
    <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.055] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TaskStatusBadge status={task.status} />
            <span className="rounded-md border border-[#f1f0ee]/10 bg-black/20 px-2 py-1 text-xs text-slate-300">
              {task.priority}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f1f0ee]">{task.title}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{task.description}</p>
        </div>
        <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:min-w-96">
          <Meta icon={Fingerprint} label="Task ID" value={task.taskCode} />
          <Meta icon={UserRound} label="Assigned Employee" value={task.assignedTo.name} />
          <Meta icon={CalendarClock} label="Created" value={new Date(task.createdAt).toLocaleString()} />
          <Meta icon={CalendarClock} label="Last Updated" value={new Date(task.updatedAt).toLocaleString()} />
        </div>
      </div>
    </section>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Fingerprint;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#f1f0ee]/10 bg-black/20 px-3 py-2">
      <Icon size={14} className="text-cyan-300" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate font-medium text-slate-200">{value}</div>
      </div>
    </div>
  );
}
