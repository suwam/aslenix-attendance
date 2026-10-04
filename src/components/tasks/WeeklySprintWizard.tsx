import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { ADStoredBSDateInput } from '@/components/BSDateInput';

export function WeeklySprintWizard({ open, onOpenChange, project, profiles, onSaved }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // State for the payload
  const [week, setWeek] = useState<any>({ week_number: '', start_date: '', end_date: '', sprint_goal: '', target_date: '' });
  const [team, setTeam] = useState<any>({ name: '' });
  const [modules, setModules] = useState<any[]>([{ name: '', description: '', priority: 'medium', weight: 10 }]);
  const [assignments, setAssignments] = useState<any[]>([]); // { moduleIndex, user_id, role, weight }
  const [workItems, setWorkItems] = useState<any[]>([]); // { assignmentIndex, title, description, weight, priority }
  const [targets, setTargets] = useState<any[]>([{ name: '', target_date: '' }]);
  
  const handleNext = () => setStep(s => Math.min(8, s + 1));
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const addModule = () => setModules([...modules, { name: '', description: '', priority: 'medium', weight: 10 }]);
  const addAssignment = () => setAssignments([...assignments, { moduleIndex: 0, user_id: '', role: '', weight: 50 }]);
  const addWorkItem = () => setWorkItems([...workItems, { assignmentIndex: 0, title: '', description: '', weight: 10, priority: 'medium' }]);

  const handleSave = async () => {
    try {
      setLoading(true);
      // 1. Create Sprint
      const { data: sprintData, error: sprintErr } = await supabase.from('weekly_sprints').insert({
        project_id: project.id,
        week_number: Number(week.week_number),
        start_date: week.start_date || null,
        end_date: week.end_date || null,
        target_date: week.target_date || null,
        sprint_goal: week.sprint_goal
      }).select().single();
      if (sprintErr) throw sprintErr;

      // 2. Create Team
      const { data: teamData, error: teamErr } = await supabase.from('sprint_teams').insert({
        sprint_id: sprintData.id,
        name: team.name
      }).select().single();
      if (teamErr) throw teamErr;

      // 3. Create Team Members (unique users from assignments)
      const uniqueUsers = Array.from(new Set(assignments.map(a => a.user_id)));
      for (const uid of uniqueUsers) {
        if (!uid) continue;
        const role = assignments.find(a => a.user_id === uid)?.role || 'Member';
        await supabase.from('sprint_team_members').insert({
          team_id: teamData.id,
          user_id: uid,
          role: role
        });
      }

      // 4. Create Modules and Sprint Modules
      const moduleMap = new Map(); // local index -> sprint_module.id
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        if (!mod.name) continue;
        
        let moduleId;
        // Check if global project module exists
        const { data: existingMod } = await supabase.from('modules').select('id').eq('project_id', project.id).eq('name', mod.name).maybeSingle();
        if (existingMod) {
          moduleId = existingMod.id;
        } else {
          const { data: newMod, error: modErr } = await supabase.from('modules').insert({
            project_id: project.id,
            name: mod.name,
            description: mod.description
          }).select().single();
          if (modErr) throw modErr;
          moduleId = newMod.id;
        }

        const { data: sprintMod, error: smErr } = await supabase.from('sprint_modules').insert({
          sprint_id: sprintData.id,
          module_id: moduleId,
          team_id: teamData.id,
          priority: mod.priority,
          weight: Number(mod.weight)
        }).select().single();
        if (smErr) throw smErr;
        
        moduleMap.set(i, sprintMod.id);
      }

      // 5. Create Assignments
      const assignmentMap = new Map(); // local index -> assignment.id
      for (let i = 0; i < assignments.length; i++) {
        const asg = assignments[i];
        if (!asg.user_id) continue;
        const sprintModuleId = moduleMap.get(asg.moduleIndex);
        if (!sprintModuleId) continue;
        
        const { data: maData, error: maErr } = await supabase.from('module_assignments').insert({
          sprint_module_id: sprintModuleId,
          user_id: asg.user_id,
          role: asg.role,
          weight: Number(asg.weight)
        }).select().single();
        if (maErr) throw maErr;
        
        assignmentMap.set(i, maData.id);
      }

      // 6. Create Work Items
      if (workItems.length === 0 || !workItems.some(wi => wi.title)) {
        // Auto-generate a work item for each assignment if they skipped this step
        for (const [idx, asgId] of assignmentMap.entries()) {
          const asg = assignments[idx];
          const modName = modules[asg.moduleIndex]?.name || "Module";
          const { error: wiErr } = await supabase.from('work_items').insert({
            module_assignment_id: asgId,
            title: `Complete ${modName} Tasks`,
            description: `Auto-generated task for ${asg.role}`,
            status: 'todo',
            weight: Number(asg.weight) || 10,
            priority: 'medium'
          });
          if (wiErr) console.error("Auto WorkItem Error:", wiErr);
        }
      } else {
        for (let i = 0; i < workItems.length; i++) {
          const wi = workItems[i];
          if (!wi.title) continue;
          const assignmentId = assignmentMap.get(Number(wi.assignmentIndex));
          if (!assignmentId) continue;
  
          const { error: wiErr } = await supabase.from('work_items').insert({
            module_assignment_id: assignmentId,
            title: wi.title,
            description: wi.description,
            status: 'todo',
            weight: Number(wi.weight),
            priority: wi.priority
          });
          if (wiErr) {
            console.error("WorkItem Error:", wiErr);
            throw wiErr;
          }
        }
      }

      // 7. Create Target
      if (targets[0].name) {
        const { data: targetData, error: tgErr } = await supabase.from('weekly_targets').insert({
          sprint_id: sprintData.id,
          name: targets[0].name,
          target_date: targets[0].target_date || sprintData.target_date || null
        }).select().single();
        if (tgErr) throw tgErr;

        // Create requirements for all assignments
        for (const [, asgId] of assignmentMap.entries()) {
          await supabase.from('target_requirements').insert({
            target_id: targetData.id,
            module_assignment_id: asgId,
            completion_condition: 'completed'
          });
        }
      }

      toast.success("Weekly assignment successfully created!");
      setStep(1);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 1: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-xl font-bold">Step 1: Define Week</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Week Number</Label>
              <Input type="number" value={week.week_number} onChange={e => setWeek({...week, week_number: e.target.value})} placeholder="e.g. 2" />
            </div>
            <div className="space-y-2">
              <Label>Sprint Goal</Label>
              <Input value={week.sprint_goal} onChange={e => setWeek({...week, sprint_goal: e.target.value})} placeholder="e.g. Complete Transport Module" />
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <ADStoredBSDateInput value={week.start_date} onChange={value => setWeek({...week, start_date: value})} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <ADStoredBSDateInput value={week.end_date} onChange={value => setWeek({...week, end_date: value})} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Target Date (Deadline)</Label>
              <ADStoredBSDateInput value={week.target_date} onChange={value => setWeek({...week, target_date: value})} />
            </div>
          </div>
        </div>
      );
      case 2: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-xl font-bold">Step 2: Team / Pair</h3>
          <div className="space-y-2">
            <Label>Team Name</Label>
            <Input value={team.name} onChange={e => setTeam({...team, name: e.target.value})} placeholder="e.g. Pair 1 (Alisha & Anil)" />
          </div>
          <p className="text-sm text-muted-foreground">You will assign specific employees to modules in the next steps.</p>
        </div>
      );
      case 3: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Step 3: Modules</h3>
            <Button onClick={addModule} size="sm" variant="outline"><Plus className="size-4 mr-1"/> Add Module</Button>
          </div>
          {modules.map((m, i) => (
            <div key={i} className="p-4 border rounded-xl space-y-4 bg-muted/20 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => setModules(modules.filter((_, idx) => idx !== i))}><Trash2 className="size-4"/></Button>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Module Name</Label>
                  <Input value={m.name} onChange={e => { const nm = [...modules]; nm[i].name = e.target.value; setModules(nm); }} placeholder="e.g. Transport Management" />
                </div>
                <div className="space-y-2">
                  <Label>Weight (% of project)</Label>
                  <Input type="number" value={m.weight} onChange={e => { const nm = [...modules]; nm[i].weight = e.target.value; setModules(nm); }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
      case 4: 
      case 5: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Step 4 & 5: Employee Roles</h3>
            <Button onClick={addAssignment} size="sm" variant="outline"><Plus className="size-4 mr-1"/> Add Assignment</Button>
          </div>
          {assignments.map((a, i) => (
            <div key={i} className="p-4 border rounded-xl space-y-4 bg-muted/20 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => setAssignments(assignments.filter((_, idx) => idx !== i))}><Trash2 className="size-4"/></Button>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Module</Label>
                  <Select value={a.moduleIndex.toString()} onValueChange={v => { const na = [...assignments]; na[i].moduleIndex = Number(v); setAssignments(na); }}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {modules.map((m, idx) => <SelectItem key={idx} value={idx.toString()}>{m.name || `Module ${idx+1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={a.user_id} onValueChange={v => { const na = [...assignments]; na[i].user_id = v; setAssignments(na); }}>
                    <SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p:any) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input value={a.role} onChange={e => { const na = [...assignments]; na[i].role = e.target.value; setAssignments(na); }} placeholder="e.g. Backend" />
                </div>
                <div className="space-y-2">
                  <Label>Weight (% of module)</Label>
                  <Input type="number" value={a.weight} onChange={e => { const na = [...assignments]; na[i].weight = e.target.value; setAssignments(na); }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
      case 6: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="flex items-center justify-between sticky top-0 bg-background py-2 z-10">
            <h3 className="text-xl font-bold">Step 6: Work Items</h3>
            <Button onClick={addWorkItem} size="sm" variant="outline"><Plus className="size-4 mr-1"/> Add Item</Button>
          </div>
          {workItems.map((w, i) => (
            <div key={i} className="p-4 border rounded-xl space-y-4 bg-muted/20 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={() => setWorkItems(workItems.filter((_, idx) => idx !== i))}><Trash2 className="size-4"/></Button>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Assignment (Module & Role)</Label>
                  <Select value={w.assignmentIndex.toString()} onValueChange={v => { const nw = [...workItems]; nw[i].assignmentIndex = Number(v); setWorkItems(nw); }}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {assignments.map((a, idx) => {
                        const m = modules[a.moduleIndex]?.name;
                        const p = profiles.find((pr:any) => pr.user_id === a.user_id)?.full_name;
                        return <SelectItem key={idx} value={idx.toString()}>{m} - {p} ({a.role})</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Item Title</Label>
                  <Input value={w.title} onChange={e => { const nw = [...workItems]; nw[i].title = e.target.value; setWorkItems(nw); }} placeholder="e.g. Create transport API" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
      case 7: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <h3 className="text-xl font-bold">Step 7: Set Target</h3>
          <div className="space-y-2">
            <Label>Target Name</Label>
            <Input value={targets[0].name} onChange={e => setTargets([{...targets[0], name: e.target.value}])} placeholder="e.g. Part 1 Target completed" />
          </div>
          <div className="space-y-2">
            <Label>Target Date</Label>
            <ADStoredBSDateInput value={targets[0].target_date} onChange={value => setTargets([{...targets[0], target_date: value}])} />
          </div>
          <div className="p-4 border rounded-xl bg-primary/10 mt-4">
            <p className="text-sm font-semibold text-primary">This target will require all assigned modules and roles to be marked completed before it turns green.</p>
          </div>
        </div>
      );
      case 8: return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 text-center py-8">
          <h3 className="text-2xl font-black mb-2">Ready to Save!</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">You have defined {modules.length} modules, {assignments.length} assignments, and {workItems.length} work items for Week {week.week_number}. This will be permanently saved to the project.</p>
          <Button size="lg" onClick={handleSave} disabled={loading} className="rounded-xl font-bold shadow-xl px-12">
            {loading ? "Saving to Database..." : "Save Weekly Assignment"}
          </Button>
        </div>
      )
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 bg-muted/30 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">{step}</span>
            Create Weekly Assignment
          </DialogTitle>
        </DialogHeader>
        <div className="p-6 min-h-[400px]">
          {renderStep()}
        </div>
        <div className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button variant="ghost" onClick={handlePrev} disabled={step === 1 || loading} className="rounded-xl"><ChevronLeft className="size-4 mr-1"/> Back</Button>
          <div className="flex gap-1">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className={`h-2 rounded-full transition-all ${step >= i ? 'w-6 bg-primary' : 'w-2 bg-border'}`} />
            ))}
          </div>
          {step < 8 ? (
            <Button onClick={handleNext} className="rounded-xl">Next <ChevronRight className="size-4 ml-1"/></Button>
          ) : (
            <div className="w-20" /> // spacer
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
