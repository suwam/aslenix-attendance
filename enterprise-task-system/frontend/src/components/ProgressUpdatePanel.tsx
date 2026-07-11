import { SendHorizontal, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { Role, Task } from "../types/task";

export function ProgressUpdatePanel({
  task,
  role,
  onSave,
  onSubmitReview,
}: {
  task: Task;
  role: Role;
  onSave: (progress: number, note: string) => Promise<void>;
  onSubmitReview: () => Promise<void>;
}) {
  const [progress, setProgress] = useState(task.progress);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const isEmployee = role === "employee";
  const isLockedForEmployee = isEmployee && ["approved", "completed"].includes(task.status);
  const changed = progress !== task.progress;

  useEffect(() => {
    setProgress(task.progress);
    setNote("");
  }, [task._id, task.progress]);

  async function save() {
    if (changed && !note.trim()) return;
    setBusy(true);
    try {
      await onSave(progress, note.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl transition duration-300 hover:border-cyan-300/30">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f1f0ee]">Progress Update</h2>
          <p className="mt-1 text-xs text-slate-500">Employee-safe workspace for notes, progress, and review handoff.</p>
        </div>
        <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 font-mono text-sm text-cyan-100">
          {progress}%
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        disabled={busy || isLockedForEmployee}
        onChange={(event) => setProgress(Number(event.target.value))}
        className="w-full accent-cyan-300 disabled:opacity-40"
      />

      <textarea
        value={note}
        disabled={busy || isLockedForEmployee}
        onChange={(event) => setNote(event.target.value)}
        placeholder={changed ? "Required: describe what changed..." : "Add a progress update note..."}
        className="mt-4 min-h-28 w-full rounded-md border border-[#f1f0ee]/10 bg-black/30 p-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {changed && !note.trim() && (
        <div className="mt-2 text-xs text-amber-300">Update note is required when progress changes.</div>
      )}
      {isLockedForEmployee && (
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-200">
          <ShieldCheck size={13} />
          This task is locked after review approval.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={busy || isLockedForEmployee || (changed && !note.trim())}
          className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal size={14} />
          Save update
        </button>
        {isEmployee && (
          <button
            onClick={onSubmitReview}
            disabled={busy || isLockedForEmployee}
            className="rounded-md border border-emerald-300/40 px-3 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Submit for review
          </button>
        )}
      </div>

      {task.progressUpdates?.length > 0 && (
        <div className="mt-5 border-t border-[#f1f0ee]/10 pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase text-slate-500">Progress Notes</h3>
          <div className="grid gap-2">
            {task.progressUpdates
              .slice()
              .reverse()
              .map((update) => (
                <article
                  key={`${update.employeeId}-${update.createdAt}-${update.newProgress}`}
                  className="rounded-md border border-[#f1f0ee]/10 bg-black/25 p-3"
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-medium text-cyan-200">
                      {update.oldProgress}% -&gt; {update.newProgress}%
                    </span>
                    <time>{new Date(update.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{update.note}</p>
                  <div className="mt-2 text-xs text-slate-600">{update.employeeName}</div>
                </article>
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
