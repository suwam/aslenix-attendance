import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, CheckCircle2 } from 'lucide-react';
import { formatNepaliDate } from '@/lib/nepali-calendar';

export function WeeklySprintReport({ open, onOpenChange, sprint, project, teams, teamMembers, sprintModules, modules, assignments, workItems, targets, requirements, profiles }: any) {
  
  const handlePrint = () => {
    window.print();
  };

  if (!sprint || !project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] border-none shadow-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="p-6 bg-muted/30 border-b flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-xl font-bold">Weekly Sprint Report</DialogTitle>
          <Button onClick={handlePrint} className="rounded-xl shadow-sm print:hidden">
            <Printer className="size-4 mr-2"/> Print Report
          </Button>
        </DialogHeader>
        
        <div className="p-10 overflow-y-auto bg-white text-black print:p-0 print:w-full" id="printable-report">
          <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h1 className="text-2xl font-black uppercase tracking-widest">Aslenix Tech & Solution</h1>
            <p className="text-sm font-bold mt-2 uppercase text-gray-600">Weekly Assignment Report</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8 text-sm font-medium">
            <div>
              <div className="text-gray-500 uppercase text-xs font-bold tracking-widest">Project</div>
              <div className="text-lg font-black">{project.name}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500 uppercase text-xs font-bold tracking-widest">Week</div>
              <div className="text-lg font-black">
                Week {sprint.week_number} — {sprint.start_date ? `${formatNepaliDate(sprint.start_date)} BS` : "No start date"} to {sprint.end_date ? `${formatNepaliDate(sprint.end_date)} BS` : "No end date"}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-gray-500 uppercase text-xs font-bold tracking-widest">Teams</div>
              <div className="font-bold">
                {teams.map((t:any) => {
                   const members = teamMembers.filter((tm:any) => tm.team_id === t.id).map((tm:any) => {
                     const p = profiles.find((pr:any) => pr.user_id === tm.user_id);
                     return `${p?.full_name} (${tm.role})`;
                   }).join(", ");
                   return `${t.name}: ${members}`;
                }).join(" | ")}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-black uppercase tracking-widest mb-4 border-b border-gray-300 pb-2">Assigned Modules & Work Items</h2>
            <div className="space-y-6">
              {sprintModules.map((sm:any) => {
                const mod = modules.find((m:any) => m.id === sm.module_id);
                const asgs = assignments.filter((a:any) => a.sprint_module_id === sm.id);
                
                return (
                  <div key={sm.id} className="border border-gray-300 rounded-lg p-4">
                    <h3 className="font-black text-lg mb-3">{mod?.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {asgs.map((a:any) => {
                        const prof = profiles.find((p:any) => p.user_id === a.user_id);
                        const items = workItems.filter((w:any) => w.module_assignment_id === a.id);
                        let cW = 0; let tW = 0;
                        items.forEach((w:any) => { tW += (w.weight||10); if (w.status === 'Completed' || w.status === 'completed') cW += (w.weight||10); });
                        const prog = tW > 0 ? Math.round((cW/tW)*100) : 0;

                        return (
                          <div key={a.id} className="space-y-2">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                              <span className="font-bold text-sm">{prof?.full_name} <span className="text-gray-500 text-xs font-normal">({a.role})</span></span>
                              <span className="font-black text-sm">{prog}%</span>
                            </div>
                            <ul className="text-sm space-y-1">
                              {items.map((wi:any) => (
                                <li key={wi.id} className="flex items-start gap-2">
                                  <span className="mt-0.5">{wi.status === 'Completed' || wi.status === 'completed' ? '✓' : '•'}</span>
                                  <span className={wi.status === 'Completed' || wi.status === 'completed' ? 'text-gray-500 line-through' : 'text-black'}>{wi.title}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-black uppercase tracking-widest mb-4 border-b border-gray-300 pb-2">Weekly Targets</h2>
            <div className="space-y-4">
              {targets.map((tgt:any) => (
                <div key={tgt.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-black text-lg">{tgt.name}</div>
                    <div className="font-bold text-sm text-gray-500">
                      By {tgt.target_date ? `${formatNepaliDate(tgt.target_date)} BS` : "No target date"}
                    </div>
                  </div>
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Module</th>
                        <th className="border border-gray-300 p-2 text-left">Required Assignments</th>
                        <th className="border border-gray-300 p-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sprintModules.map((sm:any) => {
                        const mod = modules.find((m:any) => m.id === sm.module_id);
                        const asgs = assignments.filter((a:any) => a.sprint_module_id === sm.id);
                        let allModDone = true;

                        return (
                          <tr key={sm.id}>
                            <td className="border border-gray-300 p-2 font-bold">{mod?.name}</td>
                            <td className="border border-gray-300 p-2">
                              <div className="flex flex-wrap gap-3">
                                {asgs.map((a:any) => {
                                  const asgItems = workItems.filter((w:any) => w.module_assignment_id === a.id);
                                  const asgDone = asgItems.length > 0 && asgItems.every((w:any) => w.status === 'Completed' || w.status === 'completed');
                                  if (!asgDone) allModDone = false;
                                  return (
                                    <span key={a.id} className="font-medium flex items-center gap-1">
                                      {a.role} {asgDone ? '✓' : ''}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                            <td className="border border-gray-300 p-2 text-center font-bold">
                              {allModDone ? 'Completed' : 'Pending'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden; }
              #printable-report, #printable-report * { visibility: visible; }
              #printable-report { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
            }
          `}} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
