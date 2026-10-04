import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ADStoredBSDateInput } from "@/components/BSDateInput";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FolderDot,
  Plus,
  Briefcase,
  Download,
  Users,
  FileText,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
} from "lucide-react";
import { WeeklySprintWizard } from "@/components/tasks/WeeklySprintWizard";
import { WeeklySprintReport } from "@/components/tasks/WeeklySprintReport";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/tasks")({ component: AdminTasksRedesign });

function Avatar({ url, name, size = "md" }: { url?: string | null, name?: string | null, size?: "sm" | "md" }) {
  const initials = (name || "U").substring(0, 2).toUpperCase();
  const classes = size === "sm" ? "size-6 text-[10px]" : "size-10 text-xs";
  return url ? (
    <img src={url} alt={name || ""} className={`${classes} rounded-full object-cover border shadow-sm`} />
  ) : (
    <div className={`${classes} rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold flex items-center justify-center border border-primary/20 shadow-sm shrink-0`}>
      {initials}
    </div>
  );
}

function AdminTasksRedesign() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  
  // Drill-down data
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [sprintModules, setSprintModules] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState<any | null>(null);
  const [deletingWorkItem, setDeletingWorkItem] = useState<any | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [assignmentEditorOpen, setAssignmentEditorOpen] = useState(false);
  const [assignmentModuleId, setAssignmentModuleId] = useState("");
  const [deletingAssignment, setDeletingAssignment] = useState<any | null>(null);
  const [weekEditorOpen, setWeekEditorOpen] = useState(false);
  const [weekDeleteOpen, setWeekDeleteOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editWeight, setEditWeight] = useState("10");
  const [editAssignmentId, setEditAssignmentId] = useState("");
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState("");
  const [assignmentWeight, setAssignmentWeight] = useState("50");
  const [weekNumber, setWeekNumber] = useState("");
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [weekTargetDate, setWeekTargetDate] = useState("");
  const [weekGoal, setWeekGoal] = useState("");
  const [savingWorkItem, setSavingWorkItem] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [deletingAssignmentBusy, setDeletingAssignmentBusy] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);

  useEffect(() => {
    const fetchInit = async () => {
      const { data: pData } = await supabase.from("projects").select("*").order("created_at");
      setProjects(pData || []);
      const { data: profData } = await supabase.from("profiles").select("*");
      setProfiles(profData || []);
      if (pData?.length) setSelectedProjectId(pData[0].id);
    };
    fetchInit();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchProj = async () => {
      const { data: sData } = await supabase.from("weekly_sprints").select("*").eq("project_id", selectedProjectId).order("week_number");
      setSprints(sData || []);
      if (sData?.length) {
        if (!selectedSprintId || !sData.find(s => s.id === selectedSprintId)) {
          setSelectedSprintId(sData[sData.length - 1].id);
        }
      } else {
        setSelectedSprintId("");
      }
      
      const { data: mData } = await supabase.from("modules").select("*").eq("project_id", selectedProjectId);
      setModules(mData || []);
    };
    fetchProj();
  }, [selectedProjectId, refreshKey]);

  useEffect(() => {
    if (!selectedSprintId) return;
    const fetchSprint = async () => {
      const [tData, tmData, smData, aData, wData, tgtData, reqData] = await Promise.all([
        supabase.from("sprint_teams").select("*").eq("sprint_id", selectedSprintId),
        supabase.from("sprint_team_members").select("*, sprint_teams!inner(*)").eq("sprint_teams.sprint_id", selectedSprintId),
        supabase.from("sprint_modules").select("*").eq("sprint_id", selectedSprintId),
        supabase.from("module_assignments").select("*, sprint_modules!inner(*)").eq("sprint_modules.sprint_id", selectedSprintId),
        supabase.from("work_items").select("*, module_assignments!inner(sprint_modules!inner(*))").eq("module_assignments.sprint_modules.sprint_id", selectedSprintId),
        supabase.from("weekly_targets").select("*").eq("sprint_id", selectedSprintId),
        supabase.from("target_requirements").select("*, weekly_targets!inner(*)").eq("weekly_targets.sprint_id", selectedSprintId)
      ]);
      
      setTeams(tData.data || []);
      setTeamMembers(tmData.data || []);
      setSprintModules(smData.data || []);
      setAssignments(aData.data || []);
      setWorkItems(wData.data || []);
      setTargets(tgtData.data || []);
      setRequirements(reqData.data || []);
    };
    fetchSprint();
  }, [selectedSprintId, refreshKey]);

  // Derived calculations
  const selectedSprint = sprints.find(s => s.id === selectedSprintId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Weekly Progress
  const weeklyProgress = useMemo(() => {
    if (!workItems.length) return 0;
    let totalWeight = 0;
    let completedWeight = 0;
    workItems.forEach(w => {
      const wt = w.weight || 10;
      totalWeight += wt;
      if (w.status === 'Completed' || w.status === 'completed') completedWeight += wt;
    });
    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  }, [workItems]);

  const toggleWorkItem = async (wi: any) => {
    const isCompleted = wi.status === 'Completed' || wi.status === 'completed';
    const newStatus = isCompleted ? 'In Progress' : 'Completed';
    const { error } = await supabase.from('work_items').update({ status: newStatus }).eq('id', wi.id);
    if (error) {
      toast.error(`Unable to update task status. ${error.message}`);
      return;
    }
    setRefreshKey(k => k + 1);
  };

  const openWorkItemEditor = (workItem: any) => {
    setEditingWorkItem(workItem);
    setEditTitle(workItem.title || "");
    setEditDescription(workItem.description || "");
    setEditPriority(workItem.priority || "medium");
    setEditWeight(String(workItem.weight ?? 10));
    setEditAssignmentId(workItem.module_assignment_id || "");
  };

  const saveWorkItem = async () => {
    if (!editingWorkItem) return;
    const weight = Number(editWeight);
    if (!editTitle.trim()) {
      toast.error("Task title is required.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error("Weight must be a number greater than zero.");
      return;
    }
    if (!editAssignmentId) {
      toast.error("Select an employee assignment.");
      return;
    }

    setSavingWorkItem(true);
    const { error } = await supabase
      .from("work_items")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        priority: editPriority,
        weight,
        module_assignment_id: editAssignmentId,
      })
      .eq("id", editingWorkItem.id);
    setSavingWorkItem(false);
    if (error) {
      toast.error(`Unable to save task. ${error.message}`);
      return;
    }

    toast.success("Task updated.");
    setEditingWorkItem(null);
    setRefreshKey(k => k + 1);
  };

  const deleteWorkItem = async () => {
    if (!deletingWorkItem) return;
    setDeleting(true);
    const { error } = await supabase.from("work_items").delete().eq("id", deletingWorkItem.id);
    setDeleting(false);
    if (error) {
      toast.error(`Unable to delete task. ${error.message}`);
      return;
    }

    toast.success("Task deleted.");
    setDeletingWorkItem(null);
    setRefreshKey(k => k + 1);
  };

  const openWeekEditor = () => {
    if (!selectedSprint) return;
    setWeekNumber(String(selectedSprint.week_number ?? ""));
    setWeekStartDate(selectedSprint.start_date || "");
    setWeekEndDate(selectedSprint.end_date || "");
    setWeekTargetDate(selectedSprint.target_date || "");
    setWeekGoal(selectedSprint.sprint_goal || "");
    setWeekEditorOpen(true);
  };

  const saveWeek = async () => {
    if (!selectedSprint) return;
    const parsedWeekNumber = Number(weekNumber);
    if (!Number.isInteger(parsedWeekNumber) || parsedWeekNumber < 1) {
      toast.error("Week number must be a positive whole number.");
      return;
    }
    if (weekStartDate && weekEndDate && weekStartDate > weekEndDate) {
      toast.error("The end date cannot be before the start date.");
      return;
    }

    setSavingWeek(true);
    const { error } = await supabase
      .from("weekly_sprints")
      .update({
        week_number: parsedWeekNumber,
        start_date: weekStartDate || null,
        end_date: weekEndDate || null,
        target_date: weekTargetDate || null,
        sprint_goal: weekGoal.trim() || null,
      })
      .eq("id", selectedSprint.id);
    setSavingWeek(false);
    if (error) {
      toast.error(`Unable to update week. ${error.message}`);
      return;
    }

    toast.success("Week updated.");
    setWeekEditorOpen(false);
    setRefreshKey(k => k + 1);
  };

  const deleteWeek = async () => {
    if (!selectedSprint) return;
    setDeletingWeek(true);
    const { error } = await supabase.from("weekly_sprints").delete().eq("id", selectedSprint.id);
    setDeletingWeek(false);
    if (error) {
      toast.error(`Unable to delete week. ${error.message}`);
      return;
    }

    toast.success("Week and its assignments deleted.");
    setWeekDeleteOpen(false);
    setSelectedSprintId("");
    setRefreshKey(k => k + 1);
  };

  const openAssignmentEditor = (assignment: any) => {
    setEditingAssignment(assignment);
    setAssignmentModuleId(assignment.sprint_module_id);
    setAssignmentUserId(assignment.user_id || "");
    setAssignmentRole(assignment.role || "");
    setAssignmentWeight(String(assignment.weight ?? 50));
    setAssignmentEditorOpen(true);
  };

  const openNewAssignment = (sprintModuleId: string) => {
    setEditingAssignment(null);
    setAssignmentModuleId(sprintModuleId);
    setAssignmentUserId("");
    setAssignmentRole("");
    setAssignmentWeight("50");
    setAssignmentEditorOpen(true);
  };

  const saveAssignment = async () => {
    const weight = Number(assignmentWeight);
    if (!assignmentUserId) {
      toast.error("Select an employee.");
      return;
    }
    if (!assignmentRole.trim()) {
      toast.error("Assignment role is required.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error("Assignment weight must be greater than zero.");
      return;
    }
    if (
      assignments.some(
        item =>
          item.id !== editingAssignment?.id &&
          item.sprint_module_id === assignmentModuleId &&
          item.user_id === assignmentUserId,
      )
    ) {
      toast.error("This employee is already assigned to the selected module.");
      return;
    }

    const sprintModule = sprintModules.find(item => item.id === assignmentModuleId);
    if (!sprintModule?.team_id) {
      toast.error("Could not find the team for this assignment.");
      return;
    }

    setSavingAssignment(true);
    const previousUserId = editingAssignment?.user_id;
    let createdTeamMember = false;
    if (!editingAssignment || assignmentUserId !== previousUserId) {
      const { data: existingMember, error: memberLookupError } = await supabase
        .from("sprint_team_members")
        .select("id")
        .eq("team_id", sprintModule.team_id)
        .eq("user_id", assignmentUserId)
        .maybeSingle();
      if (memberLookupError) {
        setSavingAssignment(false);
        toast.error(`Unable to check team membership. ${memberLookupError.message}`);
        return;
      }
      if (!existingMember) {
        const { error: memberInsertError } = await supabase.from("sprint_team_members").insert({
          team_id: sprintModule.team_id,
          user_id: assignmentUserId,
          role: assignmentRole.trim(),
        });
        if (memberInsertError) {
          setSavingAssignment(false);
          toast.error(`Unable to add employee to the team. ${memberInsertError.message}`);
          return;
        }
        createdTeamMember = true;
      }
    }

    const assignmentMutation = editingAssignment
      ? supabase
          .from("module_assignments")
          .update({
            user_id: assignmentUserId,
            role: assignmentRole.trim(),
            weight,
          })
          .eq("id", editingAssignment.id)
      : supabase.from("module_assignments").insert({
        user_id: assignmentUserId,
        role: assignmentRole.trim(),
        weight,
        sprint_module_id: assignmentModuleId,
      });
    const { error } = await assignmentMutation;
    if (error) {
      let rollbackMessage = "";
      if (createdTeamMember && assignmentUserId !== previousUserId) {
        const { error: rollbackError } = await supabase
          .from("sprint_team_members")
          .delete()
          .eq("team_id", sprintModule.team_id)
          .eq("user_id", assignmentUserId);
        if (rollbackError) rollbackMessage = ` The employee was added to the team but could not be removed: ${rollbackError.message}`;
      }
      setSavingAssignment(false);
      toast.error(`Unable to ${editingAssignment ? "update" : "create"} assignment. ${error.message}${rollbackMessage}`);
      return;
    }

    if (editingAssignment && assignmentUserId !== previousUserId && previousUserId) {
      const otherAssignments = assignments.filter(
        item =>
          item.id !== editingAssignment.id &&
          item.user_id === previousUserId &&
          sprintModules.some(
            module => module.id === item.sprint_module_id && module.team_id === sprintModule.team_id,
          ),
      );
      if (otherAssignments.length === 0) {
        const { error: memberDeleteError } = await supabase
          .from("sprint_team_members")
          .delete()
          .eq("team_id", sprintModule.team_id)
          .eq("user_id", previousUserId);
        if (memberDeleteError) {
          toast.error(`Assignment saved, but the previous team member could not be removed. ${memberDeleteError.message}`);
        }
      }
    }

    setSavingAssignment(false);
    toast.success(editingAssignment ? "Employee assignment updated." : "Employee assigned to module.");
    setAssignmentEditorOpen(false);
    setEditingAssignment(null);
    setRefreshKey(k => k + 1);
  };

  const deleteAssignment = async () => {
    if (!deletingAssignment) return;
    setDeletingAssignmentBusy(true);
    const sprintModule = sprintModules.find(item => item.id === deletingAssignment.sprint_module_id);
    const hasOtherAssignmentForEmployee = assignments.some(
      item =>
        item.id !== deletingAssignment.id &&
        item.user_id === deletingAssignment.user_id &&
        sprintModules.some(
          module => module.id === item.sprint_module_id && module.team_id === sprintModule?.team_id,
        ),
    );
    const { error } = await supabase
      .from("module_assignments")
      .delete()
      .eq("id", deletingAssignment.id);
    if (error) {
      setDeletingAssignmentBusy(false);
      toast.error(`Unable to delete assignment. ${error.message}`);
      return;
    }

    if (!hasOtherAssignmentForEmployee && sprintModule?.team_id) {
      const { error: memberDeleteError } = await supabase
        .from("sprint_team_members")
        .delete()
        .eq("team_id", sprintModule.team_id)
        .eq("user_id", deletingAssignment.user_id);
      if (memberDeleteError) {
        setDeletingAssignmentBusy(false);
        toast.error(`Assignment deleted, but the employee could not be removed from the team. ${memberDeleteError.message}`);
        setDeletingAssignment(null);
        setRefreshKey(k => k + 1);
        return;
      }
    }

    setDeletingAssignmentBusy(false);
    toast.success("Assignment and its tasks deleted.");
    setDeletingAssignment(null);
    setRefreshKey(k => k + 1);
  };

  if (!selectedProjectId) {
    return (
      <div className="p-12 text-center rounded-3xl border border-dashed mt-8 bg-background/50">
        <Briefcase className="size-12 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-2xl font-bold mb-2">No Projects Available</h3>
        <p className="text-muted-foreground mb-8">Create a new project to get started with the sprint system.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Selector */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage weekly assignments, tasks, and progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-background/80 backdrop-blur border rounded-2xl p-1 flex items-center shadow-sm">
            <FolderDot className="text-primary ml-3 mr-2 size-5" />
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[200px] border-none shadow-none bg-transparent font-bold focus:ring-0">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Navigation & Add Week */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
              <SelectTrigger className="w-full min-w-[210px] border-input bg-background font-semibold sm:w-[240px]">
                <SelectValue placeholder="Select Week" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    Week {s.week_number} — {s.start_date ? `${formatNepaliDate(s.start_date)} BS` : "Dates not set"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedSprint && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {selectedSprint.start_date ? `${formatNepaliDate(selectedSprint.start_date)} BS` : "No start date"} <span className="text-muted-foreground">to</span> {selectedSprint.end_date ? `${formatNepaliDate(selectedSprint.end_date)} BS` : "No end date"}
              </div>
              {selectedSprint.sprint_goal && <div className="truncate text-xs text-muted-foreground">{selectedSprint.sprint_goal}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedSprint && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={openWeekEditor}>
                <Pencil className="size-4" /> Edit week
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setWeekDeleteOpen(true)}>
                <Trash2 className="size-4" /> Delete week
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setReportOpen(true)} disabled={!selectedSprint} className="font-medium">
            <Download className="size-4"/> <span className="hidden sm:inline">View Weekly Report</span><span className="sm:hidden">Report</span>
          </Button>
          <Button onClick={() => setWizardOpen(true)} className="font-semibold">
            <Plus className="size-4"/> <span className="hidden sm:inline">Add Weekly Assignment</span><span className="sm:hidden">Add week</span>
          </Button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      {selectedSprint ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Assigned tasks</div>
            <div className="text-2xl font-bold">{workItems.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Week {selectedSprint.week_number} progress</div>
            <div className="text-2xl font-bold text-primary">{weeklyProgress}%</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1"><Users className="size-4"/> Team</div>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1"><FileText className="size-4"/> Modules</div>
            <div className="text-2xl font-bold">{sprintModules.length}</div>
          </div>
          <div className="hidden rounded-xl border bg-card p-4 lg:block">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1"><CheckCircle2 className="size-4"/> Targets</div>
            <div className="text-2xl font-bold">{targets.filter(t => t.status === 'Completed').length} / {targets.length}</div>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">Select or create a week to view dashboard.</div>
      )}

      {/* MODULE CARDS */}
      <div className="space-y-5 mt-6">
        {sprintModules.map(sm => {
          const mod = modules.find(m => m.id === sm.module_id);
          const modAsgs = assignments.filter(a => a.sprint_module_id === sm.id);
          const modItems = workItems.filter(w => modAsgs.some(a => a.id === w.module_assignment_id));
          
          let mTotal = 0; let mComp = 0;
          modItems.forEach(w => { mTotal += (w.weight||10); if(w.status === 'Completed' || w.status === 'completed') mComp += (w.weight||10); });
          const modProg = mTotal > 0 ? Math.round((mComp/mTotal)*100) : 0;

          return (
            <section key={sm.id} className="overflow-hidden rounded-xl border bg-card">
              <div className="p-4 sm:p-5 bg-muted/30 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FolderDot className="size-5 text-primary"/> {mod?.name || 'Unknown Module'}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{modItems.length} tasks · {modAsgs.length} assigned employees</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => openNewAssignment(sm.id)} className="inline-flex">
                    <Plus className="size-4"/> <span className="hidden sm:inline">Assign employee</span><span className="sm:hidden">Assign</span>
                  </Button>
                  <div className="text-right hidden sm:block">
                     <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Module Progress</div>
                     <div className="w-32 h-2.5 rounded-full bg-background border shadow-inner overflow-hidden">
                       <div className="h-full bg-primary transition-all duration-500" style={{width:`${modProg}%`}}/>
                     </div>
                  </div>
                  <div className="text-xl font-bold text-primary">{modProg}%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                {modAsgs.length === 0 && (
                  <div className="p-5 md:col-span-2 lg:col-span-3">
                    <p className="mb-3 text-sm text-muted-foreground">No employees are assigned to this module yet.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => openNewAssignment(sm.id)}>
                      <Plus className="size-4"/> Assign employee
                    </Button>
                  </div>
                )}
                {modAsgs.map(asg => {
                  const prof = profiles.find(p => p.user_id === asg.user_id);
                  const asgItems = modItems.filter(w => w.module_assignment_id === asg.id);
                  let aTotal = 0; let aComp = 0;
                  asgItems.forEach(w => { aTotal += (w.weight||10); if(w.status === 'Completed' || w.status === 'completed') aComp += (w.weight||10); });
                  const aProg = aTotal > 0 ? Math.round((aComp/aTotal)*100) : 0;
                  const isDone = aProg === 100;

                  return (
                    <div key={asg.id} className="p-4 sm:p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar url={prof?.avatar_url} name={prof?.full_name}/>
                          <div>
                            <div className="font-semibold text-sm">{prof?.full_name || 'Unknown'}</div>
                            <div className="text-xs font-medium text-muted-foreground mt-1">{asg.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{aProg}%</div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-1 -mt-2">
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => openAssignmentEditor(asg)}>
                          <Pencil className="size-3.5"/> Edit assignment
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeletingAssignment(asg)} aria-label={`Delete ${prof?.full_name || "employee"} assignment`} title="Delete assignment">
                          <Trash2 className="size-4"/>
                        </Button>
                      </div>
                      
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                         <div className={`h-full transition-all ${isDone ? 'bg-green-500' : 'bg-primary'}`} style={{width:`${aProg}%`}}/>
                      </div>

                      <ul className="space-y-2">
                        {asgItems.map(wi => {
                          const isCompleted = wi.status === 'Completed' || wi.status === 'completed';
                          return (
                            <li key={wi.id} className="flex items-start gap-2 rounded-lg border bg-background p-2.5">
                              <button
                                type="button"
                                className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary"
                                onClick={() => toggleWorkItem(wi)}
                                aria-label={isCompleted ? `Mark ${wi.title} incomplete` : `Mark ${wi.title} complete`}
                                title={isCompleted ? "Mark incomplete" : "Mark complete"}
                              >
                                {isCompleted ? <CheckCircle2 className="size-4 text-green-600"/> : <Circle className="size-4"/>}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className={`text-sm font-medium ${isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{wi.title}</div>
                                {wi.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{wi.description}</p>}
                                <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">{wi.priority || "medium"} priority</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => openWorkItemEditor(wi)} aria-label={`Edit ${wi.title}`} title="Edit task">
                                  <Pencil className="size-4"/>
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeletingWorkItem(wi)} aria-label={`Delete ${wi.title}`} title="Delete task">
                                  <Trash2 className="size-4"/>
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                        {asgItems.length === 0 && <li className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No tasks assigned yet.</li>}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* TARGETS & CHECKMARKS (ASLENIX DOCUMENT STYLE) */}
      {targets.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground mb-4">Weekly Targets</h2>
          <div className="grid gap-4">
            {targets.map(tgt => {
              const reqs = requirements.filter(r => r.target_id === tgt.id);
              return (
                <section key={tgt.id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="bg-primary/5 p-4 border-b flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-lg text-primary uppercase tracking-wider">{tgt.name}</h4>
                      <div className="text-xs font-bold text-muted-foreground uppercase mt-1">
                        Target Date: {tgt.target_date ? `${formatNepaliDate(tgt.target_date)} BS` : "Not set"}
                      </div>
                    </div>
                    <div className="px-4 py-1.5 rounded-full border border-primary/30 bg-background shadow-sm text-xs font-black text-primary uppercase tracking-widest">
                      {tgt.status}
                    </div>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left font-black p-4 uppercase tracking-widest text-xs text-muted-foreground w-1/3">Module</th>
                          <th className="text-left font-black p-4 uppercase tracking-widest text-xs text-muted-foreground">Required Assignments</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {sprintModules.map(sm => {
                          const mod = modules.find(m => m.id === sm.module_id);
                          const asgs = assignments.filter(a => a.sprint_module_id === sm.id);
                          // For visual purpose matching the user prompt table Checkmarks
                          return (
                            <tr key={sm.id}>
                              <td className="p-4 font-bold border-r">{mod?.name}</td>
                              <td className="p-4 flex flex-wrap gap-4">
                                {asgs.map(a => {
                                  const asgItems = workItems.filter(w => w.module_assignment_id === a.id);
                                  const allDone = asgItems.length > 0 && asgItems.every(w => w.status === 'Completed' || w.status === 'completed');
                                  return (
                                    <div key={a.id} className="flex items-center gap-2 bg-background border px-3 py-1.5 rounded-full shadow-sm">
                                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{a.role}</span>
                                      {allDone ? <CheckCircle2 className="size-4 text-green-500" /> : <div className="size-4 rounded-full border-2 border-muted-foreground/20"/>}
                                    </div>
                                  )
                                })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {/* DETAILED TABLE */}
      {assignments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground mb-4">Employee Assignment Table</h2>
          <div className="overflow-hidden overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Employee</th>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Role</th>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Module</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Items</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Completed</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Progress</th>
                  <th className="text-right p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {assignments.map(a => {
                  const prof = profiles.find(p => p.user_id === a.user_id);
                  const sm = sprintModules.find(s => s.id === a.sprint_module_id);
                  const mod = modules.find(m => m.id === sm?.module_id);
                  const items = workItems.filter(w => w.module_assignment_id === a.id);
                  const comp = items.filter(w => w.status === 'Completed' || w.status === 'completed').length;
                  let tW = 0; let cW = 0;
                  items.forEach(w => { tW += w.weight||10; if(w.status === 'Completed' || w.status === 'completed') cW += w.weight||10; });
                  const prog = tW > 0 ? Math.round((cW/tW)*100) : 0;
                  return (
                    <tr key={a.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-bold flex items-center gap-3">
                        <Avatar url={prof?.avatar_url} name={prof?.full_name} size="sm"/>
                        {prof?.full_name}
                      </td>
                      <td className="p-4 font-semibold text-primary">{a.role}</td>
                      <td className="p-4 font-medium">{mod?.name}</td>
                      <td className="p-4 text-center font-bold text-muted-foreground">{items.length}</td>
                      <td className="p-4 text-center font-bold text-muted-foreground">{comp}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{width:`${prog}%`}}/>
                          </div>
                          <span className="text-xs font-black w-8">{prog}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => openAssignmentEditor(a)} aria-label={`Edit ${prof?.full_name || "employee"} assignment`} title="Edit assignment">
                            <Pencil className="size-4"/>
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeletingAssignment(a)} aria-label={`Delete ${prof?.full_name || "employee"} assignment`} title="Delete assignment">
                            <Trash2 className="size-4"/>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <WeeklySprintWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen} 
        project={selectedProject} 
        profiles={profiles} 
        onSaved={() => setRefreshKey(k => k + 1)}
      />
      <Dialog open={weekEditorOpen} onOpenChange={setWeekEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit week {selectedSprint?.week_number}</DialogTitle>
            <DialogDescription>Update the schedule and goal for this week. Existing assignments and progress will be kept.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="week-number">Week number</Label>
              <Input id="week-number" type="number" min="1" value={weekNumber} onChange={event => setWeekNumber(event.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="week-start">Start date</Label>
                <ADStoredBSDateInput id="week-start" value={weekStartDate} onChange={setWeekStartDate} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="week-end">End date</Label>
                <ADStoredBSDateInput id="week-end" value={weekEndDate} onChange={setWeekEndDate} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="week-target">Target date</Label>
              <ADStoredBSDateInput id="week-target" value={weekTargetDate} onChange={setWeekTargetDate} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="week-goal">Week goal</Label>
              <Textarea id="week-goal" value={weekGoal} onChange={event => setWeekGoal(event.target.value)} rows={3} className="resize-y" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWeekEditorOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveWeek} disabled={savingWeek}>{savingWeek ? "Saving..." : "Save week"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={assignmentEditorOpen} onOpenChange={open => {
        setAssignmentEditorOpen(open);
        if (!open) setEditingAssignment(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? "Edit employee assignment" : "Assign an employee"}</DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? "Change the employee, role, or workload for this module assignment."
                : `Add an employee to ${modules.find(module => module.id === sprintModules.find(item => item.id === assignmentModuleId)?.module_id)?.name || "this module"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={assignmentUserId} onValueChange={setAssignmentUserId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(profile => (
                    <SelectItem key={profile.user_id} value={profile.user_id}>{profile.full_name || "Unnamed employee"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment-role">Role</Label>
              <Input id="assignment-role" value={assignmentRole} onChange={event => setAssignmentRole(event.target.value)} maxLength={100} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="assignment-weight">Assignment weight</Label>
              <Input id="assignment-weight" type="number" min="1" value={assignmentWeight} onChange={event => setAssignmentWeight(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignmentEditorOpen(false)}>Cancel</Button>
            <Button type="button" onClick={saveAssignment} disabled={savingAssignment}>{savingAssignment ? "Saving..." : editingAssignment ? "Save assignment" : "Assign employee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editingWorkItem)} onOpenChange={(open) => !open && setEditingWorkItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update the task details or change its employee assignment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="task-title">Task title</Label>
              <Input id="task-title" value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={160} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} className="resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-weight">Weight</Label>
                <Input id="task-weight" type="number" min="1" value={editWeight} onChange={e => setEditWeight(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Assigned employee</Label>
              <Select value={editAssignmentId} onValueChange={setEditAssignmentId}>
                <SelectTrigger><SelectValue placeholder="Select assignment" /></SelectTrigger>
                <SelectContent>
                  {assignments.map(assignment => {
                    const profile = profiles.find(person => person.user_id === assignment.user_id);
                    const sprintModule = sprintModules.find(item => item.id === assignment.sprint_module_id);
                    const module = modules.find(item => item.id === sprintModule?.module_id);
                    return (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {profile?.full_name || "Unknown employee"} · {assignment.role} · {module?.name || "Module"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingWorkItem(null)}>Cancel</Button>
            <Button type="button" onClick={saveWorkItem} disabled={savingWorkItem}>{savingWorkItem ? "Saving..." : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deletingWorkItem)} onOpenChange={(open) => !open && !deleting && setDeletingWorkItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingWorkItem?.title}” will be permanently removed from its employee assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void deleteWorkItem(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(deletingAssignment)} onOpenChange={open => !open && !deletingAssignmentBusy && setDeletingAssignment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this employee assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {profiles.find(profile => profile.user_id === deletingAssignment?.user_id)?.full_name || "this employee"} from the module and permanently deletes their tasks and target requirements for this assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAssignmentBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={event => { event.preventDefault(); void deleteAssignment(); }} disabled={deletingAssignmentBusy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingAssignmentBusy ? "Deleting..." : "Delete assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={weekDeleteOpen} onOpenChange={open => !open && !deletingWeek && setWeekDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete week {selectedSprint?.week_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the week, its teams, employee assignments, tasks, and weekly targets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingWeek}>Keep week</AlertDialogCancel>
            <AlertDialogAction onClick={event => { event.preventDefault(); void deleteWeek(); }} disabled={deletingWeek} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingWeek ? "Deleting..." : "Delete week"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WeeklySprintReport
        open={reportOpen}
        onOpenChange={setReportOpen}
        sprint={selectedSprint}
        project={selectedProject}
        teams={teams}
        teamMembers={teamMembers}
        sprintModules={sprintModules}
        modules={modules}
        assignments={assignments}
        workItems={workItems}
        targets={targets}
        requirements={requirements}
        profiles={profiles}
      />

    </div>
  );
}
