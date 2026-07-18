import { Save, Shield, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminTaskPatch, Task, TaskPriority, TaskStatus } from "../types/task";

const statuses: TaskStatus[] = ["todo", "in_progress", "ready_for_review", "approved", "completed"];
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskAdminEditor({
  task,
  canEdit,
  onSave,
  onReview,
  onComplete,
  onDelete,
}: {
  task: Task;
  canEdit: boolean;
  onSave: (payload: AdminTaskPatch) => Promise<void>;
  onReview: (decision: "approve" | "reject", comment: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description,
    deadline: task.deadline ? task.deadline.slice(0, 10) : "",
    priority: task.priority,
    status: task.status,
    assignedTo: task.assignedTo._id,
  });
  const [reviewComment, setReviewComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description,
      deadline: task.deadline ? task.deadline.slice(0, 10) : "",
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedTo._id,
    });
  }, [task]);

  async function save() {
    setBusy(true);
    try {
      await onSave({ ...form, deadline: form.deadline || null });
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.04] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#f1f0ee]">
          <Shield size={15} className="text-cyan-300" />
          Read-Only Task Fields
        </div>
        <div className="grid gap-3">
          <ReadOnly label="Title" value={task.title} />
          <ReadOnly label="Description" value={task.description || "No description"} multiline />
          <div className="grid gap-3 sm:grid-cols-2">
            <ReadOnly
              label="Deadline"
              value={task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
            />
            <ReadOnly label="Priority" value={task.priority} />
            <ReadOnly label="Assigned employee" value={task.assignedTo.name} />
            <ReadOnly label="Status" value={task.status.replaceAll("_", " ")} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-semibold text-[#f1f0ee]">Admin Controls</h2>
      <div className="grid gap-3">
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          className="rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee] outline-none transition focus:border-cyan-300/60"
        />
        <textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          className="min-h-28 rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee] outline-none transition focus:border-cyan-300/60"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="date"
            value={form.deadline}
            onChange={(event) => setForm({ ...form, deadline: event.target.value })}
            className="rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee]"
          />
          <input
            value={form.assignedTo}
            onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
            className="rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee]"
            aria-label="Assigned employee id"
          />
          <select
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}
            className="rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee]"
          >
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}
            className="rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee]"
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#f1f0ee] px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={14} />
          Save admin changes
        </button>
      </div>
      <div className="mt-5 border-t border-[#f1f0ee]/10 pt-5">
        <textarea
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
          placeholder="Review comment visible to employee..."
          className="min-h-24 w-full rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee] outline-none transition focus:border-amber-300/60"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onReview("approve", reviewComment)}
            disabled={task.status !== "ready_for_review"}
            className="rounded-md bg-emerald-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => onReview("reject", reviewComment)}
            disabled={task.status !== "ready_for_review"}
            className="rounded-md bg-amber-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={onComplete}
            disabled={task.status !== "approved"}
            className="rounded-md border border-violet-300/50 px-3 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Complete
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-md border border-red-300/50 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-300/10"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </section>
  );
}

function ReadOnly({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      {label}
      {multiline ? (
        <textarea
          value={value}
          disabled
          className="min-h-24 resize-none rounded-md border border-[#f1f0ee]/10 bg-black/20 px-3 py-2 text-sm text-slate-300"
        />
      ) : (
        <input
          value={value}
          disabled
          className="rounded-md border border-[#f1f0ee]/10 bg-black/20 px-3 py-2 text-sm text-slate-300"
        />
      )}
    </label>
  );
}
