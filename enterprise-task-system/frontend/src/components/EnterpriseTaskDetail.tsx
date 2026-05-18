import { useEffect, useState } from "react";
import { taskApi } from "../api/taskApi";
import { ActivityTimeline } from "./ActivityTimeline";
import { AttachmentPreviewGrid } from "./AttachmentPreviewGrid";
import { CommentsPanel } from "./CommentsPanel";
import { ProgressUpdatePanel } from "./ProgressUpdatePanel";
import { TaskAdminEditor } from "./TaskAdminEditor";
import { TaskHeader } from "./TaskHeader";
import type { AdminTaskPatch, Role, TaskDetailPayload } from "../types/task";

export function EnterpriseTaskDetail({ taskId, role }: { taskId: string; role: Role }) {
  const [payload, setPayload] = useState<TaskDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const isManager = role === "admin" || role === "manager";

  async function refresh() {
    const data = await taskApi.detail(taskId);
    setPayload(data);
  }

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading task...</div>;
  if (!payload) return <div className="p-8 text-sm text-red-300">Task not found.</div>;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e63_0,transparent_32%),linear-gradient(135deg,#020617,#0f172a_55%,#020617)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <TaskHeader task={payload.task} />
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-5">
            <ProgressUpdatePanel
              task={payload.task}
              role={role}
              onSave={async (progress, note) => {
                await taskApi.updateProgress(taskId, progress, note);
                await refresh();
              }}
              onSubmitReview={async () => {
                await taskApi.submitReview(taskId);
                await refresh();
              }}
            />
            <CommentsPanel
              comments={payload.comments}
              onAdd={async (body) => {
                await taskApi.comment(taskId, body);
                await refresh();
              }}
            />
            <AttachmentPreviewGrid
              attachments={payload.attachments}
              onAdd={async (attachment) => {
                await taskApi.attach(taskId, attachment);
                await refresh();
              }}
            />
          </div>
          <div className="grid content-start gap-5">
            <TaskAdminEditor
              task={payload.task}
              canEdit={isManager}
              onSave={async (patch: AdminTaskPatch) => {
                await taskApi.updateAdminFields(taskId, patch);
                await refresh();
              }}
              onReview={async (decision, comment) => {
                await taskApi.review(taskId, decision, comment);
                await refresh();
              }}
              onComplete={async () => {
                await taskApi.complete(taskId);
                await refresh();
              }}
              onDelete={async () => {
                await taskApi.delete(taskId);
              }}
            />
            <ActivityTimeline timeline={payload.timeline} />
          </div>
        </div>
      </div>
    </main>
  );
}
