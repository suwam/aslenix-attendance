import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TASK_STATUSES, STATUS_LABELS, PRIORITIES, type TaskStatus, type TaskPriority } from "@/lib/tasks-utils";
import { Send, Paperclip, Trash2, Download, X } from "lucide-react";
import { format } from "date-fns";

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
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus || "todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [progress, setProgress] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>(user?.id || "");
  const [tags, setTags] = useState("");
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    setStatus(defaultStatus || "todo");
    if (isAdmin) {
      supabase.from("profiles").select("user_id, full_name").eq("approval_status", "approved").then(({ data }) => setEmployees(data || []));
    }
    if (taskId) loadTask();
    else resetForm();
  }, [open, taskId]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setProgress(0);
    setDeadline(""); setAssignedTo(user?.id || ""); setTags("");
    setComments([]); setAttachments([]);
  };

  const loadTask = async () => {
    if (!taskId) return;
    const [{ data: t }, { data: c }, { data: a }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at"),
    ]);
    if (t) {
      setTitle(t.title); setDescription(t.description || ""); setStatus(t.status);
      setPriority(t.priority); setProgress(t.progress); setAssignedTo(t.assigned_to);
      setDeadline(t.deadline ? t.deadline.slice(0, 16) : "");
      setTags((t.tags || []).join(", "));
    }
    // hydrate user names for comments
    const ids = Array.from(new Set((c || []).map((x: any) => x.user_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      names = Object.fromEntries((profs || []).map((p) => [p.user_id, p.full_name]));
    }
    setComments((c || []).map((x: any) => ({ ...x, author: names[x.user_id] || "User" })));
    setAttachments(a || []);
  };

  const save = async () => {
    if (!user || !title.trim()) return toast.error("Title required");
    setLoading(true);
    const tagsArr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title, description: description || null, status, priority,
      progress: status === "completed" ? 100 : progress,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      assigned_to: assignedTo || user.id,
      tags: tagsArr,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    };
    let error;
    if (taskId) {
      ({ error } = await supabase.from("tasks").update(payload).eq("id", taskId));
    } else {
      ({ error } = await supabase.from("tasks").insert({ ...payload, created_by: user.id }));
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(taskId ? "Task updated" : "Task created");
    onSaved?.();
    onOpenChange(false);
  };

  const remove = async () => {
    if (!taskId) return;
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    onSaved?.(); onOpenChange(false);
  };

  const addComment = async () => {
    if (!taskId || !user || !newComment.trim()) return;
    const { error } = await supabase.from("task_comments").insert({ task_id: taskId, user_id: user.id, comment: newComment.trim() });
    if (error) return toast.error(error.message);
    setNewComment(""); loadTask();
  };

  const uploadFile = async (file: File) => {
    if (!taskId || !user) return toast.error("Save task first");
    const path = `${user.id}/${taskId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("task-files").upload(path, file);
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("task_attachments").insert({
      task_id: taskId, user_id: user.id, file_name: file.name, file_path: path,
      file_size: file.size, mime_type: file.type,
    });
    if (error) return toast.error(error.message);
    loadTask();
  };

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a"); a.href = data.signedUrl; a.download = name; a.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass border-border">
        <DialogHeader>
          <DialogTitle>{taskId ? "Edit Task" : "Create Task"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add details…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Progress: {progress}%</Label>
            <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-full accent-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="frontend, urgent" />
            </div>
          </div>

          {isAdmin && (
            <div>
              <Label>Assign to</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {taskId && (
            <>
              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">Attachments</Label>
                <div className="space-y-1.5 mb-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/30">
                      <Paperclip size={14} className="text-muted-foreground" />
                      <span className="flex-1 truncate">{a.file_name}</span>
                      <button onClick={() => downloadFile(a.file_path, a.file_name)} className="p-1 hover:text-primary"><Download size={14} /></button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-primary hover:underline">
                  <Paperclip size={12} /> Attach file
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                </label>
              </div>

              <div className="border-t border-border pt-4">
                <Label className="mb-2 block">Comments</Label>
                <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="text-sm p-2.5 rounded-lg bg-muted/30">
                      <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                        <span className="font-medium text-foreground">{c.author}</span>
                        <span>{format(new Date(c.created_at), "MMM d, HH:mm")}</span>
                      </div>
                      <div>{c.comment}</div>
                    </div>
                  ))}
                  {comments.length === 0 && <div className="text-xs text-muted-foreground">No comments yet</div>}
                </div>
                <div className="flex gap-2">
                  <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => e.key === "Enter" && addComment()} />
                  <Button onClick={addComment} size="icon" className="neon-button"><Send size={14} /></Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <div>
              {taskId && (
                <Button variant="outline" onClick={remove} className="text-destructive hover:text-destructive">
                  <Trash2 size={14} className="mr-1.5" />Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}><X size={14} className="mr-1.5" />Cancel</Button>
              <Button onClick={save} disabled={loading} className="neon-button">{loading ? "Saving…" : taskId ? "Save changes" : "Create task"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
