import { TaskActivityLog } from "@/lib/tasks-utils";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Circle, User, PlusCircle, CheckCircle, RefreshCcw, FileText, MessageSquare, AlertCircle } from "lucide-react";

interface TaskTimelineProps {
  logs: TaskActivityLog[];
}

function formatDate(iso: string) {
  try {
    return `${formatNepaliDate(iso, "DD MMM YYYY")} BS, ${format(new Date(iso), "HH:mm")}`;
  } catch (e) {
    return "";
  }
}

function getLogIcon(action: string) {
  switch (action) {
    case 'created':
      return <PlusCircle size={14} className="text-primary" />;
    case 'status_changed':
      return <RefreshCcw size={14} className="text-blue-500" />;
    case 'progress_updated':
      return <CheckCircle size={14} className="text-emerald-500" />;
    case 'assigned':
    case 'team_lead_assigned':
      return <User size={14} className="text-purple-500" />;
    case 'file_uploaded':
      return <FileText size={14} className="text-amber-500" />;
    case 'comment_added':
      return <MessageSquare size={14} className="text-cyan-500" />;
    default:
      return <Circle size={14} className="text-muted-foreground" />;
  }
}

function formatLogMessage(log: TaskActivityLog) {
  const authorName = log.author || "System";
  
  switch (log.action) {
    case 'created':
      return `Task created by ${authorName}.`;
    case 'status_changed':
      return `Status changed to ${log.new_value?.status} by ${authorName}.`;
    case 'progress_updated':
      return `Progress updated from ${log.old_value?.progress || 0}% to ${log.new_value?.progress}% by ${authorName}.`;
    case 'assigned':
      return `Employees assigned by ${authorName}.`;
    case 'team_lead_assigned':
      return `Team Leads assigned by ${authorName}.`;
    case 'file_uploaded':
      return `File uploaded by ${authorName}.`;
    case 'comment_added':
      return `Comment added by ${authorName}.`;
    default:
      return `${log.action} by ${authorName}.`;
  }
}

export function TaskTimeline({ logs }: TaskTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="mb-2 h-8 w-8 opacity-20" />
        <p className="text-sm">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pl-4 pt-2 pb-4">
      <div className="absolute bottom-4 left-[15px] top-4 w-px bg-border/60" />
      
      {logs.map((log) => (
        <div key={log.id} className="relative flex gap-4">
          <div className="absolute -left-[5px] mt-1.5 rounded-full bg-background p-0.5 shadow-sm ring-1 ring-border">
            {getLogIcon(log.action)}
          </div>
          
          <div className="flex-1 ml-4 rounded-xl border border-border/50 bg-background/50 p-3 shadow-sm transition-colors hover:bg-background/80">
            <div className="flex justify-between items-start gap-4">
              <p className="text-sm font-medium leading-relaxed">
                {formatLogMessage(log)}
              </p>
              <time className="text-[10px] whitespace-nowrap text-muted-foreground">
                {formatDate(log.created_at)}
              </time>
            </div>
            
            {/* Display notes if present in progress update */}
            {log.action === 'progress_updated' && log.new_value?.note && (
              <div className="mt-2 rounded-md bg-muted/40 p-2 text-xs italic text-muted-foreground">
                "{log.new_value.note}"
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
