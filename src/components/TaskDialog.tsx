import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  PRIORITIES,
  progressForStatus,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks-utils";
import { Save } from "lucide-react";

export function TaskDialog({
  open,
  onOpenChange,
  workId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workId?: string | null;
  onSaved?: () => void | Promise<void>;
}) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [progress, setProgress] = useState(0);
  
  const [canEdit, setCanEdit] = useState(false);
  const [moduleAssignmentId, setModuleAssignmentId] = useState<string | null>(null);

  useEffect(() => {
    if (open && workId) {
      loadWorkItem();
    }
  }, [open, workId]);

  const loadWorkItem = async () => {
    if (!workId) return;
    const { data, error } = await supabase
      .from("work_items")
      .select(`
        *,
        module_assignments!inner (
          user_id
        )
      `)
      .eq("id", workId)
      .single();

    if (error || !data) return toast.error("Failed to load work item");
    
    setTitle(data.title);
    setDescription(data.description || "");
    setStatus(data.status as TaskStatus);
    setPriority(data.priority as TaskPriority);
    setProgress(data.progress || 0);
    setModuleAssignmentId(data.module_assignment_id);
    
    // Ensure data.module_assignments exists before trying to access user_id
    const assignee = Array.isArray(data.module_assignments) ? data.module_assignments[0] : data.module_assignments;
    setCanEdit(isAdmin || (user && assignee && assignee.user_id === user.id));
  };

  const handleStatusChange = (val: TaskStatus) => {
    setStatus(val);
    setProgress(progressForStatus(val, progress));
  };

  const recalculateModuleProgress = async (maId: string) => {
    const { data: items } = await supabase.from('work_items').select('weight, progress').eq('module_assignment_id', maId);
    let totalWeight = 0;
    let completedWeight = 0;
    items?.forEach((i: any) => {
      totalWeight += (i.weight || 10);
      completedWeight += (i.weight || 10) * ((i.progress || 0) / 100);
    });
    const moduleProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await supabase.from('module_assignments').update({ progress: moduleProgress } as any).eq('id', maId);
    
    const { data: ma } = await supabase.from('module_assignments').select('sprint_module_id').eq('id', maId).maybeSingle();
    if (ma?.sprint_module_id) {
      const { data: siblings } = await supabase.from('module_assignments').select('weight, progress' as any).eq('sprint_module_id', ma.sprint_module_id);
      let smTotal = 0;
      let smComp = 0;
      siblings?.forEach((s: any) => {
        smTotal += (s.weight || 100);
        smComp += (s.weight || 100) * ((s.progress || 0) / 100);
      });
      const smProgress = smTotal > 0 ? Math.round((smComp / smTotal) * 100) : 0;
      await supabase.from('sprint_modules').update({ progress: smProgress } as any).eq('id', ma.sprint_module_id);
    }
  };

  const handleSave = async () => {
    if (!workId) return;
    setLoading(true);
    const { error } = await supabase
      .from("work_items")
      .update({
        title,
        description,
        status,
        priority,
        progress
      } as any)
      .eq("id", workId);
      
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Work item updated!");
      if (moduleAssignmentId) {
        await recalculateModuleProgress(moduleAssignmentId);
      }
      onOpenChange(false);
      if (onSaved) await onSaved();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Work Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              disabled={!canEdit} 
              className="min-h-[100px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={!canEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Progress ({progress}%)</Label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={!canEdit || status === "completed"}
                  className="flex-1 accent-primary"
                />
              </div>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
