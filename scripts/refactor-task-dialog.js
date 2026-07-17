const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'TaskDialog.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Add Imports
content = content.replace(
  `import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";`,
  `import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";\nimport { TaskAssignees } from "./tasks/TaskAssignees";\nimport { TaskDiscussion } from "./tasks/TaskDiscussion";\nimport { TaskTimeline } from "./tasks/TaskTimeline";\nimport { TaskActivityLog } from "@/lib/tasks-utils";`
);

// 2. Add state for team leads and activity logs
content = content.replace(
  `const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);`,
  `const [employees, setEmployees] = useState<{ user_id: string; full_name: string; role: string }[]>([]);\n  const [teamLeads, setTeamLeads] = useState<string[]>([]);\n  const [availableTeamLeads, setAvailableTeamLeads] = useState<{ user_id: string; full_name: string; role: string }[]>([]);\n  const [activityLogs, setActivityLogs] = useState<TaskActivityLog[]>([]);\n  const [activeTab, setActiveTab] = useState("details");`
);

// Reset form
content = content.replace(
  `setAssignedToMany(isAdmin ? [] : user?.id ? [user.id] : []);`,
  `setAssignedToMany(isAdmin ? [] : user?.id ? [user.id] : []);\n    setTeamLeads([]);\n    setActivityLogs([]);\n    setActiveTab("details");`
);

// 3. loadTask changes
content = content.replace(
  `supabase.from("task_assignees").select("user_id").eq("task_id", taskId),
    ]);`,
  `supabase.from("task_assignees").select("user_id").eq("task_id", taskId),
      supabase.from("task_team_leads").select("user_id").eq("task_id", taskId),
      supabase.from("task_activity_logs").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
    ]);`
);
content = content.replace(
  `const assignees =`,
  `const teamLeadsData = assigneeResult.error ? [] : arguments[0][5]?.data || [];\n    const logsData = assigneeResult.error ? [] : arguments[0][6]?.data || [];\n    setTeamLeads(teamLeadsData.map((t: any) => t.user_id));\n    \n    const assignees =`
);
content = content.replace(
  `const ids = Array.from(`,
  `setActivityLogs(logsData as any);\n    const ids = Array.from(`
);

// We need to inject the fetch for all user roles for team leads
content = content.replace(
  `setEmployees((data || []).filter((employee) => !adminUserIds.has(employee.user_id)));`,
  `const empData = (data || []).map(e => ({ ...e, role: roleRows?.find(r => r.user_id === e.user_id)?.role || 'employee' }));\n        setEmployees(empData.filter(e => !adminUserIds.has(e.user_id)));\n        setAvailableTeamLeads(empData.filter(e => e.role === 'team_lead' || adminUserIds.has(e.user_id)));`
);

// Replace UI layout
const uiStart = content.indexOf('<div className="space-y-4">');
const uiEnd = content.indexOf('<div className="flex justify-between pt-4 border-t border-border">');

if (uiStart !== -1 && uiEnd !== -1) {
  let uiBlock = content.substring(uiStart, uiEnd);
  
  // Extract sections from uiBlock
  // To avoid complex regex, we just replace the wrapper
  let newUiBlock = `<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="discussion">Discussion</TabsTrigger>
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 mt-0">
            ${uiBlock.replace('<div className="space-y-4">', '<div>')}
            
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border border-border bg-muted/10 p-3 rounded-lg">
                  <TaskAssignees 
                    label="Team Leads" 
                    options={availableTeamLeads}
                    selectedIds={teamLeads}
                    onChange={setTeamLeads}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="border border-border bg-muted/10 p-3 rounded-lg">
                  <TaskAssignees 
                    label="Assign To" 
                    options={employees}
                    selectedIds={assignedToMany}
                    onChange={setAssignedToMany}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="discussion" className="h-[500px] mt-0">
            <TaskDiscussion 
              taskId={taskId || ""}
              comments={comments}
              mentionableUsers={[...availableTeamLeads, ...employees]}
              onCommentAdded={loadTask}
              canComment={Boolean(taskId)}
            />
          </TabsContent>
          
          <TabsContent value="timeline" className="h-[500px] overflow-y-auto mt-0">
            <TaskTimeline logs={activityLogs} />
          </TabsContent>
        </Tabs>`;
        
  // Remove the old Assign To and Comments sections from the details tab
  // We'll replace them with empty strings
  newUiBlock = newUiBlock.replace(/\{isAdmin && \(\s*<div>\s*<Label>Assign to(.|\n)*?\s*\)\}/g, '');
  newUiBlock = newUiBlock.replace(/<div className="border-t border-border pt-4">\s*<Label className="mb-2 block">Comments<\/Label>(.|\n)*?<\/div>\s*<\/div>/g, '</div>');
  
  content = content.substring(0, uiStart) + newUiBlock + content.substring(uiEnd);
}

fs.writeFileSync(filePath, content);
console.log("Rewrote TaskDialog.tsx");
