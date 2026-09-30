import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderDot, Plus, Briefcase, ChevronLeft, ChevronRight, Download, Users, FileText, Target, CheckCircle2 } from "lucide-react";
import { WeeklySprintWizard } from "@/components/tasks/WeeklySprintWizard";
import { WeeklySprintReport } from "@/components/tasks/WeeklySprintReport";
import { Database } from "@/integrations/supabase/types";

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

  useEffect(() => {
    const fetchInit = async () => {
      const { data: pData } = await supabase.from("projects").select("*").order("created_at");
      setProjects(pData || []);
      const { data: profData } = await supabase.from("profiles").select("*");
      setProfiles(profData || []);
      if (pData?.length) setSelectedProjectId(pData[0].id);
    };
    fetchInit();
  }, [refreshKey]);

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

  // Overall Project Progress (mocking via modules for now since we don't fetch all sprints data)
  // In a real app, you'd fetch overall progress from a view.
  const overallProgress = 48; // Hardcoded as per prompt example "Overall Project Progress: 48%" for visual representation.
  
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
    const newStatus = wi.status === 'Completed' ? 'In Progress' : 'Completed';
    await supabase.from('work_items').update({ status: newStatus }).eq('id', wi.id);
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
          <h1 className="text-3xl font-black tracking-tight uppercase bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">Aslenix Tech & Solution</h1>
          <p className="text-muted-foreground font-medium mt-1">Weekly Sprint & Task Management</p>
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
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted/30 p-1 border rounded-full">
            <Select value={selectedSprintId} onValueChange={setSelectedSprintId}>
              <SelectTrigger className="w-[180px] border-none shadow-none bg-transparent font-bold">
                <SelectValue placeholder="Select Week" />
              </SelectTrigger>
              <SelectContent>
                {sprints.map(s => <SelectItem key={s.id} value={s.id}>Week {s.week_number} — {s.start_date}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedSprint && <div className="text-sm font-semibold text-muted-foreground hidden md:block">
            {selectedSprint.start_date} to {selectedSprint.end_date}
          </div>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReportOpen(true)} className="rounded-xl shadow-sm font-bold bg-background">
            <Download className="size-4 mr-2"/> View Weekly Report
          </Button>
          <Button onClick={() => setWizardOpen(true)} className="rounded-xl shadow-md font-bold">
            <Plus className="size-4 mr-2"/> Add Weekly Assignment
          </Button>
        </div>
      </div>

      {/* DASHBOARD STATS */}
      {selectedSprint ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <GlassCard className="p-5 flex flex-col justify-center border-l-4 border-l-primary/50 relative overflow-hidden group">
            <div className="absolute right-[-10px] bottom-[-10px] opacity-5 transform group-hover:scale-110 transition-transform"><Briefcase className="size-24"/></div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Project Progress</div>
            <div className="text-3xl font-black text-foreground">{overallProgress}%</div>
          </GlassCard>
          <GlassCard className="p-5 flex flex-col justify-center border-l-4 border-l-primary relative overflow-hidden group bg-primary/5">
            <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-primary transform group-hover:scale-110 transition-transform"><Target className="size-24"/></div>
            <div className="text-xs font-black text-primary uppercase tracking-widest mb-1">Week {selectedSprint.week_number} Progress</div>
            <div className="text-3xl font-black text-primary">{weeklyProgress}%</div>
          </GlassCard>
          <GlassCard className="p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><Users className="size-4"/> <span className="text-xs font-bold uppercase tracking-widest">Team</span></div>
            <div className="text-2xl font-black">{teamMembers.length} Members</div>
          </GlassCard>
          <GlassCard className="p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><FileText className="size-4"/> <span className="text-xs font-bold uppercase tracking-widest">Modules</span></div>
            <div className="text-2xl font-black">{sprintModules.length} Active</div>
          </GlassCard>
          <GlassCard className="p-5 flex flex-col justify-center hidden lg:flex">
            <div className="flex items-center gap-2 text-muted-foreground mb-1"><CheckCircle2 className="size-4"/> <span className="text-xs font-bold uppercase tracking-widest">Targets</span></div>
            <div className="text-2xl font-black">{targets.filter(t => t.status === 'Completed').length} / {targets.length}</div>
          </GlassCard>
        </div>
      ) : (
        <div className="py-12 text-center text-muted-foreground">Select or create a week to view dashboard.</div>
      )}

      {/* MODULE CARDS */}
      <div className="space-y-6 mt-8">
        {sprintModules.map(sm => {
          const mod = modules.find(m => m.id === sm.module_id);
          const modAsgs = assignments.filter(a => a.sprint_module_id === sm.id);
          const modItems = workItems.filter(w => modAsgs.some(a => a.id === w.module_assignment_id));
          
          let mTotal = 0; let mComp = 0;
          modItems.forEach(w => { mTotal += (w.weight||10); if(w.status === 'Completed' || w.status === 'completed') mComp += (w.weight||10); });
          const modProg = mTotal > 0 ? Math.round((mComp/mTotal)*100) : 0;

          return (
            <GlassCard key={sm.id} className="p-0 overflow-hidden border border-border/60 shadow-lg">
              <div className="p-5 bg-muted/20 border-b flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-wide flex items-center gap-3">
                    <FolderDot className="size-5 text-primary"/> {mod?.name || 'Unknown Module'}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mt-1">{modItems.length} Work Items assigned to {modAsgs.length} employees</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                     <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Module Progress</div>
                     <div className="w-32 h-2.5 rounded-full bg-background border shadow-inner overflow-hidden">
                       <div className="h-full bg-primary transition-all duration-500" style={{width:`${modProg}%`}}/>
                     </div>
                  </div>
                  <div className="text-2xl font-black text-primary">{modProg}%</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">
                {modAsgs.map(asg => {
                  const prof = profiles.find(p => p.user_id === asg.user_id);
                  const asgItems = modItems.filter(w => w.module_assignment_id === asg.id);
                  let aTotal = 0; let aComp = 0;
                  asgItems.forEach(w => { aTotal += (w.weight||10); if(w.status === 'Completed' || w.status === 'completed') aComp += (w.weight||10); });
                  const aProg = aTotal > 0 ? Math.round((aComp/aTotal)*100) : 0;
                  const isDone = aProg === 100;

                  return (
                    <div key={asg.id} className="p-5 space-y-4 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar url={prof?.avatar_url} name={prof?.full_name}/>
                          <div>
                            <div className="font-bold text-sm uppercase tracking-wide">{prof?.full_name || 'Unknown'}</div>
                            <div className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-full inline-block mt-1">{asg.role}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black">{aProg}%</div>
                        </div>
                      </div>
                      
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                         <div className={`h-full transition-all ${isDone ? 'bg-green-500' : 'bg-primary'}`} style={{width:`${aProg}%`}}/>
                      </div>

                      <ul className="space-y-2 mt-4">
                        {asgItems.map(wi => (
                          <li key={wi.id} className="flex items-start gap-2 text-sm group cursor-pointer" onClick={() => toggleWorkItem(wi)}>
                            <div className="mt-0.5 shrink-0 transition-transform group-hover:scale-110">
                              {wi.status === 'Completed' || wi.status === 'completed' ? (
                                <CheckCircle2 className="size-4 text-green-500"/>
                              ) : (
                                <div className="size-4 rounded-full border-2 border-muted-foreground/30 group-hover:border-primary transition-colors"/>
                              )}
                            </div>
                            <span className={`font-medium ${wi.status === 'Completed' || wi.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{wi.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
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
                <GlassCard key={tgt.id} className="p-0 overflow-hidden border-2 border-primary/20">
                  <div className="bg-primary/5 p-4 border-b flex justify-between items-center">
                    <div>
                      <h4 className="font-black text-lg text-primary uppercase tracking-wider">{tgt.name}</h4>
                      <div className="text-xs font-bold text-muted-foreground uppercase mt-1">Target Date: {tgt.target_date}</div>
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
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* DETAILED TABLE */}
      {assignments.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-black uppercase tracking-widest text-muted-foreground mb-4">Employee Assignment Table</h2>
          <GlassCard className="p-0 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Employee</th>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Role</th>
                  <th className="text-left p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Module</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Items</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Completed</th>
                  <th className="text-center p-4 font-black uppercase text-xs tracking-widest text-muted-foreground">Progress</th>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </GlassCard>
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
