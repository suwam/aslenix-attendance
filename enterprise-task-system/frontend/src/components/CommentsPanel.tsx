import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import type { TaskComment } from "../types/task";

export function CommentsPanel({
  comments,
  onAdd,
}: {
  comments: TaskComment[];
  onAdd: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");

  async function submit() {
    if (!body.trim()) return;
    await onAdd(body.trim());
    setBody("");
  }

  return (
    <section className="rounded-lg border border-[#f1f0ee]/10 bg-[#f1f0ee]/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <h2 className="mb-4 text-sm font-semibold text-[#f1f0ee]">Comments</h2>
      <div className="space-y-3">
        {comments.map((comment) => (
          <article
            key={comment._id}
            className={
              comment.isReviewComment
                ? "rounded-md border border-amber-300/30 bg-amber-300/10 p-3"
                : "rounded-md border border-[#f1f0ee]/10 bg-black/25 p-3"
            }
          >
            <div className="mb-1 flex justify-between gap-3 text-xs text-slate-500">
              <span className="font-medium text-slate-300">
                {comment.authorName} - {comment.authorRole}
                {comment.isReviewComment ? " review" : ""}
              </span>
              <time>{new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p className="text-sm text-slate-200">{comment.body}</p>
          </article>
        ))}
        {comments.length === 0 && <div className="text-sm text-slate-500">No comments yet.</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment..."
          className="min-w-0 flex-1 rounded-md border border-[#f1f0ee]/10 bg-black/30 px-3 py-2 text-sm text-[#f1f0ee] outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
        />
        <button
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          <MessageSquarePlus size={14} />
          Add
        </button>
      </div>
    </section>
  );
}
