import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Gauge,
  ChevronLeft,
  ChevronRight,
  FolderDot,
  Briefcase,
} from "lucide-react";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { STATUS_LABELS } from "@/lib/tasks-utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/admin/tasks")({ component: AdminTasks });

type Project = Database["public"]["Tables"]["projects"]["Row"];
type Sprint = Database["public"]["Tables"]["project_sprints"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function AdminTasks() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("");

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [refreshKey, setRefreshKey] = useState(0);

  // Modals
  const [addAssignmentOpen, setAddAssignmentOpen] = useState(false);
  const [addSprintOpen, setAddSprintOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  useEffect(() => {
    const fetchInitial = async () => {
      const { data: projData } = await supabase.from("projects").select("*").order("created_at");
      setProjects(projData || []);
      
      const { data: profData } = await supabase.from("profiles").select("*").eq("approval_status", "approved").order("full_name");
      setProfiles(profData || []);

      if (projData && projData.length > 0) {
        setSelectedProjectId(projData[0].id);
      }
    };
    fetchInitial();
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchProjectData = async () => {
      const { data: sprintData } = await supabase
        .from("project_sprints")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("created_at");
      setSprints(sprintData || []);

      if (sprintData && sprintData.length > 0) {
        if (!selectedSprintId || !sprintData.find((s) => s.id === selectedSprintId)) {
           setSelectedSprintId(sprintData[sprintData.length - 1].id);
        }
      } else {
        setSelectedSprintId("");
      }

      const { data: taskData } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", selectedProjectId);
      setTasks(taskData || []);
    };
    fetchProjectData();
  }, [selectedProjectId, refreshKey]);

  // Derived data
  const projectTasks = useMemo(() => tasks, [tasks]);
  
  const overallProgress = useMemo(() => {
    let totalWeight = 0;
    let completedWeight = 0;
    projectTasks.forEach((t) => {
      const w = t.weight || 1;
      totalWeight += w;
      if (t.status === "completed") {
        completedWeight += w;
      }
    });
    return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  }, [projectTasks]);

  const teamMemberIds = useMemo(() => {
    const ids = new Set<string>();
    projectTasks.forEach(t => {
      if (t.assigned_to) ids.add(t.assigned_to);
    });
    return Array.from(ids);
  }, [projectTasks]);

  const selectedSprintIndex = sprints.findIndex((s) => s.id === selectedSprintId);
  const selectedSprint = sprints[selectedSprintIndex];
  const weeklyTasks = useMemo(() => projectTasks.filter((t) => t.sprint_id === selectedSprintId).sort((a,b) => +new Date(b.created_at) - +new Date(a.created_at)), [projectTasks, selectedSprintId]);

  const weeklyProgress = useMemo(() => {
    if (weeklyTasks.length === 0) return 0;
    const completed = weeklyTasks.filter((t) => t.status === "completed").length;
    return Math.round((completed / weeklyTasks.length) * 100);
  }, [weeklyTasks]);

  const weeklyStats = {
    total: weeklyTasks.length,
    completed: weeklyTasks.filter((t) => t.status === "completed").length,
    inProgress: weeklyTasks.filter((t) => t.status === "in_progress").length,
    review: weeklyTasks.filter((t) => t.status === "review" || t.status === "verified").length,
    blocked: weeklyTasks.filter((t) => t.status === "blocked").length,
    waiting: weeklyTasks.filter((t) => t.status === "waiting" || t.status === "todo").length,
  };

  const chartData = sprints.map(sprint => {
    const sTasks = projectTasks.filter(t => t.sprint_id === sprint.id);
    const completed = sTasks.filter(t => t.status === "completed").length;
    const progress = sTasks.length > 0 ? Math.round((completed / sTasks.length) * 100) : 0;
    return {
      name: sprint.name,
      progress,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">Weekly Sprint Summary</h1>
          </div>
          <p className="text-muted-foreground">Manage project sprints, task distribution, and team progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-background/50 border rounded-2xl p-1 flex items-center shadow-sm">
            <FolderDot className="text-muted-foreground ml-3 mr-2 size-5" />
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[220px] border-none shadow-none bg-transparent focus:ring-0 font-semibold">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="rounded-xl font-bold shadow-sm" onClick={() => setAddProjectOpen(true)}>
             New Project
          </Button>
        </div>
      </div>

      {/* OVERALL PROJECT SUMMARY */}
      {selectedProjectId && (
        <GlassCard className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
          <div className="flex-1 relative z-10">
             <h2 className="text-2xl font-black tracking-tight mb-2">{projects.find(p => p.id === selectedProjectId)?.name}</h2>
             <div className="text-sm font-semibold text-muted-foreground flex flex-wrap items-center gap-3">
               <span className="bg-background/60 px-3 py-1.5 rounded-full border shadow-sm">Team Members: <strong className="text-foreground">{teamMemberIds.length}</strong></span>
               <span className="bg-background/60 px-3 py-1.5 rounded-full border shadow-sm">Total Tasks: <strong className="text-foreground">{projectTasks.length}</strong></span>
               {selectedSprint && <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 shadow-sm">Current: <strong>{selectedSprint.name}</strong></span>}
             </div>
          </div>
          <div className="shrink-0 flex items-center gap-5 relative z-10">
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Overall Project Progress</div>
              <div className="text-4xl font-black text-primary">{overallProgress}%</div>
            </div>
            <div className="w-24 h-24 shrink-0 rounded-full border-[10px] border-primary/10 flex items-center justify-center relative shadow-inner">
               <svg className="absolute inset-0 w-full h-full -rotate-90">
                 <circle cx="50%" cy="50%" r="40%" className="stroke-primary fill-none transition-all duration-1000 ease-out drop-shadow-md" strokeWidth="10%" strokeDasharray={`${overallProgress * 2.51} 300`} strokeLinecap="round" />
               </svg>
            </div>
          </div>
        </GlassCard>
      )}

      {selectedProjectId && sprints.length > 0 ? (
        <>
          {/* WEEK NAVIGATION */}
          <div className="flex flex-wrap items-center justify-between border-b pb-4 mt-8 gap-4">
             <h2 className="text-2xl font-bold tracking-tight">Current Week — {selectedSprint?.name}</h2>
             <div className="flex items-center gap-2 bg-background/40 p-1.5 border rounded-full shadow-sm">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-background shrink-0" disabled={selectedSprintIndex <= 0} onClick={() => setSelectedSprintId(sprints[selectedSprintIndex - 1].id)}>
                  <ChevronLeft className="size-5" />
                </Button>
                <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
                  <SelectTrigger className="w-[150px] border-none shadow-none bg-transparent font-bold text-center focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-background shrink-0" disabled={selectedSprintIndex >= sprints.length - 1} onClick={() => setSelectedSprintId(sprints[selectedSprintIndex + 1].id)}>
                  <ChevronRight className="size-5" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="sm" className="rounded-full font-bold text-primary hover:text-primary hover:bg-primary/10" onClick={() => setAddSprintOpen(true)}>
                  + Add Week
                </Button>
             </div>
          </div>

          {/* SPRINT SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
             <StatCard label="Total Tasks" value={weeklyStats.total} icon={ListTodo} accent="blue" />
             <StatCard label="Completed" value={weeklyStats.completed} icon={CheckCircle2} accent="green" />
             <StatCard label="In Progress" value={weeklyStats.inProgress} icon={Gauge} accent="amber" />
             <StatCard label="Under Review" value={weeklyStats.review} icon={AlertTriangle} accent="amber" />
             <StatCard label="Blocked" value={weeklyStats.blocked} icon={AlertTriangle} accent="red" />
             <StatCard label="Waiting" value={weeklyStats.waiting} icon={Clock3} accent="blue" />
             <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 shadow-sm flex flex-col justify-center transition-all hover:scale-[1.02]">
               <div className="text-3xl font-black text-primary">{weeklyProgress}%</div>
               <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mt-1">Weekly Progress</div>
             </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_300px] gap-6 mt-6">
             {/* TEAM PROGRESS */}
             <GlassCard className="p-0 overflow-hidden flex flex-col">
               <div className="p-5 border-b bg-background/50">
                 <h3 className="font-bold text-lg tracking-tight">Team Progress</h3>
               </div>
               <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto p-2 flex-1">
                 {teamMemberIds.map(uid => {
                   const profile = profiles.find(p => p.user_id === uid);
                   const memberTasks = weeklyTasks.filter(t => t.assigned_to === uid);
                   if (memberTasks.length === 0) return null;
                   const comp = memberTasks.filter(t => t.status === "completed").length;
                   const prog = Math.round((comp / memberTasks.length) * 100);
                   return (
                     <div key={uid} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors rounded-xl m-1">
                        <Avatar url={profile?.avatar_url} name={profile?.full_name} />
                        <div className="flex-1 min-w-0">
                           <div className="font-bold truncate text-[15px]">{profile?.full_name || "Unknown"}</div>
                           <div className="text-xs text-muted-foreground font-medium mt-0.5">{memberTasks.length} assigned — {comp} completed</div>
                        </div>
                        <div className="w-40 flex items-center gap-3">
                           <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden shadow-inner border border-border/50">
                             <div className="h-full bg-primary transition-all duration-500" style={{ width: `${prog}%` }} />
                           </div>
                           <span className="text-sm font-black w-10 text-right">{prog}%</span>
                        </div>
                     </div>
                   )
                 })}
                 {teamMemberIds.length === 0 || weeklyTasks.length === 0 ? (
                   <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
                     <ListTodo className="size-10 mb-3 opacity-20" />
                     No tasks assigned to team members this week.
                   </div>
                 ) : null}
               </div>
             </GlassCard>

             {/* WEEKLY PROGRESS HISTORY */}
             <GlassCard className="flex flex-col">
               <h3 className="font-bold text-lg mb-6 tracking-tight">Weekly Progress History</h3>
               <div className="flex-1 min-h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6, fontWeight: 600 }} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} />
                     <Tooltip 
                       cursor={{fill: 'var(--muted)', opacity: 0.3}}
                       contentStyle={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--background)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ fontWeight: 'bold' }}
                     />
                     <Bar dataKey="progress" radius={[6, 6, 0, 0]} maxBarSize={48}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.name === selectedSprint?.name ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.25)'} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
             </GlassCard>
          </div>

          {/* WEEKLY TASKS LIST */}
          <GlassCard className="mt-6 overflow-hidden p-0">
            <div className="p-5 border-b bg-background/50 flex flex-wrap gap-4 items-center justify-between">
              <h3 className="font-bold text-lg tracking-tight">Weekly Tasks</h3>
              <Button className="rounded-xl shadow-sm font-bold" onClick={() => setAddAssignmentOpen(true)}>
                <Plus className="size-4 mr-1.5" /> Add Assignment
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="font-bold text-left p-4 whitespace-nowrap">Task</th>
                    <th className="font-bold text-left p-4 whitespace-nowrap">Assigned Employee</th>
                    <th className="font-bold text-center p-4 whitespace-nowrap">Priority</th>
                    <th className="font-bold text-center p-4 whitespace-nowrap">Status</th>
                    <th className="font-bold text-center p-4 whitespace-nowrap">Progress</th>
                    <th className="font-bold text-center p-4 whitespace-nowrap">Weight</th>
                    <th className="font-bold text-right p-4 whitespace-nowrap">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {weeklyTasks.map(task => {
                    const assignee = profiles.find(p => p.user_id === task.assigned_to);
                    return (
                      <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-bold max-w-[250px] truncate" title={task.title}>{task.title}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar url={assignee?.avatar_url} name={assignee?.full_name} size="sm" />
                            <span className="truncate font-semibold">{assignee?.full_name || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="p-4 text-center capitalize font-medium">{task.priority}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-foreground/10 text-foreground`}>
                            {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3 justify-center">
                            <div className="w-20 h-2 rounded-full bg-muted overflow-hidden shadow-inner">
                               <div className="h-full bg-primary transition-all" style={{width: `${task.progress || 0}%`}} />
                            </div>
                            <span className="text-[11px] font-bold text-muted-foreground w-8">{task.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-primary/80">{task.weight}%</td>
                        <td className="p-4 text-right text-muted-foreground font-medium whitespace-nowrap">
                          {task.deadline ? formatNepaliDate(task.deadline, "DD MMM YYYY") : "No date"}
                        </td>
                      </tr>
                    )
                  })}
                  {weeklyTasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-muted-foreground">
                         No tasks found for this week. Click <strong className="text-foreground">Add Assignment</strong> to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      ) : selectedProjectId ? (
        <div className="p-12 text-center rounded-3xl border border-dashed mt-8 bg-background/50">
          <FolderDot className="size-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-2xl font-bold mb-2 tracking-tight">No Weeks Found</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Create a week sprint to start assigning tasks to this project and tracking progress.</p>
          <Button onClick={() => setAddSprintOpen(true)} className="rounded-xl font-bold shadow-lg">
            <Plus className="mr-2 size-4" /> Create First Week
          </Button>
        </div>
      ) : (
        <div className="p-12 text-center rounded-3xl border border-dashed mt-8 bg-background/50">
          <Briefcase className="size-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-2xl font-bold mb-2 tracking-tight">No Projects Available</h3>
          <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Create a new project to get started with the sprint system and task management.</p>
          <Button onClick={() => setAddProjectOpen(true)} className="rounded-xl font-bold shadow-lg">
            <Plus className="mr-2 size-4" /> Create Project
          </Button>
        </div>
      )}

      {/* MODALS */}
      <AddAssignmentDialog 
        open={addAssignmentOpen} 
        onOpenChange={setAddAssignmentOpen} 
        projects={projects}
        sprints={sprints}
        profiles={profiles}
        defaultProjectId={selectedProjectId}
        defaultSprintId={selectedSprintId}
        onSaved={() => setRefreshKey(k => k + 1)}
      />

      <AddSprintDialog
        open={addSprintOpen}
        onOpenChange={setAddSprintOpen}
        projectId={selectedProjectId}
        onSaved={() => setRefreshKey(k => k + 1)}
      />

      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onSaved={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}

function Avatar({ url, name, size = "md" }: { url?: string | null, name?: string | null, size?: "sm" | "md" }) {
  const initials = (name || "U").substring(0, 2).toUpperCase();
  const classes = size === "sm" ? "size-6 text-[10px]" : "size-10 text-xs";
  return url ? (
    <img src={url} alt={name || ""} className={`${classes} rounded-full object-cover border`} />
  ) : (
    <div className={`${classes} rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold flex items-center justify-center border border-primary/20 shrink-0`}>
      {initials}
    </div>
  );
}

// Dialogs

function AddAssignmentDialog({ open, onOpenChange, projects, sprints, profiles, defaultProjectId, defaultSprintId, onSaved }: any) {
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [sprintId, setSprintId] = useState(defaultSprintId);
  const [assignedTo, setAssignedTo] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [weight, setWeight] = useState("5");
  const [status, setStatus] = useState("todo");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setProjectId(defaultProjectId);
      setSprintId(defaultSprintId);
      setAssignedTo("");
      setTitle("");
      setDescription("");
      setPriority("medium");
      setWeight("5");
      setStatus("todo");
      setDeadline("");
    }
  }, [open, defaultProjectId, defaultSprintId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !projectId || !sprintId || !assignedTo) return toast.error("Please fill all required fields");
    setLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("tasks").insert({
      title,
      description,
      project_id: projectId,
      sprint_id: sprintId,
      assigned_to: assignedTo,
      priority: priority as any,
      status: status as any,
      weight: Number(weight),
      created_by: userData.user?.id || assignedTo,
      task_complexity: "medium",
      deadline: deadline || null,
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Task assigned successfully");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">Add Assignment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
             <div className="space-y-2">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Project</Label>
               <Select value={projectId} onValueChange={setProjectId} required>
                 <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Project" /></SelectTrigger>
                 <SelectContent>
                   {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Week / Sprint</Label>
               <Select value={sprintId} onValueChange={setSprintId} required>
                 <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Week" /></SelectTrigger>
                 <SelectContent>
                   {sprints.filter((s:any) => s.project_id === projectId).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                 </SelectContent>
               </Select>
             </div>
          </div>
          <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Employee</Label>
             <Select value={assignedTo} onValueChange={setAssignedTo} required>
               <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Employee" /></SelectTrigger>
               <SelectContent>
                 {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
               </SelectContent>
             </Select>
          </div>
          <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Task Title</Label>
             <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Design Login UI" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</Label>
             <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Task details..." className="h-24 rounded-xl resize-none" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="space-y-2 md:col-span-1">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</Label>
               <Select value={priority} onValueChange={setPriority}>
                 <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="low">Low</SelectItem>
                   <SelectItem value="medium">Medium</SelectItem>
                   <SelectItem value="high">High</SelectItem>
                   <SelectItem value="urgent">Urgent</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2 md:col-span-1">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
               <Select value={status} onValueChange={setStatus}>
                 <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="waiting">Waiting</SelectItem>
                   <SelectItem value="todo">Todo</SelectItem>
                   <SelectItem value="in_progress">In Progress</SelectItem>
                   <SelectItem value="review">Review</SelectItem>
                   <SelectItem value="verified">Verified</SelectItem>
                   <SelectItem value="completed">Completed</SelectItem>
                   <SelectItem value="blocked">Blocked</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2 md:col-span-1">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Weight (%)</Label>
               <Input type="number" min="1" max="100" value={weight} onChange={e => setWeight(e.target.value)} required className="h-11 rounded-xl text-center" />
             </div>
             <div className="space-y-2 md:col-span-1">
               <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Due Date</Label>
               <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-11 rounded-xl" />
             </div>
          </div>
          <div className="pt-6 flex justify-end gap-3 border-t">
            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl font-bold shadow-lg">{loading ? "Saving..." : "Save Assignment"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddSprintDialog({ open, onOpenChange, projectId, onSaved }: any) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) return;
    setLoading(true);
    const { error } = await supabase.from("project_sprints").insert({
      name,
      project_id: projectId,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Week sprint created");
      setName("");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold tracking-tight">Create New Week</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
          <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Week Name</Label>
             <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Week 12" className="h-12 rounded-xl text-lg font-medium" />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl font-bold shadow-md">Create Week</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddProjectDialog({ open, onOpenChange, onSaved }: any) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("projects").insert({
      name,
      created_by: user.user?.id || "",
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Project created");
      setName("");
      onSaved();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] border-none shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold tracking-tight">Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
          <div className="space-y-2">
             <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Project Name</Label>
             <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. School ERP" className="h-12 rounded-xl text-lg font-medium" />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading} className="rounded-xl font-bold shadow-md">Create Project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
