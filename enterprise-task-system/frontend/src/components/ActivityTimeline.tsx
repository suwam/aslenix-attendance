import {
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  NotebookPen,
  TrendingUp,
} from "lucide-react";
import type { TaskActivity } from "../types/task";

const iconByType = {
  progress_update: TrendingUp,
  progress_note: NotebookPen,
  comment: MessageSquare,
  attachment: FileText,
  status_change: CheckCircle2,
  assignment_change: Clock3,
  deadline_change: Clock3,
  review_decision: CheckCircle2,
};

export function ActivityTimeline({ timeline }: { timeline: TaskActivity[] }) {
  return (
    <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.055] p-5 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-semibold text-[#f1f0ee]">Activity Timeline</h2>
      <ol className="relative space-y-4 border-l border-[#f1f0ee]/10 pl-5">
        {timeline.map((item) => {
          const Icon = iconByType[item.type];
          return (
            <li key={item._id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-950">
                <Icon size={13} className="text-cyan-300" />
              </span>
              <div className="rounded-md border border-[#f1f0ee]/10 bg-black/25 p-3">
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <time>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  <span>{item.actorName}</span>
                </div>
                <p className="text-sm text-slate-200">
                  {item.type === "progress_update" &&
                  typeof item.metadata?.oldProgress === "number" &&
                  typeof item.metadata?.newProgress === "number"
                    ? `Progress updated ${item.metadata.oldProgress}% -> ${item.metadata.newProgress}%`
                    : item.message}
                </p>
                {typeof item.metadata?.note === "string" && item.metadata.note && (
                  <p className="mt-2 rounded-md bg-[#f1f0ee]/5 p-2 text-xs text-slate-300">
                    {item.metadata.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {timeline.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
      </ol>
    </section>
  );
}
