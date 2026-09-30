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
import { toast } from "sonner";
import {
  TASK_STATUSES,
  STATUS_LABELS,
  type TaskStatus,
} from "@/lib/tasks-utils";
import { X, ArrowRight, Save, Clock, History, CheckCircle2, Shield, AlertCircle, FileText } from "lucide-react";
import { differenceInDays, format } from "date-fns";

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
  const [blockerReason, setBlockerReason] = useState("");
  
  const [initialProgress, setInitialProgress] = useState(0);
  const [initialStatus, setInitialStatus] = useState<TaskStatus>("todo");
  const [initialNotes, setInitialNotes] = useState("");
  const [initialBlocker, setInitialBlocker] = useState("");

  const [canEdit, setCanEdit] = useState(false);
  const [moduleAssignmentId, setModuleAssignmentId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState("");
  const [weight, setWeight] = useState(10);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  
  const [logs, setLogs] = useState<any[]>([]);

  // Calculate if there are unsaved changes
  const hasChanges = progress !== initialProgress || status !== initialStatus || notes !== initialNotes || blockerReason !== initialBlocker;

  useEffect(() => {
    if (open && workId) {
      loadWorkItem();
      loadLogs();
    } else {
      resetState();
    }
  }, [open, workId]);

  const resetState = () => {
    setTitle(""); setNotes(""); setStatus("todo"); setProgress(0); setBlockerReason("");
    setInitialProgress(0); setInitialStatus("todo"); setInitialNotes(""); setInitialBlocker("");
    setLogs([]);
  };

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
    setBlockerReason(data.blocker_reason || "");
    setModuleAssignmentId(data.module_assignment_id);
    setPriority(data.priority || 'medium');
    setWeight(data.weight || 10);
    setReviewStatus(data.review_status);
    
    setInitialNotes(data.notes || "");
    setInitialStatus((data.status as TaskStatus) || 'todo');
    setInitialProgress(data.progress || 0);
    setInitialBlocker(data.blocker_reason || "");
    
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

  const loadLogs = async () => {
    if (!workId) return;
    const { data } = await supabase.from("work_item_logs").select("*").eq("work_item_id", workId).order("created_at", { ascending: false });
    if (data) setLogs(data);
  };

  const handleStatusChange = (val: TaskStatus) => {
    setStatus(val);
  };

  const handleProgressChange = (val: number) => {
    setProgress(val);
    if (val === 100 && status !== "completed") {
      setStatus("review");
    } else if (val === 0 && status !== "todo") {
      setStatus("todo");
    } else if (val > 0 && val < 100 && (status === "todo" || status === "review")) {
      setStatus("in_progress");
    }
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

  const saveToDb = async (overrideStatus?: TaskStatus, overrideReviewStatus?: string) => {
    if (!workId) return;
    setLoading(true);
    const newStatus = overrideStatus || status;
    const revStat = overrideReviewStatus !== undefined ? overrideReviewStatus : reviewStatus;
    
    if (newStatus === "blocked" && !blockerReason.trim()) {
      toast.error("Please provide a blocker reason.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("work_items")
      .update({
        notes,
        status: newStatus,
        progress,
        blocker_reason: newStatus === "blocked" ? blockerReason : null,
        review_status: revStat,
      } as any)
      .eq("id", workId);
      
    if (error) {
      toast.error("Unable to save changes. " + error.message);
      setLoading(false);
      return;
    }

    // Insert log
    if (hasChanges || overrideStatus) {
      await supabase.from("work_item_logs").insert({
        work_item_id: workId,
        user_id: user?.id,
        old_progress: initialProgress,
        new_progress: progress,
        old_status: initialStatus,
        new_status: newStatus,
        update_text: notes !== initialNotes ? notes : (overrideReviewStatus ? "Submitted for review" : "Updated progress")
      } as any);
    }

    toast.success("Progress updated successfully");
    if (moduleAssignmentId) {
      await recalculateModuleProgress(moduleAssignmentId);
    }
    
    setInitialProgress(progress);
    setInitialStatus(newStatus);
    setInitialNotes(notes);
    setInitialBlocker(blockerReason);
    setReviewStatus(revStat || null);
    
    onOpenChange(false);
    if (onSaved) await onSaved();
    setLoading(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (!confirm("You have unsaved progress updates. Are you sure you want to leave?")) {
        return;
      }
    }
    onOpenChange(false);
  };

  const progressGuidance = () => {
    if (progress === 0) return "Not started";
    if (progress < 40) return "Initial work started";
    if (progress < 70) return "Halfway completed";
    if (progress < 100) return "Almost complete";
    return "Work completed";
  };

  const renderTargetDate = () => {
    if (!targetDate) return <span className="text-muted-foreground">Not set</span>;
    const diff = differenceInDays(new Date(targetDate), new Date());
    if (diff < 0 && status !== 'completed' && status !== 'review') {
      return (
        <div>
          <span className="font-semibold">{format(new Date(targetDate), 'dd MMM yyyy')}</span>
          <span className="block text-destructive text-[11px] font-bold uppercase mt-0.5">{Math.abs(diff)} days overdue</span>
        </div>
      );
    }
    return (
      <div>
        <span className="font-semibold">{format(new Date(targetDate), 'dd MMM yyyy')}</span>
        {status !== 'completed' && status !== 'review' && (
          <span className="block text-muted-foreground text-[11px] mt-0.5">{diff === 0 ? "Due today" : `${diff} days remaining`}</span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden border border-border shadow-2xl rounded-2xl bg-card" hideCloseButton>
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-border/40 relative">
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-8 w-8 text-muted-foreground rounded-full hover:bg-muted" onClick={handleClose}>
            <X className="size-4" />
          </Button>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1 pr-8">{title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="text-foreground font-semibold">{roleName}</span>
            <span>·</span>
            <span>{projectName}</span>
            <span>·</span>
            <span>Week {weekNumber}</span>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="size-3.5" /> Assigned by Admin / PM
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-col lg:flex-row">
          {/* LEFT COLUMN */}
          <div className="flex-1 p-8 lg:border-r border-border/40 overflow-y-auto max-h-[60vh] lg:max-h-[70vh]">
            
            {/* Progress Section */}
            <div className="mb-10">
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Current Progress</h3>
                <span className="text-4xl font-black text-foreground tracking-tighter leading-none">{progress}%</span>
              </div>
              
              <div className="relative pt-1 pb-4 group">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progress}
                  onChange={(e) => handleProgressChange(Number(e.target.value))}
                  disabled={!canEdit || status === "completed"}
                  className="w-full absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }} 
                  />
                </div>
                <motion.div 
                  className="absolute top-[3px] -ml-2.5 h-5 w-5 bg-background rounded-full border-[3px] border-primary shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 pointer-events-none"
                  style={{ left: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-muted-foreground px-1">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <p className="text-xs font-medium text-primary mt-3 bg-primary/5 inline-block px-2.5 py-1 rounded-md">
                {progressGuidance()}
              </p>
            </div>

            {/* Status Section */}
            <div className="mb-8">
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Status</h3>
              <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)} disabled={!canEdit}>
                <SelectTrigger className="w-full h-11 text-sm font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {STATUS_LABELS[status] || status}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.filter(s => s !== "completed" || status === "completed").map((s) => (
                    <SelectItem key={s} value={s} className="font-medium text-sm py-2">
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Blocker Reason */}
            <AnimatePresence>
              {status === "blocked" && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8 overflow-hidden"
                >
                  <h3 className="text-[11px] font-bold text-destructive uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlertCircle size={14}/> Blocker Reason</h3>
                  <Textarea 
                    value={blockerReason} 
                    onChange={(e) => setBlockerReason(e.target.value)} 
                    disabled={!canEdit}
                    placeholder="Explain what is blocking this assignment..."
                    className="min-h-[80px] resize-none border-destructive/30 focus-visible:ring-destructive"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Work Update Section */}
            <div className="mb-8">
              <div className="flex justify-between items-end mb-3">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Work Update</h3>
                <span className="text-[10px] text-muted-foreground font-medium">{notes.length} / 1000</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Describe what you worked on, what was completed, and what remains.
              </p>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value.slice(0, 1000))} 
                disabled={!canEdit} 
                placeholder="Example: Completed the AI API integration and database schema. Remaining: error handling."
                className="min-h-[120px] resize-none text-sm p-4 leading-relaxed bg-muted/20"
                maxLength={1000}
              />
            </div>

            {/* Work Log History */}
            {logs.length > 0 && (
              <div className="mt-10 border-t border-border/40 pt-8">
                <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <History size={14}/> Work Log History
                </h3>
                <div className="space-y-4 pl-2 border-l-2 border-muted">
                  {logs.slice(0, 5).map(log => (
                    <div key={log.id} className="relative pl-4">
                      <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" />
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-xs font-semibold text-foreground">{format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}</span>
                        {log.old_progress !== log.new_progress && (
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {log.old_progress}% → {log.new_progress}%
                          </span>
                        )}
                      </div>
                      {log.update_text && <p className="text-sm text-muted-foreground leading-relaxed">{log.update_text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:w-[320px] bg-muted/10 p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Assignment Details</h3>
              
              <div className="space-y-5 text-sm">
                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Module</span>
                  <span className="font-semibold text-foreground">{moduleName}</span>
                </div>
                
                <div className="h-px w-full bg-border/40" />
                
                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Role</span>
                  <span className="inline-block font-semibold bg-background border px-2 py-0.5 rounded shadow-sm">{roleName}</span>
                </div>
                
                <div className="h-px w-full bg-border/40" />

                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Assigned By</span>
                  <span className="font-semibold">Admin / PM</span>
                </div>
                
                <div className="h-px w-full bg-border/40" />

                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Target Date</span>
                  {renderTargetDate()}
                </div>
                
                <div className="h-px w-full bg-border/40" />

                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Priority</span>
                  <span className="font-semibold uppercase text-xs">{priority}</span>
                </div>
                
                <div className="h-px w-full bg-border/40" />

                <div>
                  <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Task Weight</span>
                  <span className="font-semibold">{weight}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* REVIEW STATUS & ACTIONS */}
        <div className="px-8 py-5 border-t border-border bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mr-2">Review Status</h3>
            {reviewStatus === "pending" ? (
              <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full"><Clock size={12}/> Pending Review</span>
            ) : reviewStatus === "verified" ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full"><CheckCircle2 size={12}/> Verified</span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"/> Not Submitted</span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={handleClose} className="text-xs font-semibold">
              Cancel
            </Button>
            {canEdit && (
              <>
                <Button 
                  onClick={() => {
                    if(confirm("Submit this assignment for review?\\n\\nStatus will be updated to Under Review.")) {
                      saveToDb("review", "pending");
                    }
                  }} 
                  variant="outline" 
                  disabled={loading || status === "completed"} 
                  className="text-xs font-bold"
                >
                  Submit for Review <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
                <Button 
                  onClick={() => saveToDb()} 
                  disabled={loading || !hasChanges} 
                  className="text-xs font-bold px-6 shadow-md"
                >
                  <Save className="size-3.5 mr-2" />
                  {loading ? "Saving..." : "Save Progress"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
"""
write_file("src/components/TaskDialog.tsx", TASK_DIALOG_TSX)
