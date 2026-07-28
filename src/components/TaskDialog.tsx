import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskAssignments } from "./tasks/TaskAssignments";
import { TaskAssignees } from "./tasks/TaskAssignees";
import { WorkAssignmentData } from "./tasks/WorkAssignmentModal";
import { TaskDiscussion } from "./tasks/TaskDiscussion";
import { TaskTimeline } from "./tasks/TaskTimeline";
import { TaskActivityLog } from "@/lib/tasks-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BSDateInput, GlassTimeInput } from "@/components/BSDateInput";
import { toast } from "sonner";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  progressForStatus,
  syncTaskWorkflow,
  type TaskStatus,
  type TaskPriority,
  type WorkflowTransition,
} from "@/lib/tasks-utils";
import {
  TASK_COMPLEXITY_DESCRIPTIONS,
  TASK_COMPLEXITY_LABELS,
  type TaskComplexity,
} from "@/lib/employee-scoring";
import { isMissingSupabaseColumnError, isMissingSupabaseTableError } from "@/lib/supabase-errors";
import {
  Check,
  Download,
  Pencil,
  Paperclip,
  Send,
  Trash2,
  TrendingUp,
  X,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { bsInputToAdDateString, formatBsInput, formatNepaliDate } from "@/lib/nepali-calendar";

type ProgressUpdate = {
  id: string;
  task_id: string;
  user_id: string;
  old_progress: number;
  new_progress: number;
  note: string;
  created_at: string;
  author?: string;
};

export function TaskDialog({
  open,
  onOpenChange,
  taskId,
  defaultStatus,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskId?: string | null;
  defaultStatus?: TaskStatus;
  onSaved?: (result?: {
    taskId?: string | null;
    transition?: WorkflowTransition;
  }) => void | Promise<void>;
}) {
  const { user, isAdmin } = useAuth();
  const [teamLeads, setTeamLeads] = useState<string[]>([]);

  const isAssignedTeamLead = Boolean(user && teamLeads.includes(user.id));
  const canEditTaskFields = isAdmin || isAssignedTeamLead || !taskId;
  const canDeleteTask = isAdmin && Boolean(taskId);
  const isEmployeeTaskEdit = Boolean(taskId && !isAdmin && !isAssignedTeamLead);

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus || "todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [taskComplexity, setTaskComplexity] = useState<TaskComplexity>("medium");
  const [progress, setProgress] = useState(0);
  const [initialProgress, setInitialProgress] = useState(0);
  const [progressNote, setProgressNote] = useState("");
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [editingProgressUpdateId, setEditingProgressUpdateId] = useState<string | null>(null);
  const [editingProgressNote, setEditingProgressNote] = useState("");
  const [savingProgressUpdateId, setSavingProgressUpdateId] = useState<string | null>(null);
  const [deadlineDateBs, setDeadlineDateBs] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>(user?.id || "");
  const [workAssignments, setWorkAssignments] = useState<WorkAssignmentData[]>([]);
  const [tags, setTags] = useState("");
  const [employees, setEmployees] = useState<
    { user_id: string; full_name: string; role: string; avatar_url?: string | null }[]
  >([]);
  const [availableTeamLeads, setAvailableTeamLeads] = useState<
    { user_id: string; full_name: string; role: string; avatar_url?: string | null }[]
  >([]);
  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState("details");

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [progressUpdatesUnavailable, setProgressUpdatesUnavailable] = useState(false);
  const [taskComplexityUnavailable, setTaskComplexityUnavailable] = useState(false);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setTaskComplexity("medium");
    setProgress(0);
    setInitialProgress(0);
    setProgressNote("");
    setProgressUpdates([]);
    setEditingProgressUpdateId(null);
    setEditingProgressNote("");
    setSavingProgressUpdateId(null);
    setProgressUpdatesUnavailable(false);
    setTaskComplexityUnavailable(false);
    setDeadlineDateBs("");
    setDeadlineTime("");
    setAssignedTo(isAdmin ? "" : user?.id || "");
    setWorkAssignments([]);
    setTeamLeads([]);
    setActivityLogs([]);
    setActiveTab("details");
    setTags("");
    setComments([]);
    setAttachments([]);
  }, [isAdmin, user?.id]);

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    const [
      { data: t },
      { data: c },
      attachmentResult,
      progressResult,
      assigneeResult,
      teamLeadsResult,
      logsResult,
    ] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
      isAdmin
        ? supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at")
        : Promise.resolve({ data: [] }),
      supabase
        .from("task_progress_updates")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
      supabase.from("task_assignees").select("*").eq("task_id", taskId),
      supabase.from("task_team_leads").select("user_id").eq("task_id", taskId),
      supabase
        .from("task_activity_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
    ]);
    const assignees =
      assigneeResult.error && isMissingSupabaseTableError(assigneeResult.error, "task_assignees")
        ? []
        : assigneeResult.data;
    const teamLeadsData = teamLeadsResult?.error ? [] : teamLeadsResult?.data || [];
    setTeamLeads(teamLeadsData.map((t: any) => t.user_id));
    const logsData = logsResult?.error ? [] : logsResult?.data || [];
    setActivityLogs(logsData as any);
    if (t) {
      setTitle(t.title);
      setDescription(t.description || "");
      setStatus(t.status);
      setPriority(t.priority);
      setTaskComplexity((t.task_complexity || "medium") as TaskComplexity);
      setProgress(t.progress);
      setInitialProgress(t.progress);
      setProgressNote("");
      setAssignedTo(t.assigned_to);
      setWorkAssignments(assignees?.length ? (assignees as any[]) : []);
      setDeadlineDateBs(t.deadline ? formatBsInput(t.deadline) : "");
      setDeadlineTime(t.deadline ? format(new Date(t.deadline), "HH:mm") : "");
      setTags((t.tags || []).join(", "));
    }
    // hydrate user names for comments
    const progressTableMissing =
      progressResult.error &&
      isMissingSupabaseTableError(progressResult.error, "task_progress_updates");
    setProgressUpdatesUnavailable(Boolean(progressTableMissing));
    const progressRows = progressTableMissing ? [] : progressResult.data || [];
    const ids = Array.from(
      new Set([
        ...(c || []).map((x: any) => x.user_id),
        ...progressRows.map((x: any) => x.user_id),
      ]),
    );
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.full_name]));
    }
    setComments((c || []).map((x: any) => ({ ...x, author: names[x.user_id] || "User" })));
    setProgressUpdates(
      progressRows.map((x: any) => ({
        ...x,
        author: names[x.user_id] || "User",
      })) as ProgressUpdate[],
    );
    setAttachments(attachmentResult.data || []);
  }, [isAdmin, taskId]);

  useEffect(() => {
    if (!open) return;
    setStatus(defaultStatus || "todo");
    Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url, approval_status"),
      supabase.from("user_roles").select("user_id, role"),
    ]).then(([{ data }, { data: roleRows }]) => {
      const adminUserIds = new Set(
        (roleRows ?? [])
          .filter((r) => r.role === "admin" || r.role === "super_admin" || r.role === "hr_manager")
          .map((row) => row.user_id),
      );
      const empData = (data || []).map((e: any) => {
        const uRoles = (roleRows || []).filter((r) => r.user_id === e.user_id).map((r) => r.role);
        return { ...e, role: uRoles[0] || "employee", roles: uRoles };
      });
      setEmployees(
        empData.filter((e) => e.approval_status === "approved" && !adminUserIds.has(e.user_id)),
      );
      setAvailableTeamLeads(
        empData.filter((e) => e.approval_status === "approved" && !adminUserIds.has(e.user_id)),
      );
    });

    if (taskId) loadTask();
    else {
      resetForm();
      const nextStatus = defaultStatus || "todo";
      setStatus(nextStatus);
      setProgress(progressForStatus(nextStatus, 0));
    }
  }, [open, taskId, defaultStatus, isAdmin, loadTask, resetForm]);

  useEffect(() => {
    if (workAssignments.length > 0) {
      let total = 0;
      workAssignments.forEach((a) => {
        total += a.progress || 0;
      });
      const avg = Math.round(total / workAssignments.length);
      setProgress(avg);
    }
  }, [workAssignments]);

  const save = async () => {
    if (!user || !title.trim()) return toast.error("Title required");
    const workflow = syncTaskWorkflow(status, progress);
    const nextProgress = workflow.progress;
    const nextStatus = workflow.status;
    const progressChanged = taskId ? nextProgress !== initialProgress : false;
    const progressIncreased = taskId ? nextProgress > initialProgress : false;
    const progressNoteRequired = isEmployeeTaskEdit ? progressChanged : progressIncreased;
    if (progressNoteRequired && !progressNote.trim()) {
      return toast.error(
        isEmployeeTaskEdit
          ? "Update comment is required when progress changes"
          : "Progress update note is required when progress increases",
      );
    }

    setLoading(true);
    if (taskId && !isAdmin && !isAssignedTeamLead) {
      let { error } = await supabase
        .from("tasks")
        .update({
          progress: nextProgress,
          status: nextStatus,
          completed_at: workflow.completedAt,
        })
        .eq("id", taskId);
      let progressNoteNotSaved = false;
      if (!error && progressChanged) {
        const progressUpdateResult = await saveProgressUpdate(
          taskId,
          initialProgress,
          nextProgress,
          progressNote.trim(),
        );
        if (progressUpdateResult.missingTable) {
          progressNoteNotSaved = true;
        } else {
          error = progressUpdateResult.error;
        }
      }

      // Sync all assignment progresses
      if (!error && workAssignments.length > 0) {
        for (const a of workAssignments) {
          if (a.id && !a.id.toString().startsWith("temp-")) {
            await supabase
              .from("task_assignees")
              .update({ progress: a.progress || 0 })
              .eq("id", a.id);
          }
        }
      }

      setLoading(false);
      if (error) return toast.error(error.message);
      if (progressNoteNotSaved) {
        toast.warning("Progress updated. Apply the task_progress_updates migration to save notes.");
      } else if (workflow.transition === "review") {
        toast.success("Task moved to Review", { description: "Task is ready for review." });
      } else if (workflow.transition === "completed") {
        toast.success("Task marked as Completed", { description: "Task successfully completed." });
      } else {
        toast.success("Progress updated");
      }
      onSaved?.({ taskId, transition: workflow.transition });
      onOpenChange(false);
      return;
    }

    const tagsArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const deadlineIso = getDeadlineIso(deadlineDateBs, deadlineTime);
    const payload: Record<string, unknown> = {
      title,
      description: description || null,
      status: nextStatus,
      priority,
      task_complexity: taskComplexity,
      progress: nextProgress,
      deadline: deadlineIso,
      assigned_to: workAssignments.length > 0 ? workAssignments[0].user_id : user.id,
      tags: tagsArr,
      completed_at: workflow.completedAt,
    };
    let error;
    let savedTaskId = taskId;
    let complexityNotSaved = false;
    if (taskId) {
      ({ error } = await supabase.from("tasks").update(payload).eq("id", taskId));
      if (isMissingSupabaseColumnError(error, "tasks", "task_complexity")) {
        complexityNotSaved = true;
        setTaskComplexityUnavailable(true);
        const legacyPayload = { ...payload };
        delete legacyPayload.task_complexity;
        ({ error } = await supabase.from("tasks").update(legacyPayload).eq("id", taskId));
      }
    } else {
      let result = await supabase
        .from("tasks")
        .insert({ ...payload, created_by: user.id })
        .select("id")
        .single();
      if (isMissingSupabaseColumnError(result.error, "tasks", "task_complexity")) {
        complexityNotSaved = true;
        setTaskComplexityUnavailable(true);
        const legacyPayload = { ...payload };
        delete legacyPayload.task_complexity;
        result = await supabase
          .from("tasks")
          .insert({ ...legacyPayload, created_by: user.id })
          .select("id")
          .single();
      }
      error = result.error;
      savedTaskId = result.data?.id ?? null;

      // For new tasks, insert the work assignments
      if (!error && savedTaskId && workAssignments.length > 0) {
        const assignmentsToInsert = workAssignments.map((a) => ({
          task_id: savedTaskId,
          user_id: a.user_id,
          responsibility: a.responsibility,
          status: a.status,
          progress: a.progress || 0,
          due_date: a.due_date,
          notes: a.notes,
        }));
        await supabase.from("task_assignees").insert(assignmentsToInsert);
      }
    }

    if (!error && savedTaskId) {
      // Log activity
      await supabase.from("task_activity_logs").insert({
        task_id: savedTaskId,
        user_id: user?.id,
        action: taskId ? "status_changed" : "created",
        new_value: { status: workflow.status, progress: workflow.progress },
      });

      if (isAdmin) {
        // Save team leads
        const tlRows = teamLeads.map((uid) => ({
          task_id: savedTaskId,
          user_id: uid,
        }));
        const tlDelete = await supabase.from("task_team_leads").delete().eq("task_id", savedTaskId);
        if (tlDelete.error && !isMissingSupabaseTableError(tlDelete.error, "task_team_leads")) {
          console.error("Failed to delete team leads", tlDelete.error);
        }
        if (tlRows.length) {
          const tlInsert = await supabase.from("task_team_leads").insert(tlRows);
          if (tlInsert.error) {
            if (isMissingSupabaseTableError(tlInsert.error, "task_team_leads")) {
              toast.warning(
                "Task saved. Apply the add_team_lead_task_features migration to save team leads.",
              );
            } else {
              error = tlInsert.error;
            }
          }
        }

        await notifyTaskAssignees(
          workAssignments.map((a) => a.user_id),
          taskId ? "Task updated" : "New task assigned",
          {
            title,
            deadline: deadlineIso || "",
          },
        );
      } else if (isAssignedTeamLead) {
        await notifyTaskAssignees(
          workAssignments.map((a) => a.user_id),
          taskId ? "Task updated" : "New task assigned",
          {
            title,
            deadline: deadlineIso || "",
          },
        );
      }

      // Sync all assignment progresses for admin/lead
      if (workAssignments.length > 0) {
        for (const a of workAssignments) {
          if (a.id && !a.id.toString().startsWith("temp-")) {
            await supabase
              .from("task_assignees")
              .update({ progress: a.progress || 0 })
              .eq("id", a.id);
          }
        }
      }
    }
    let progressNoteNotSaved = false;
    if (!error && savedTaskId && progressIncreased) {
      const progressUpdateResult = await saveProgressUpdate(
        savedTaskId,
        initialProgress,
        nextProgress,
        progressNote.trim(),
      );
      if (progressUpdateResult.missingTable) {
        progressNoteNotSaved = true;
      } else {
        error = progressUpdateResult.error;
      }
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    if (complexityNotSaved) {
      toast.warning(
        "Task saved without complexity. Apply the task_complexity migration to enable effort scoring.",
      );
    } else if (progressNoteNotSaved) {
      toast.warning(
        "Task saved. Apply the task_progress_updates migration to save progress notes.",
      );
    } else if (workflow.transition === "review") {
      toast.success("Task moved to Review", { description: "Task is ready for review." });
    } else if (workflow.transition === "completed") {
      toast.success("Task marked as Completed", { description: "Task successfully completed." });
    } else {
      toast.success(taskId ? "Task updated" : "Task created");
    }
    onSaved?.({ taskId: savedTaskId, transition: workflow.transition });
    onOpenChange(false);
  };

  const saveProgressUpdate = async (
    savedTaskId: string,
    oldProgress: number,
    newProgress: number,
    note: string,
  ) => {
    const { error } = await supabase.from("task_progress_updates").insert({
      task_id: savedTaskId,
      user_id: user!.id,
      old_progress: oldProgress,
      new_progress: newProgress,
      note,
    });
    if (error && isMissingSupabaseTableError(error, "task_progress_updates")) {
      setProgressUpdatesUnavailable(true);
      return { error: null, missingTable: true };
    }
    return { error: error as Error | null, missingTable: false };
  };

  const startEditingProgressUpdate = (update: ProgressUpdate) => {
    setEditingProgressUpdateId(update.id);
    setEditingProgressNote(update.note);
  };

  const cancelEditingProgressUpdate = () => {
    setEditingProgressUpdateId(null);
    setEditingProgressNote("");
  };

  const saveProgressUpdateNote = async (updateId: string) => {
    const note = editingProgressNote.trim();
    if (!note) return toast.error("Progress update note is required");

    setSavingProgressUpdateId(updateId);
    const { error } = await supabase
      .from("task_progress_updates")
      .update({ note })
      .eq("id", updateId);
    setSavingProgressUpdateId(null);

    if (error) return toast.error(error.message);
    setProgressUpdates((prev) =>
      prev.map((update) => (update.id === updateId ? { ...update, note } : update)),
    );
    cancelEditingProgressUpdate();
    toast.success("Progress update edited");
  };

  const remove = async () => {
    if (!taskId) return;
    if (!canDeleteTask) return toast.error("Only admins can delete tasks");
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    onSaved?.();
    onOpenChange(false);
  };

  const addComment = async () => {
    if (!taskId || !user || !newComment.trim()) return;
    if (!isAdmin) return toast.error("Only admins can add comments");
    const { error } = await supabase
      .from("task_comments")
      .insert({ task_id: taskId, user_id: user.id, comment: newComment.trim() });
    if (error) return toast.error(error.message);
    setNewComment("");
    loadTask();
  };

  const uploadFile = async (file: File) => {
    if (!isAdmin) return toast.error("Only admins can add attachments");
    if (!taskId || !user) return toast.error("Save task first");
    const path = `${user.id}/${taskId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("task-files").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      user_id: user.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
    });
    if (error) return toast.error(error.message);
    loadTask();
  };

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  };

  const toggleAssignee = (assigneeId: string) => {
    setAssignedToMany((prev) => {
      const next = prev.includes(assigneeId)
        ? prev.filter((id) => id !== assigneeId)
        : [...prev, assigneeId];
      setAssignedTo(next[0] || "");
      return next;
    });
  };

  const notifyTaskAssignees = async (
    assigneeIds: string[],
    notificationTitle: string,
    task: { title: string; deadline: string },
  ) => {
    if (!assigneeIds.length) return;

    const deadlineText = task.deadline ? ` Deadline: ${formatTaskDateTime(task.deadline)}.` : "";
    await supabase.from("notifications").insert(
      assigneeIds.map((assigneeId) => ({
        user_id: assigneeId,
        title: notificationTitle,
        message: `${task.title}.${deadlineText}`,
        type: "task",
      })),
    );
  };

  const notifyAdminsTaskReviewRequested = async () => {
    if (!taskId || !user) return;

    const { error } = await (supabase as any).rpc("notify_admins_task_review_requested", {
      _task_id: taskId,
    });
    if (!error) return;

    if (!/function .*notify_admins_task_review_requested/i.test(error.message || "")) {
      throw error;
    }

    console.warn(
      "Task review notification RPC is missing. Apply the latest Supabase migrations.",
      error,
    );
  };

  const requestReview = async () => {
    if (!taskId || !user || progress < 100) return;
    const progressChanged = progress !== initialProgress;
    if (progressChanged && !progressNote.trim()) {
      return toast.error("Update comment is required when progress changes");
    }

    setLoading(true);
    let { error } = await supabase
      .from("tasks")
      .update({ progress: 100, status: "review", completed_at: null })
      .eq("id", taskId);
    if (!error && progressChanged) {
      const progressUpdateResult = await saveProgressUpdate(
        taskId,
        initialProgress,
        100,
        progressNote.trim(),
      );
      if (!progressUpdateResult.missingTable) {
        error = progressUpdateResult.error;
      }
    }
    if (!error) {
      try {
        await notifyAdminsTaskReviewRequested();
      } catch (notificationError: any) {
        error = notificationError;
      }
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    setStatus("review");
    toast.success("Review requested", { description: "Admins have been notified." });
    onSaved?.({ taskId, transition: "review" });
    onOpenChange(false);
  };

  const updateProgress = (value: number) => {
    const workflow = syncTaskWorkflow(status, value);
    setProgress(workflow.progress);
    setStatus(workflow.status);
  };

  const updateStatus = (value: TaskStatus) => {
    setStatus(value);
    setProgress(progressForStatus(value, progress));
  };

  const employeeProgressHistory = [...progressUpdates].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const complexityKeys = Object.keys(TASK_COMPLEXITY_LABELS) as TaskComplexity[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto glass border-border">
        <DialogHeader>
          <DialogTitle>
            {taskId ? (isEmployeeTaskEdit ? "Update Progress" : "Edit Task") : "Create Task"}
          </DialogTitle>
          <DialogDescription>
            {isEmployeeTaskEdit
              ? "Update task progress and leave a progress comment for review."
              : "Assign work, set complexity, and track effort-based progress for fair leaderboard scoring."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-0">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!canEditTaskFields}
                placeholder="What needs to be done?"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEditTaskFields}
                rows={3}
                placeholder="Add details…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => updateStatus(v as TaskStatus)}
                  disabled={!canEditTaskFields}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Complexity</Label>
                <Select
                  value={taskComplexity}
                  onValueChange={(v) => setTaskComplexity(v as TaskComplexity)}
                  disabled={!canEditTaskFields}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_COMPLEXITY_LABELS) as TaskComplexity[]).map((complexity) => (
                      <SelectItem key={complexity} value={complexity}>
                        {TASK_COMPLEXITY_LABELS[complexity]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                  disabled={!canEditTaskFields}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canEditTaskFields && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Info size={15} className="text-primary" />
                      Complexity guide
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Complexity estimates the size of work so long campaigns, audits, designs, or
                      QA cycles can be evaluated fairly.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {complexityKeys.map((complexity) => (
                    <button
                      key={complexity}
                      type="button"
                      disabled={!canEditTaskFields}
                      onClick={() => setTaskComplexity(complexity)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        taskComplexity === complexity
                          ? "border-primary/60 bg-primary/15"
                          : "border-border bg-background/40 hover:border-primary/35"
                      } ${!canEditTaskFields ? "cursor-default opacity-70" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                          {TASK_COMPLEXITY_LABELS[complexity]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {TASK_COMPLEXITY_DESCRIPTIONS[complexity]}
                      </p>
                    </button>
                  ))}
                </div>

                {taskComplexityUnavailable && (
                  <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                    Complexity is visible here, but the database migration is not applied yet. Saves
                    will continue without effort complexity until the migration runs.
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Total Progress: {progress}%</Label>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Task progress is calculated automatically based on completed work assignments.
              </p>
            </div>
            {taskId && !isEmployeeTaskEdit && progressUpdates.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <TrendingUp size={14} className="text-primary" />
                  Progress updates
                </div>
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {progressUpdates.map((update) => (
                    <div key={update.id} className="rounded-md bg-background/50 p-2 text-sm">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {update.old_progress}% -&gt; {update.new_progress}%
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span>{formatTaskDateTime(update.created_at)}</span>
                          {(isAdmin || update.user_id === user?.id) && (
                            <button
                              type="button"
                              onClick={() => startEditingProgressUpdate(update)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/15 hover:text-primary"
                              title="Edit progress update"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {editingProgressUpdateId === update.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingProgressNote}
                            onChange={(e) => setEditingProgressNote(e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancelEditingProgressUpdate}
                            >
                              <X size={13} className="mr-1.5" />
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => saveProgressUpdateNote(update.id)}
                              disabled={savingProgressUpdateId === update.id}
                              className="neon-button"
                            >
                              <Check size={13} className="mr-1.5" />
                              {savingProgressUpdateId === update.id ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-foreground">{update.note}</div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">{update.author}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Deadline date (BS)</Label>
                <BSDateInput
                  value={deadlineDateBs}
                  onChange={setDeadlineDateBs}
                  disabled={!canEditTaskFields}
                  inputClassName={!canEditTaskFields ? "opacity-70" : undefined}
                />
              </div>
              <div>
                <Label>Deadline time</Label>
                <GlassTimeInput
                  value={deadlineTime}
                  onChange={setDeadlineTime}
                  className={!canEditTaskFields ? "pointer-events-none opacity-70" : undefined}
                />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={!canEditTaskFields}
                  placeholder="frontend, urgent"
                />
              </div>
            </div>
            {isAdmin && (
              <div className="mt-4 border border-border bg-muted/10 p-3 rounded-lg">
                <TaskAssignees
                  label="Team Leads"
                  options={availableTeamLeads}
                  selectedIds={teamLeads}
                  onChange={setTeamLeads}
                  disabled={!isAdmin}
                />
              </div>
            )}
            <div className="mt-4 border border-border bg-muted/10 p-3 rounded-lg">
              <TaskAssignments
                assignments={workAssignments}
                employees={employees}
                currentUserId={user?.id || ""}
                canEditAny={isAdmin || isAssignedTeamLead}
                onAdd={async (data) => {
                  if (taskId) {
                    const { data: newAssignment, error } = await supabase
                      .from("task_assignees")
                      .insert({ ...data, task_id: taskId })
                      .select()
                      .single();
                    if (newAssignment) {
                      setWorkAssignments([...workAssignments, newAssignment as any]);
                    } else {
                      console.error(error);
                    }
                  } else {
                    // Optimistic add for unsaved task
                    setWorkAssignments([
                      ...workAssignments,
                      {
                        ...data,
                        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                      },
                    ]);
                  }
                }}
                onUpdate={async (data) => {
                  if (taskId && data.id && !data.id.toString().startsWith("temp-")) {
                    const { error } = await supabase
                      .from("task_assignees")
                      .update({
                        user_id: data.user_id,
                        responsibility: data.responsibility,
                        status: data.status,
                        progress: data.progress || 0,
                        due_date: data.due_date,
                        notes: data.notes,
                      })
                      .eq("id", data.id);
                    if (!error) {
                      setWorkAssignments(workAssignments.map((a) => (a.id === data.id ? data : a)));
                    }
                  } else {
                    setWorkAssignments(workAssignments.map((a) => (a.id === data.id ? data : a)));
                  }
                }}
                onProgressChange={(id, newProgress) => {
                  setWorkAssignments(
                    workAssignments.map((a) => (a.id === id ? { ...a, progress: newProgress } : a)),
                  );
                }}
                onRemove={async (id) => {
                  if (taskId) {
                    await supabase.from("task_assignees").delete().eq("id", id);
                  }
                  setWorkAssignments(workAssignments.filter((a) => a.id !== id));
                }}
              />
            </div>
          </TabsContent>
          <TabsContent value="discussion" className="h-[500px] mt-0">
            <TaskDiscussion
              taskId={taskId || ""}
              comments={comments}
              mentionableUsers={[...availableTeamLeads, ...employees]}
              onCommentAdded={loadTask}
              canComment={Boolean(taskId)}
            />
          </TabsContent>
          <TabsContent
            value="timeline"
            className="h-[500px] overflow-y-auto mt-0 bg-muted/10 border border-border rounded-lg"
          >
            <TaskTimeline logs={activityLogs} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-4 pt-4 border-t border-border">
          {isEmployeeTaskEdit && progress !== initialProgress && (
            <div className="w-full space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-2">
                <Label>Progress update note</Label>
                <Textarea
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="What did you work on? (Required)"
                  rows={2}
                />
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <div>
              {canDeleteTask && (
                <Button
                  variant="outline"
                  onClick={remove}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X size={14} className="mr-1.5" />
                Cancel
              </Button>
              <Button onClick={save} disabled={loading} className="neon-button">
                {loading ? "Saving..." : taskId ? "Save changes" : "Create task"}
              </Button>
              {isEmployeeTaskEdit && progress >= 100 && (
                <Button onClick={requestReview} disabled={loading} className="neon-button">
                  Request Review
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getDeadlineIso(bsDate: string, time: string) {
  if (!bsDate) return null;
  const adDate = bsInputToAdDateString(bsDate);
  if (!adDate) return null;
  return new Date(`${adDate}T${time || "18:00"}:00`).toISOString();
}

function formatTaskDateTime(value: string) {
  return `${formatNepaliDate(value, "DD MMM YYYY")} BS, ${format(new Date(value), "HH:mm")}`;
}
