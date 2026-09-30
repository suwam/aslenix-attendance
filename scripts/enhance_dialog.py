import os

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

TASK_DIALOG_TSX = """import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Save, FolderKanban, Calendar, Target, Shield, Send, CheckCircle2, AlertCircle } from "lucide-react";

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
      <DialogContent className="sm:max-w-[760px] p-0 overflow-hidden border-none shadow-[0_0_80px_-15px_rgba(var(--primary),0.3)] bg-background/80 backdrop-blur-xl">
        {/* Dynamic Gradient Background */}
        <div className="absolute inset-0 z-[-1] pointer-events-none">
          <div className="absolute top-0 left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-80 blur-[80px]" />
          <div className="absolute bottom-0 right-[-20%] w-[80%] h-[80%] bg-gradient-to-tl from-purple-500/10 via-transparent to-transparent opacity-50 blur-[60px]" />
        </div>

        <div className="px-8 py-7 border-b border-white/10 dark:border-white/5 flex flex-col gap-3 relative">
          <motion.h2 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-black uppercase tracking-tight bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent leading-tight drop-shadow-sm"
          >
            {title}
          </motion.h2>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
          >
            <span className="flex items-center gap-2 bg-background/50 px-3 py-1 rounded-full shadow-inner border border-border/50">
              <FolderKanban size={13} className="text-primary"/> {projectName}
            </span>
            <span className="flex items-center gap-2 bg-background/50 px-3 py-1 rounded-full shadow-inner border border-border/50">
              <Calendar size={13} className="text-primary"/> Week {weekNumber}
            </span>
          </motion.div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                  <Target size={14} className="text-primary"/> Current Progress
                </Label>
                <span className="text-xl font-black text-primary drop-shadow-sm">{progress}%</span>
              </div>
              <div className="pt-2 pb-1 relative group">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={!canEdit || status === "completed"}
                  className="w-full absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="h-4 w-full bg-secondary/80 rounded-full overflow-hidden border border-border/50 shadow-inner relative">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
                {/* Custom thumb visual */}
                <motion.div 
                  className="absolute top-1/2 -mt-3.5 h-7 w-7 bg-white dark:bg-zinc-800 rounded-full border-2 border-primary shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex items-center justify-center transition-transform group-hover:scale-110 pointer-events-none"
                  style={{ left: `calc(${progress}% - 14px)` }}
                >
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-3"
            >
              <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                <AlertCircle size={14} className="text-primary"/> Status
              </Label>
              <Select value={status} onValueChange={handleStatusChange} disabled={!canEdit}>
                <SelectTrigger className="h-14 font-black uppercase tracking-wider text-sm bg-background/50 backdrop-blur border-border/50 shadow-sm focus:ring-primary focus:border-primary transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-bold uppercase tracking-wider">
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="py-3">{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-3"
            >
              <Label className="text-[11px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-2">
                <Shield size={14} className="text-primary"/> Work Notes / Log
              </Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                disabled={!canEdit} 
                placeholder="Detail the exact work completed today..."
                className="min-h-[140px] resize-none text-sm bg-background/50 backdrop-blur border-border/50 shadow-sm focus:ring-primary focus:border-primary transition-all p-4 leading-relaxed"
              />
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-secondary/20 backdrop-blur-md rounded-3xl p-6 flex flex-col gap-6 border border-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] relative overflow-hidden"
          >
            {/* Subtle glow inside the card */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 blur-3xl rounded-full pointer-events-none" />

            <div className="relative z-10">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5 opacity-80">
                <FolderKanban size={12}/> Module
              </p>
              <p className="text-base font-bold leading-tight">{moduleName}</p>
            </div>
            <div className="relative z-10">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5 opacity-80">
                <Shield size={12}/> Role
              </p>
              <span className="text-xs font-black bg-gradient-to-br from-background to-secondary px-3 py-1.5 rounded-lg shadow-sm border border-border/50 uppercase tracking-widest text-primary inline-block">
                {roleName}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5 opacity-80">
                <Shield size={12}/> Assigned By
              </p>
              <p className="text-sm font-bold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary"><Shield size={12}/></span>
                Admin / PM
              </p>
            </div>
            {targetDate && (
              <div className="relative z-10">
                <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5 opacity-80">
                  <Target size={12}/> Target Date
                </p>
                <p className="text-sm font-black flex items-center gap-2 text-orange-500 bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/20">
                  <Target size={14}/> {targetDate}
                </p>
              </div>
            )}
            <div className="relative z-10">
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-2 flex items-center gap-1.5 opacity-80">
                <AlertCircle size={12}/> Priority
              </p>
              <p className="text-sm font-black uppercase tracking-widest text-primary drop-shadow-sm">{priority || 'NORMAL'}</p>
            </div>
          </motion.div>
        </div>

        {canEdit && (
          <div className="flex justify-between items-center px-8 py-5 border-t border-white/10 bg-background/50 backdrop-blur-md">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold uppercase tracking-wider text-xs px-6 hover:bg-destructive/10 hover:text-destructive transition-colors">
              Cancel
            </Button>
            <div className="flex items-center gap-4">
              {status !== 'review' && status !== 'completed' && (
                <Button 
                  onClick={() => handleSave("review", 100)} 
                  variant="outline" 
                  disabled={loading} 
                  className="rounded-xl font-black uppercase tracking-widest text-xs px-6 border-primary/30 text-primary hover:bg-primary/10 transition-all shadow-sm"
                >
                  <Send className="size-4 mr-2" />
                  Submit for Review
                </Button>
              )}
              <Button 
                onClick={() => handleSave()} 
                disabled={loading} 
                className="rounded-xl font-black uppercase tracking-widest text-xs px-8 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-[0_4px_20px_rgba(var(--primary),0.4)] transition-all hover:scale-105 hover:-translate-y-0.5 active:scale-95"
              >
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
"""

write_file("src/components/TaskDialog.tsx", TASK_DIALOG_TSX)
