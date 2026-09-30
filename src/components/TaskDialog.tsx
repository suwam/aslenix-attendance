import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  progressForStatus,
  type TaskStatus,
} from "@/lib/tasks-utils";
import { Save, FolderKanban, Calendar, Target, Shield, Send } from "lucide-react";

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
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [progress, setProgress] = useState(0);
  
  const [canEdit, setCanEdit] = useState(false);
  const [moduleAssignmentId, setModuleAssignmentId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("");

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
          user_id,
          role,
          sprint_modules (
            modules ( name ),
            weekly_sprints (
              week_number,
              target_date,
              projects ( name )
            )
          )
        )
      `)
      .eq("id", workId)
      .single();

    if (error || !data) return toast.error("Failed to load work item");
    
    setTitle(data.title);
    setNotes(data.notes || "");
    setStatus((data.status as TaskStatus) || 'todo');
    setProgress(data.progress || 0);
    setModuleAssignmentId(data.module_assignment_id);
    setPriority(data.priority || 'medium');
    
    const assignee = Array.isArray(data.module_assignments) ? data.module_assignments[0] : data.module_assignments;
    setCanEdit(isAdmin || (user && assignee && assignee.user_id === user.id));

    if (assignee) {
      setRoleName(assignee.role);
      const sm = assignee.sprint_modules;
      if (sm) {
        setModuleName(sm.modules?.name || "");
        const sp = sm.weekly_sprints;
        if (sp) {
          setWeekNumber(sp.week_number);
          setTargetDate(sp.target_date || "");
          setProjectName(sp.projects?.name || "");
        }
      }
    }
  };

  const handleStatusChange = (val: TaskStatus) => {
    setStatus(val);
    setProgress(progressForStatus(val, progress));
  };

  const recalculateModuleProgress = async (maId: string) => {
    const { data: items } = await supabase.from('work_items').select('weight, progress' as any).eq('module_assignment_id', maId);
    let totalWeight = 0;
    let completedWeight = 0;
    (items as any[])?.forEach((i: any) => {
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
      (siblings as any[])?.forEach((s: any) => {
        smTotal += (s.weight || 100);
        smComp += (s.weight || 100) * ((s.progress || 0) / 100);
      });
      const smProgress = smTotal > 0 ? Math.round((smComp / smTotal) * 100) : 0;
      await supabase.from('sprint_modules').update({ progress: smProgress } as any).eq('id', ma.sprint_module_id);
    }
  };

  const handleSave = async (overrideStatus?: TaskStatus, overrideProgress?: number) => {
    if (!workId) return;
    setLoading(true);
    const newStatus = overrideStatus || status;
    const newProgress = overrideProgress !== undefined ? overrideProgress : progress;
    
    const { error } = await supabase
      .from("work_items")
      .update({
        notes,
        status: newStatus,
        progress: newProgress
      } as any)
      .eq("id", workId);
      
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Progress saved successfully");
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
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border-border shadow-2xl">
        <div className="bg-primary/5 px-6 py-5 border-b border-border flex flex-col gap-2">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-primary leading-tight">{title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><FolderKanban size={13}/> {projectName}</span>
            <span className="opacity-40">•</span>
            <span className="flex items-center gap-1.5"><Calendar size={13}/> Week {weekNumber}</span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-7">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest">Current Progress</Label>
                <span className="text-sm font-black">{progress}%</span>
              </div>
              <div className="pt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={!canEdit || status === "completed"}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>
              <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest">Status</Label>
              <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                <SelectTrigger className="h-11 font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="font-semibold">{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest">Work Notes / Log</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                disabled={!canEdit} 
                placeholder="What did you complete today?"
                className="min-h-[120px] resize-none text-sm"
              />
            </div>
          </div>
          
          <div className="bg-secondary/40 rounded-2xl p-5 flex flex-col gap-5 border border-border/60">
            <div>
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5">Module</p>
              <p className="text-sm font-bold">{moduleName}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5">Role</p>
              <span className="text-xs font-black bg-background px-2.5 py-1 rounded shadow-sm border uppercase tracking-wider">{roleName}</span>
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5">Assigned By</p>
              <p className="text-sm font-semibold flex items-center gap-1.5"><Shield size={14} className="text-primary"/> Admin / PM</p>
            </div>
            {targetDate && (
              <div>
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5">Target Date</p>
                <p className="text-sm font-black flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                  <Target size={14}/> {targetDate}
                </p>
              </div>
            )}
            <div>
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest mb-1.5">Priority</p>
              <p className="text-sm font-black uppercase tracking-wider">{priority || 'NORMAL'}</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-between items-center p-5 border-t bg-muted/30">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            <div className="flex items-center gap-3">
              {status !== 'review' && status !== 'completed' && (
                <Button onClick={() => handleSave("review", 100)} variant="secondary" disabled={loading} className="font-bold">
                  <Send className="size-4 mr-2" />
                  Submit for Review
                </Button>
              )}
              <Button onClick={() => handleSave()} disabled={loading} className="px-6 font-bold">
                <Save className="size-4 mr-2" />
                Save Progress
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
