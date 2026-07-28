import { useState, useMemo } from "react";
import { Plus, Search, CheckCircle2, Clock, AlertCircle, PlayCircle, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkAssignmentModal, WorkAssignmentData, TaskAssignmentStatus } from "./WorkAssignmentModal";

interface UserOption {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface TaskAssignmentsProps {
  assignments: WorkAssignmentData[];
  employees: UserOption[];
  onAdd: (data: WorkAssignmentData) => void;
  onUpdate: (data: WorkAssignmentData) => void;
  onRemove: (id: string) => void;
  canEditAny: boolean;
  currentUserId: string;
}

export function TaskAssignments({
  assignments,
  employees,
  onAdd,
  onUpdate,
  onRemove,
  canEditAny,
  currentUserId,
}: TaskAssignmentsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<WorkAssignmentData | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskAssignmentStatus>("all");

  const completed = assignments.filter((a) => a.status === "completed").length;
  const inProgress = assignments.filter((a) => a.status === "in_progress").length;
  const blocked = assignments.filter((a) => a.status === "blocked").length;
  const pending = assignments.length - completed - inProgress - blocked;

  const getStatusDisplay = (status: TaskAssignmentStatus) => {
    switch (status) {
      case "not_started": return { label: "Not Started", icon: <Clock size={14}/>, className: "bg-muted text-muted-foreground" };
      case "in_progress": return { label: "In Progress", icon: <PlayCircle size={14}/>, className: "bg-blue-500/10 text-blue-500" };
      case "under_review": return { label: "Under Review", icon: <AlertCircle size={14}/>, className: "bg-orange-500/10 text-orange-500" };
      case "completed": return { label: "Completed", icon: <CheckCircle2 size={14}/>, className: "bg-green-500/10 text-green-500" };
      case "blocked": return { label: "Blocked", icon: <AlertCircle size={14}/>, className: "bg-destructive/10 text-destructive" };
    }
  };

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (searchQuery) {
        const emp = employees.find(e => e.user_id === a.user_id);
        const matchName = emp?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchResp = a.responsibility.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchName && !matchResp) return false;
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery, employees]);

  const handleEdit = (assignment: WorkAssignmentData) => {
    setEditingData(assignment);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditingData(null);
    setIsModalOpen(true);
  };

  const handleSave = (data: WorkAssignmentData) => {
    if (data.id) {
      onUpdate(data);
    } else {
      onAdd(data);
    }
  };

  const existingResponsibilities = assignments.map(a => a.responsibility);

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border border-border bg-background rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{assignments.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
        </div>
        <div className="border border-border bg-background rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-500">{completed}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Completed</div>
        </div>
        <div className="border border-border bg-background rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-500">{inProgress}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</div>
        </div>
        <div className="border border-border bg-background rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{pending}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Pending</div>
        </div>
        <div className="border border-border bg-background rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-destructive">{blocked}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Blocked</div>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canEditAny && (
          <Button onClick={openNewModal} size="sm" className="h-9 neon-button">
            <Plus size={16} className="mr-2" /> Add Work Assignment
          </Button>
        )}
      </div>

      {/* Assignment Cards */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredAssignments.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            No work assignments found.
          </div>
        ) : (
          filteredAssignments.map((assignment) => {
            const employee = employees.find(e => e.user_id === assignment.user_id);
            const statusDisplay = getStatusDisplay(assignment.status);
            const canEditThis = canEditAny || currentUserId === assignment.user_id;

            return (
              <div key={assignment.id || assignment.responsibility} className="flex flex-col sm:flex-row gap-4 p-4 border border-border bg-muted/10 rounded-lg hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3 w-[250px] shrink-0">
                  <Avatar className="h-10 w-10 border border-primary/20">
                    <AvatarImage src={employee?.avatar_url || ""} />
                    <AvatarFallback>{employee?.full_name?.substring(0, 2).toUpperCase() || "??"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{employee?.full_name || "Unknown User"}</div>
                    <div className="text-xs text-muted-foreground truncate">Assigned Worker</div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="font-semibold text-sm truncate">{assignment.responsibility}</div>
                  {assignment.notes && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{assignment.notes}</div>
                  )}
                </div>

                <div className="flex items-center gap-6 shrink-0 sm:ml-auto">
                  {assignment.due_date && (
                    <div className="text-xs flex flex-col hidden md:flex">
                      <span className="text-muted-foreground uppercase text-[10px] tracking-wider mb-0.5">Due Date</span>
                      <span className="font-medium">{new Date(assignment.due_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  
                  <div className="w-[120px]">
                    <Badge variant="outline" className={`w-full justify-center gap-1.5 ${statusDisplay.className}`}>
                      {statusDisplay.icon} {statusDisplay.label}
                    </Badge>
                  </div>

                  {canEditThis && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(assignment)}>
                          <Edit2 size={14} className="mr-2" /> Edit Assignment
                        </DropdownMenuItem>
                        {canEditAny && (
                          <DropdownMenuItem onClick={() => assignment.id && onRemove(assignment.id)} className="text-destructive focus:text-destructive">
                            <Trash2 size={14} className="mr-2" /> Delete Assignment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <WorkAssignmentModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSave={handleSave}
        initialData={editingData}
        employees={employees}
        existingResponsibilities={existingResponsibilities.filter(r => r !== editingData?.responsibility)}
        canEditCoreFields={canEditAny}
      />
    </div>
  );
}
