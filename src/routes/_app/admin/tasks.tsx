import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ADStoredBSDateInput } from "@/components/BSDateInput";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { useAuth } from "@/lib/auth-context";
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
  Pencil,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { WeeklySprintWizard } from "@/components/tasks/WeeklySprintWizard";
import { WeeklySprintReport } from "@/components/tasks/WeeklySprintReport";
import { ModuleHeader, TaskBoard, type BoardTask } from "@/components/tasks/TaskBoard";
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
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [boardModuleFilter, setBoardModuleFilter] = useState("all");
  
  // Drill-down data
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [sprintModules, setSprintModules] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [workItems, setWorkItems] = useState<any[]>([]);
  const [workItemAssignees, setWorkItemAssignees] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
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
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
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
  const [savingModule, setSavingModule] = useState(false);
  const [deletingWeek, setDeletingWeek] = useState(false);
  const [assignmentTableOpen, setAssignmentTableOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [newModuleDescription, setNewModuleDescription] = useState("");
  const [newModulePriority, setNewModulePriority] = useState("medium");
  const [newModuleWeight, setNewModuleWeight] = useState("10");
  const [newModuleTeamId, setNewModuleTeamId] = useState("");

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
      // Guard against cached/legacy duplicate rows: the UI always treats one
      // project + week number as one week, even before a refresh completes.
      const uniqueSprints = Array.from(
        new Map((sData || []).map(sprint => [String(sprint.week_number), sprint])).values(),
      );
      setSprints(uniqueSprints);
      if (uniqueSprints.length) {
        if (!selectedSprintId || !uniqueSprints.find(s => s.id === selectedSprintId)) {
          setSelectedSprintId(uniqueSprints[uniqueSprints.length - 1].id);
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
    if (!selectedSprintId) {
      setBoardModuleFilter("all");
      setTeams([]);
      setTeamMembers([]);
      setSprintModules([]);
      setAssignments([]);
      setWorkItems([]);
      setWorkItemAssignees([]);
      setTargets([]);
      setRequirements([]);
      return;
    }
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
      const sprintWorkItems = wData.data || [];
      setWorkItems(sprintWorkItems);
      if (sprintWorkItems.length) {
        const { data: assigneeData, error: assigneeError } = await supabase
          .from("work_item_assignees")
          .select("*")
          .in("work_item_id", sprintWorkItems.map(item => item.id));
        if (assigneeError) {
          toast.error(`Unable to load task collaborators. ${assigneeError.message}`);
          setWorkItemAssignees([]);
        } else {
          setWorkItemAssignees(assigneeData || []);
        }
      } else {
        setWorkItemAssignees([]);
      }
      setTargets(tgtData.data || []);
      setRequirements(reqData.data || []);
    };
    fetchSprint();
  }, [selectedSprintId, refreshKey]);

  // Derived calculations
  const selectedSprint = sprints.find(s => s.id === selectedSprintId);
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const boardTasks = useMemo<BoardTask[]>(() => workItems.map(workItem => {
    const assignment = assignments.find(item => item.id === workItem.module_assignment_id);
    const sprintModule = sprintModules.find(item => item.id === assignment?.sprint_module_id);
    const module = modules.find(item => item.id === sprintModule?.module_id);
    const profile = profiles.find(item => item.user_id === assignment?.user_id);
    const collaborators = workItemAssignees
      .filter(item => item.work_item_id === workItem.id)
      .map(item => profiles.find(profileItem => profileItem.user_id === item.user_id))
      .filter(Boolean);
    const people = [profile, ...collaborators].filter(
      (person, index, all) => person && all.findIndex(item => item?.user_id === person.user_id) === index,
    );
    return {
      id: workItem.id,
      title: workItem.title || "Untitled task",
      description: workItem.description,
      notes: workItem.notes,
      status: workItem.status || "todo",
      progress: Number(workItem.progress || 0),
      priority: workItem.priority || "medium",
      dueDate: workItem.due_date || selectedSprint?.target_date || null,
      moduleId: module?.id || "",
      moduleName: module?.name || "Unassigned module",
      projectName: selectedProject?.name || "Project",
      assignmentId: assignment?.id || "",
      employees: people.map(person => ({
        userId: person.user_id,
        name: person.full_name || "Unknown employee",
        avatarUrl: person.avatar_url,
        role: person.user_id === assignment?.user_id
          ? assignment.role || ""
          : assignments.find(item =>
              item.user_id === person.user_id &&
              item.sprint_module_id === assignment?.sprint_module_id,
            )?.role || "Collaborator",
      })),
      source: workItem,
    };
  }), [workItems, workItemAssignees, assignments, sprintModules, modules, profiles, selectedSprint, selectedProject]);

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

  const updateBoardTaskStatus = async (task: BoardTask, status: "todo" | "in_progress" | "review" | "completed") => {
    if (status === "completed") {
      if (task.progress === 100 && task.source.review_status === "pending") {
        await approveBoardTask(task);
      } else {
        toast.error("A task must be at 100% and pending review before it can be approved.");
      }
      return;
    }

    const progress = status === "todo" ? 0 : status === "in_progress" ? 40 : 100;
    const reviewStatus = status === "review" ? "pending" : null;
    const { error } = await supabase
      .from("work_items")
      .update({ status, progress, review_status: reviewStatus })
      .eq("id", task.id);
    if (error) {
      toast.error(`Unable to update task status. ${error.message}`);
      return;
    }
    toast.success(`Task moved to ${status.replace("_", " ")}.`);
    setRefreshKey(k => k + 1);
  };

  const updateBoardTaskProgress = async (task: BoardTask, progress: number) => {
    const nextProgress = Math.max(0, Math.min(100, Math.round(progress)));
    const status =
      nextProgress === 100 ? "review" : nextProgress === 0 ? "todo" : "in_progress";

    const { error } = await supabase
      .from("work_items")
      .update({
        status,
        progress: nextProgress,
        review_status: nextProgress === 100 ? "pending" : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error(`Unable to update progress for "${task.title}". ${error.message}`);
      return null;
    }

    toast.success(`"${task.title}" updated to ${nextProgress}% progress.`);
    setRefreshKey((k) => k + 1);
    return status;
  };

  const approveBoardTask = async (task: BoardTask) => {
    if (task.status !== "review" || task.progress !== 100 || task.source.review_status !== "pending") {
      toast.error("Only tasks at 100% with a pending review can be approved.");
      return false;
    }

    const { error } = await supabase
      .from("work_items")
      .update({ status: "completed", review_status: "verified" })
      .eq("id", task.id);
    if (error) {
      toast.error(`Unable to approve "${task.title}". ${error.message}`);
      return false;
    }

    const { error: logError } = await supabase.from("work_item_logs" as any).insert({
      work_item_id: task.id,
      user_id: user?.id,
      old_progress: task.progress,
      new_progress: task.progress,
      old_status: task.status,
      new_status: "completed",
      update_text: "Approved and verified by admin",
    } as any);
    if (logError) {
      toast.error(`Task approved, but the approval could not be added to its work history. ${logError.message}`);
    } else {
      toast.success(`"${task.title}" approved and marked completed.`);
    }
    setRefreshKey((k) => k + 1);
    return true;
  };

  const openWorkItemEditor = (workItem: any) => {
    setEditingWorkItem(workItem);
    setEditTitle(workItem.title || "");
    setEditDescription(workItem.description || "");
    setEditPriority(workItem.priority || "medium");
    setEditWeight(String(workItem.weight ?? 10));
    setEditAssignmentId(workItem.module_assignment_id || "");
    setCollaboratorIds(
      workItemAssignees
        .filter(assignee => assignee.work_item_id === workItem.id)
        .map(assignee => assignee.user_id),
    );
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
    if (error) {
      setSavingWorkItem(false);
      toast.error(`Unable to save task. ${error.message}`);
      return;
    }

    const primaryUserId = assignments.find(assignment => assignment.id === editAssignmentId)?.user_id;
    const desiredCollaboratorIds = collaboratorIds.filter(userId => userId !== primaryUserId);
    const currentCollaborators = workItemAssignees.filter(
      assignee => assignee.work_item_id === editingWorkItem.id,
    );
    const currentCollaboratorIds = currentCollaborators.map(assignee => assignee.user_id);
    const newCollaboratorIds = desiredCollaboratorIds.filter(userId => !currentCollaboratorIds.includes(userId));
    if (newCollaboratorIds.length) {
      const { error: collaboratorInsertError } = await supabase
        .from("work_item_assignees")
        .insert(newCollaboratorIds.map(userId => ({ work_item_id: editingWorkItem.id, user_id: userId })));
      if (collaboratorInsertError) {
        setSavingWorkItem(false);
        toast.error(`Task updated, but collaborators could not be saved. ${collaboratorInsertError.message}`);
        setRefreshKey(k => k + 1);
        return;
      }
    }
    const removedCollaboratorIds = currentCollaboratorIds.filter(userId => !desiredCollaboratorIds.includes(userId));
    if (removedCollaboratorIds.length) {
      const { error: collaboratorDeleteError } = await supabase
        .from("work_item_assignees")
        .delete()
        .eq("work_item_id", editingWorkItem.id)
        .in("user_id", removedCollaboratorIds);
      if (collaboratorDeleteError) {
        setSavingWorkItem(false);
        toast.error(`Task updated, but some collaborators could not be removed. ${collaboratorDeleteError.message}`);
        setRefreshKey(k => k + 1);
        return;
      }
    }

    setSavingWorkItem(false);
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

  const openNewModule = () => {
    if (!selectedSprint) {
      toast.error("Select a week before adding a module.");
      return;
    }
    if (!teams.length) {
      toast.error("This week needs a team before a module can be added.");
      return;
    }
    setNewModuleName("");
    setNewModuleDescription("");
    setNewModulePriority("medium");
    setNewModuleWeight("10");
    setNewModuleTeamId(teams[0].id);
    setModuleEditorOpen(true);
  };

  const saveNewModule = async () => {
    if (!selectedSprint || !selectedProject) return;
    const name = newModuleName.trim();
    const weight = Number(newModuleWeight);
    if (!name) {
      toast.error("Module name is required.");
      return;
    }
    if (!newModuleTeamId) {
      toast.error("Select the team responsible for this module.");
      return;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error("Module weight must be greater than zero.");
      return;
    }

    setSavingModule(true);
    try {
      let moduleId = modules.find(module => module.name?.trim().toLowerCase() === name.toLowerCase())?.id;
      if (!moduleId) {
        const { data, error } = await supabase
          .from("modules")
          .insert({ project_id: selectedProject.id, name, description: newModuleDescription.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        moduleId = data.id;
      }

      const { data: existing, error: lookupError } = await supabase
        .from("sprint_modules")
        .select("id")
        .eq("sprint_id", selectedSprint.id)
        .eq("module_id", moduleId)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        toast.error("This module is already part of the selected week.");
        return;
      }

      const { error } = await supabase.from("sprint_modules").insert({
        sprint_id: selectedSprint.id,
        module_id: moduleId,
        team_id: newModuleTeamId,
        priority: newModulePriority,
        weight,
        target_date: selectedSprint.target_date || null,
      });
      if (error) throw error;

      toast.success(`Added ${name} to Week ${selectedSprint.week_number}.`);
      setModuleEditorOpen(false);
      setRefreshKey(key => key + 1);
    } catch (error: any) {
      toast.error(`Unable to add module. ${error.message || "Please try again."}`);
    } finally {
      setSavingModule(false);
    }
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
    <div className="min-w-0 space-y-6">
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
          <Button variant="outline" onClick={openNewModule} disabled={!selectedSprint} className="font-medium">
            <Plus className="size-4"/> <span className="hidden sm:inline">Add module</span><span className="sm:hidden">Module</span>
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

      {selectedSprint && sprintModules.length > 0 && (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {sprintModules.map(sprintModule => {
            const moduleAssignments = assignments.filter(assignment => assignment.sprint_module_id === sprintModule.id);
            const assignmentIds = new Set(moduleAssignments.map(assignment => assignment.id));
            const moduleWorkItems = workItems.filter(item => assignmentIds.has(item.module_assignment_id));
            const totalWeight = moduleWorkItems.reduce((total, item) => total + Number(item.weight || 10), 0);
            const completedWeight = moduleWorkItems.reduce(
              (total, item) => total + (item.status === "completed" || item.status === "Completed" ? Number(item.weight || 10) : 0),
              0,
            );
            return (
              <ModuleHeader
                key={sprintModule.id}
                name={modules.find(module => module.id === sprintModule.module_id)?.name || "Unknown module"}
                onSelectModule={() => setBoardModuleFilter(sprintModule.module_id)}
                taskCount={moduleWorkItems.length}
                assignmentCount={moduleAssignments.length}
                employeeCount={new Set(moduleAssignments.map(assignment => assignment.user_id)).size}
                progress={totalWeight ? Math.round(completedWeight / totalWeight * 100) : 0}
                onAddAssignment={() => openNewAssignment(sprintModule.id)}
              />
            );
          })}
        </div>
      )}

      <div className="min-w-0">
        <TaskBoard
          tasks={boardTasks}
          weeks={sprints.map(sprint => ({
            id: sprint.id,
            label: `Week ${sprint.week_number}${sprint.start_date ? ` — ${formatNepaliDate(sprint.start_date)} BS` : ""}`,
          }))}
          selectedWeekId={selectedSprintId}
          onWeekChange={weekId => {
            setSelectedSprintId(weekId);
            setBoardModuleFilter("all");
          }}
          moduleFilter={boardModuleFilter}
          setModuleFilter={setBoardModuleFilter}
          modules={sprintModules.map(sprintModule => ({
            id: sprintModule.module_id,
            name: modules.find(module => module.id === sprintModule.module_id)?.name || "Unknown module",
          })).filter((module, index, all) => all.findIndex(item => item.id === module.id) === index)}
          onEdit={task => openWorkItemEditor(task.source)}
          onDelete={task => setDeletingWorkItem(task.source)}
          onStatusChange={updateBoardTaskStatus}
          onProgressChange={updateBoardTaskProgress}
          onApprove={approveBoardTask}
        />
      </div>

      {/* WEEKLY TARGET SUMMARY */}
      {targets.length > 0 && (
        <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Weekly targets</h2>
              <p className="text-xs text-muted-foreground">Compact progress summary by module.</p>
            </div>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{targets.length} targets</span>
          </div>
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-muted/30 text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Module</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Required assignments</th>
                  <th className="w-36 p-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {targets.flatMap(target => sprintModules.map(sprintModule => {
                  const moduleAssignments = assignments.filter(assignment =>
                    assignment.sprint_module_id === sprintModule.id &&
                    requirements.some(requirement =>
                      requirement.target_id === target.id &&
                      requirement.module_assignment_id === assignment.id,
                    ),
                  );
                  if (moduleAssignments.length === 0) return null;
                  const targetItems = workItems.filter(item =>
                    moduleAssignments.some(assignment => assignment.id === item.module_assignment_id),
                  );
                  const totalWeight = targetItems.reduce((total, item) => total + Number(item.weight || 10), 0);
                  const completedWeight = targetItems.reduce(
                    (total, item) =>
                      total + ((item.status === "completed" || item.status === "Completed") ? Number(item.weight || 10) : 0),
                    0,
                  );
                  const progress = totalWeight ? Math.round(completedWeight / totalWeight * 100) : 0;
                  return (
                    <tr key={`${target.id}-${sprintModule.id}`}>
                      <td className="p-3 font-medium">{modules.find(module => module.id === sprintModule.module_id)?.name || "Unknown module"}</td>
                      <td className="p-3">
                        <div className="font-medium">{target.name}</div>
                        <div className="text-xs text-muted-foreground">{target.target_date ? `${formatNepaliDate(target.target_date)} BS` : "No target date"}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {moduleAssignments.map(assignment => assignment.role).filter(Boolean).join(", ") || `${moduleAssignments.length} assignments`}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-semibold tabular-nums">{progress}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECONDARY EMPLOYEE ASSIGNMENT TABLE */}
      {assignments.length > 0 && (
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Employee assignment details</h2>
              <p className="text-xs text-muted-foreground">Detailed workload and completion overview.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setAssignmentTableOpen(open => !open)}>
              {assignmentTableOpen ? "Hide assignment table" : "View assignment table"}
              <ChevronDown className={`size-4 transition-transform ${assignmentTableOpen ? "rotate-180" : ""}`} />
            </Button>
          </div>
          {assignmentTableOpen && (
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
          )}
        </section>
      )}

      {/* Modals */}
      <Dialog open={moduleEditorOpen} onOpenChange={setModuleEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add module to Week {selectedSprint?.week_number}</DialogTitle>
            <DialogDescription>Create a new module for this selected week without creating another week.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-module-name">Module name</Label>
              <Input id="new-module-name" value={newModuleName} onChange={event => setNewModuleName(event.target.value)} placeholder="e.g. Inventory management" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-module-description">Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea id="new-module-description" value={newModuleDescription} onChange={event => setNewModuleDescription(event.target.value)} placeholder="What this module covers" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label>Responsible team</Label>
                <Select value={newModuleTeamId} onValueChange={setNewModuleTeamId}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-module-weight">Weight</Label>
                <Input id="new-module-weight" type="number" min="1" value={newModuleWeight} onChange={event => setNewModuleWeight(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={newModulePriority} onValueChange={setNewModulePriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModuleEditorOpen(false)} disabled={savingModule}>Cancel</Button>
            <Button type="button" onClick={saveNewModule} disabled={savingModule}>{savingModule ? "Adding..." : "Add module"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <div className="grid gap-2">
              <Label>Working together</Label>
              <p className="text-xs text-muted-foreground">
                Add teammates who share this task. The assigned employee is included automatically.
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                {profiles
                  .filter(profile => profile.user_id !== assignments.find(assignment => assignment.id === editAssignmentId)?.user_id)
                  .map(profile => {
                    const isSelected = collaboratorIds.includes(profile.user_id);
                    return (
                      <label
                        key={profile.user_id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={checked => setCollaboratorIds(current =>
                            checked
                              ? [...new Set([...current, profile.user_id])]
                              : current.filter(userId => userId !== profile.user_id),
                          )}
                        />
                        <span className="truncate">{profile.full_name || "Unnamed employee"}</span>
                      </label>
                    );
                  })}
              </div>
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
