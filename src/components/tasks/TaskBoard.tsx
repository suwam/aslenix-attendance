import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  FolderKanban,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { formatNepaliDate } from "@/lib/nepali-calendar";

export type BoardEmployee = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
};

export type BoardTask = {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status: string;
  progress: number;
  priority: string;
  dueDate: string | null;
  moduleId: string;
  moduleName: string;
  projectName: string;
  assignmentId: string;
  employees: BoardEmployee[];
  source: any;
};

type BoardStatus = "todo" | "in_progress" | "review" | "completed";

const columns: { id: BoardStatus; title: string; marker: string }[] = [
  { id: "todo", title: "To do", marker: "bg-slate-400" },
  { id: "in_progress", title: "In progress", marker: "bg-blue-500" },
  { id: "review", title: "Review", marker: "bg-amber-500" },
  { id: "completed", title: "Completed", marker: "bg-emerald-500" },
];

export function ModuleHeader({
  onSelectModule,
  name,
  taskCount,
  assignmentCount,
  employeeCount,
  progress,
  onAddAssignment,
}: {
  onSelectModule: () => void;
  name: string;
  taskCount: number;
  assignmentCount: number;
  employeeCount: number;
  progress: number;
  onAddAssignment: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <button
        type="button"
        onClick={onSelectModule}
        className="min-w-0 text-left rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View tasks in ${name}`}
      >
        <h2 className="truncate text-sm font-semibold hover:text-primary">{name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {taskCount} tasks · {assignmentCount} assignments · {employeeCount} employees · {progress}
          % overall
        </p>
        <span className="mt-1 block text-[10px] text-primary">View module tasks</span>
      </button>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden w-20 overflow-hidden rounded-full bg-muted sm:block">
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddAssignment}>
          <span aria-hidden="true">+</span> Add assignment
        </Button>
      </div>
    </div>
  );
}

function normalizeStatus(status: string): BoardStatus {
  if (status === "Completed" || status === "completed") return "completed";
  if (status === "In Progress" || status === "in_progress") return "in_progress";
  if (
    status === "review" ||
    status === "under_review" ||
    status === "blocked" ||
    status === "changes_requested"
  )
    return "review";
  return "todo";
}

function statusLabel(status: string) {
  if (status === "blocked") return "Blocked";
  if (status === "changes_requested") return "Changes requested";
  return columns.find((column) => column.id === normalizeStatus(status))?.title || "To do";
}

function statusClasses(status: string) {
  const normalized = normalizeStatus(status);
  if (status === "blocked" || status === "changes_requested") return "bg-rose-50 text-rose-700";
  if (normalized === "in_progress") return "bg-blue-50 text-blue-700";
  if (normalized === "review") return "bg-amber-50 text-amber-700";
  if (normalized === "completed") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

export function EmployeeAvatarGroup({
  employees,
  onClick,
}: {
  employees: BoardEmployee[];
  onClick: () => void;
}) {
  const visible = employees.slice(0, 3);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="flex min-w-0 items-center gap-2 rounded-md text-left hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`View ${employees.length} assigned ${employees.length === 1 ? "employee" : "employees"}`}
    >
      <span className="flex shrink-0 -space-x-2">
        {visible.map((employee) =>
          employee.avatarUrl ? (
            <img
              key={employee.userId}
              src={employee.avatarUrl}
              alt=""
              className="size-7 rounded-full border-2 border-card object-cover"
            />
          ) : (
            <span
              key={employee.userId}
              className="grid size-7 place-items-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-bold text-primary"
            >
              {employee.name.slice(0, 2).toUpperCase()}
            </span>
          ),
        )}
        {employees.length > 3 && (
          <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
            +{employees.length - 3}
          </span>
        )}
      </span>
      <span className="truncate text-xs font-medium text-foreground">
        {employees.length > 3
          ? `${employees.length} employees`
          : employees.map((employee) => employee.name).join(" + ") || "Unassigned"}
      </span>
      {employees.length > 1 && <UsersRound className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[10px] font-semibold ${statusClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function ProgressIndicator({ progress }: { progress: number }) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${safeProgress}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
        {safeProgress}%
      </span>
    </div>
  );
}

function TaskCard({
  task,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: BoardTask;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: BoardStatus) => void;
}) {
  const normalized = normalizeStatus(task.status);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`View progress details for ${task.title}`}
      aria-haspopup="dialog"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="min-w-0 cursor-pointer rounded-xl border bg-card p-3 shadow-sm transition-[box-shadow,border-color] hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left text-sm font-semibold leading-5 text-foreground hover:text-primary"
        >
          <span className="line-clamp-2 break-words">{task.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label={`Actions for ${task.title}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onOpen}>
              <UserRound /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit task
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {columns
              .filter((column) => column.id !== normalized)
              .map((column) => (
                <DropdownMenuItem key={column.id} onSelect={() => onStatusChange(column.id)}>
                  <Circle /> Move to {column.title}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-3 flex min-w-0 items-center gap-2">
        <EmployeeAvatarGroup employees={task.employees} onClick={onOpen} />
        {task.employees[0]?.role && (
          <span className="max-w-24 truncate text-[10px] text-muted-foreground">
            {task.employees[0].role}
          </span>
        )}
      </div>

      <div className="mb-3 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="max-w-[45%] truncate font-medium text-foreground">{task.moduleName}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate">{task.projectName}</span>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-[10px] font-medium text-muted-foreground">Progress</div>
        <ProgressIndicator progress={task.progress} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t pt-2.5">
        <div className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <span className="truncate">
            {task.dueDate ? `Due ${formatNepaliDate(task.dueDate)} BS` : "No due date"}
          </span>
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[9px] font-semibold capitalize ${
            task.priority === "urgent" || task.priority === "high"
              ? "bg-rose-50 text-rose-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {task.priority || "medium"}
        </span>
      </div>
    </article>
  );
}

function KanbanColumn({
  column,
  tasks,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  column: (typeof columns)[number];
  tasks: BoardTask[];
  onOpen: (task: BoardTask) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
  onStatusChange: (task: BoardTask, status: BoardStatus) => void;
}) {
  return (
    <section className="flex min-h-0 min-w-0 max-h-[70dvh] flex-col rounded-xl bg-muted/40 p-2.5 sm:p-3">
      <header className="mb-3 flex shrink-0 items-center justify-between gap-2 px-1">
        <h3 className="flex min-w-0 items-center gap-2 text-xs font-bold uppercase tracking-wide text-foreground">
          <span className={`size-2 shrink-0 rounded-full ${column.marker}`} />
          <span className="truncate">{column.title}</span>
        </h3>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      <div className="grid min-h-0 min-w-0 flex-1 content-start gap-2.5 overflow-y-auto overscroll-y-contain pr-1">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={() => onOpen(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
            onStatusChange={(status) => onStatusChange(task, status)}
          />
        ))}
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed bg-background/70 px-3 py-7 text-center text-xs text-muted-foreground">
            No tasks here
          </div>
        )}
      </div>
    </section>
  );
}

function FilterBar({
  modules,
  weeks,
  selectedWeekId,
  onWeekChange,
  employees,
  roles,
  moduleFilter,
  employeeFilter,
  roleFilter,
  statusFilter,
  progressFilter,
  setModuleFilter,
  setEmployeeFilter,
  setRoleFilter,
  setStatusFilter,
  setProgressFilter,
  view,
  setView,
}: {
  modules: { id: string; name: string }[];
  weeks: { id: string; label: string }[];
  selectedWeekId: string;
  onWeekChange: (weekId: string) => void;
  employees: { id: string; name: string }[];
  roles: string[];
  moduleFilter: string;
  employeeFilter: string;
  roleFilter: string;
  statusFilter: string;
  progressFilter: string;
  setModuleFilter: (value: string) => void;
  setEmployeeFilter: (value: string) => void;
  setRoleFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setProgressFilter: (value: string) => void;
  view: "kanban" | "list";
  setView: (value: "kanban" | "list") => void;
}) {
  const selectClass = "w-full min-w-0 bg-background sm:w-[150px]";

  return (
    <div className="grid min-w-0 gap-3 rounded-xl border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Task board</h2>
          <p className="text-xs text-muted-foreground">
            Filter tasks by week, module, employee, role, status, or progress.
          </p>
        </div>
        <div className="flex shrink-0 rounded-lg border bg-muted/40 p-1">
          <Button
            type="button"
            size="sm"
            variant={view === "kanban" ? "secondary" : "ghost"}
            className="h-8 px-2.5"
            onClick={() => setView("kanban")}
          >
            Kanban
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "list" ? "secondary" : "ghost"}
            className="h-8 px-2.5"
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select value={selectedWeekId} onValueChange={onWeekChange}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((week) => (
              <SelectItem key={week.id} value={week.id}>
                {week.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((module) => (
              <SelectItem key={module.id} value={module.id}>
                {module.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((employee: any) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((role: string) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {columns.map((column) => (
              <SelectItem key={column.id} value={column.id}>
                {column.title}
              </SelectItem>
            ))}
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="changes_requested">Changes requested</SelectItem>
          </SelectContent>
        </Select>
        <Select value={progressFilter} onValueChange={setProgressFilter}>
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="All progress" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All progress</SelectItem>
            <SelectItem value="not_started">Not started</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  modules,
  weeks,
  selectedWeekId,
  onWeekChange,
  moduleFilter,
  setModuleFilter,
  onEdit,
  onDelete,
  onStatusChange,
  onProgressChange,
  onApprove,
}: {
  tasks: BoardTask[];
  modules: { id: string; name: string }[];
  weeks: { id: string; label: string }[];
  selectedWeekId: string;
  onWeekChange: (weekId: string) => void;
  moduleFilter: string;
  setModuleFilter: (value: string) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
  onStatusChange: (task: BoardTask, status: BoardStatus) => void;
  onProgressChange: (task: BoardTask, progress: number) => Promise<string | null>;
  onApprove: (task: BoardTask) => Promise<boolean>;
}) {
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [detailsTask, setDetailsTask] = useState<BoardTask | null>(null);
  const [progressDraft, setProgressDraft] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const priorityStyle = {
    high: "border-rose-200 bg-rose-50 text-rose-700",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-sky-200 bg-sky-50 text-sky-700",
  }[detailsTask?.priority?.toLowerCase() || "medium"] || "border-border bg-muted text-muted-foreground";

  const uniqueWeeks = useMemo(
    () => Array.from(new Map(weeks.map((week) => [week.label, week])).values()),
    [weeks],
  );

  const openTaskDetails = (task: BoardTask) => {
    setDetailsTask(task);
    setProgressDraft(task.progress);
  };

  const saveTaskProgress = async (progress: number) => {
    if (!detailsTask || progress === detailsTask.progress || savingProgress) return;

    setSavingProgress(true);
    const nextStatus = await onProgressChange(detailsTask, progress);
    setSavingProgress(false);
    if (nextStatus === null) {
      setProgressDraft(detailsTask.progress);
      return;
    }

    setDetailsTask({ ...detailsTask, progress, status: nextStatus });
  };

  const employees = useMemo(() => {
    const values = new Map<string, string>();
    tasks.forEach((task) =>
      task.employees.forEach((employee) => values.set(employee.userId, employee.name)),
    );
    return [...values]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const roles = useMemo(
    () =>
      [
        ...new Set(
          tasks.flatMap((task) => task.employees.map((employee) => employee.role).filter(Boolean)),
        ),
      ].sort(),
    [tasks],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (moduleFilter !== "all" && task.moduleId !== moduleFilter) return false;
        if (
          employeeFilter !== "all" &&
          !task.employees.some((employee) => employee.userId === employeeFilter)
        )
          return false;
        if (
          roleFilter !== "all" &&
          !task.employees.some((employee) => employee.role === roleFilter)
        )
          return false;
        if (statusFilter !== "all") {
          if (statusFilter === "blocked" || statusFilter === "changes_requested") {
            if (task.status !== statusFilter) return false;
          } else if (normalizeStatus(task.status) !== statusFilter) return false;
        }
        if (progressFilter === "not_started" && task.progress !== 0) return false;
        if (progressFilter === "in_progress" && (task.progress <= 0 || task.progress >= 100))
          return false;
        if (progressFilter === "complete" && task.progress < 100) return false;
        return true;
      }),
    [tasks, moduleFilter, employeeFilter, roleFilter, statusFilter, progressFilter],
  );

  return (
    <div className="min-w-0 space-y-4">
      <FilterBar
        modules={modules}
        weeks={uniqueWeeks}
        selectedWeekId={selectedWeekId}
        onWeekChange={onWeekChange}
        employees={employees}
        roles={roles}
        moduleFilter={moduleFilter}
        employeeFilter={employeeFilter}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        progressFilter={progressFilter}
        setModuleFilter={setModuleFilter}
        setEmployeeFilter={setEmployeeFilter}
        setRoleFilter={setRoleFilter}
        setStatusFilter={setStatusFilter}
        setProgressFilter={setProgressFilter}
        view={view}
        setView={setView}
      />

      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      {view === "kanban" ? (
        <div
          aria-label="Kanban columns"
          className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2"
          role="region"
          tabIndex={0}
        >
          <div className="grid w-max auto-cols-[minmax(280px,85vw)] grid-flow-col gap-3 sm:w-full sm:min-w-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 xl:min-w-[1080px] xl:grid-cols-4">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={filteredTasks.filter((task) => normalizeStatus(task.status) === column.id)}
                onOpen={openTaskDetails}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Role</th>
                <th className="p-3">Module</th>
                <th className="p-3">Assignment</th>
                <th className="w-36 p-3">Progress</th>
                <th className="p-3">Status</th>
                <th className="p-3">Due date</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-muted/20">
                  <td className="max-w-44 p-3">
                    <EmployeeAvatarGroup
                      employees={task.employees}
                      onClick={() => openTaskDetails(task)}
                    />
                  </td>
                  <td className="p-3 text-muted-foreground">{task.employees[0]?.role || "—"}</td>
                  <td className="max-w-40 truncate p-3">{task.moduleName}</td>
                  <td className="max-w-56 p-3 font-medium">{task.title}</td>
                  <td className="p-3">
                    <ProgressIndicator progress={task.progress} />
                  </td>
                  <td className="p-3">
                    <Select
                      value={normalizeStatus(task.status)}
                      onValueChange={(status: BoardStatus) => onStatusChange(task, status)}
                    >
                      <SelectTrigger className="h-8 w-32 border-0 bg-transparent p-0 shadow-none">
                        <StatusBadge status={task.status} />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem key={column.id} value={column.id}>
                            {column.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {task.dueDate ? `${formatNepaliDate(task.dueDate)} BS` : "—"}
                  </td>
                  <td className="p-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openTaskDetails(task)}
                        aria-label={`View ${task.title}`}
                      >
                        <UserRound className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEdit(task)}
                        aria-label={`Edit ${task.title}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => onDelete(task)}
                        aria-label={`Delete ${task.title}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">
                    No tasks match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={Boolean(detailsTask)}
        onOpenChange={(open) => {
          if (!open && !savingProgress) setDetailsTask(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-1rem)] gap-0 overflow-hidden rounded-[28px] border-border/70 bg-background p-0 shadow-[0_28px_80px_rgba(15,23,42,0.18)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl">
          <DialogHeader className="relative overflow-hidden border-b bg-[radial-gradient(circle_at_88%_10%,oklch(0.62_0.22_270/.15),transparent_30%),linear-gradient(135deg,oklch(0.97_0.02_270),oklch(1_0_0))] px-5 pb-5 pt-5 pr-12 text-left sm:px-7 sm:pb-6 sm:pt-6 sm:pr-14">
            <div className="absolute -right-10 -top-14 size-44 rounded-full bg-primary/5 blur-2xl" />
            <div className="flex items-center justify-between gap-3 pr-1">
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-3.5" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Task overview
                </span>
              </div>
              {detailsTask && <StatusBadge status={detailsTask.status} />}
            </div>
            <DialogTitle className="relative mt-3 max-w-[90%] break-words text-[18px] font-bold leading-[1.28] tracking-tight sm:text-xl">
              {detailsTask?.title}
            </DialogTitle>
            <DialogDescription className="relative mt-2 text-[13px] leading-5">
              Track ownership, delivery progress, and the latest task update.
            </DialogDescription>
            {detailsTask?.projectName && (
              <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-background/75 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <FolderKanban className="size-3 shrink-0 text-primary" />
                <span className="truncate">{detailsTask.projectName}</span>
              </div>
            )}
          </DialogHeader>
          {detailsTask && (
            <div className="max-h-[calc(100dvh-13rem)] space-y-5 overflow-y-auto bg-muted/[0.18] px-5 py-5 sm:px-7">
              <div>
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Assigned employees
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      People responsible for delivery
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {detailsTask.employees.length}{" "}
                    {detailsTask.employees.length === 1 ? "member" : "members"}
                  </span>
                </div>
                <div className="space-y-2">
                  {detailsTask.employees.map((employee) => (
                    <div
                      key={employee.userId}
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      {employee.avatarUrl ? (
                        <img
                          src={employee.avatarUrl}
                          alt=""
                          className="size-10 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {employee.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {employee.role || "Team member"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {detailsTask.employees.length === 0 && (
                    <p className="text-sm text-muted-foreground">No employee assigned.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderKanban className="size-3.5" /> Module
                  </div>
                  <div className="mt-1.5 font-semibold">{detailsTask.moduleName}</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Due date
                  </div>
                  <div className="mt-1.5 font-semibold">
                    {detailsTask.dueDate
                      ? `${formatNepaliDate(detailsTask.dueDate)} BS`
                      : "Not set"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Flag className="size-3.5" /> Priority
                  </div>
                  <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold capitalize ${priorityStyle}`}>
                    {detailsTask.priority || "medium"}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5" /> Status
                  </div>
                  <div className="mt-1.5">
                    <StatusBadge status={detailsTask.status} />
                  </div>
                </div>
              </div>
              <section className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.13] via-primary/[0.05] to-card p-4 shadow-[0_12px_30px_rgba(79,70,229,0.08)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      Task progress
                      <span className="hidden rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                        Live update
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {detailsTask.status === "completed" || detailsTask.status === "Completed"
                        ? "This task is complete."
                        : "Move the slider to save progress for this task."}
                    </p>
                  </div>
                  <span className="rounded-2xl bg-primary px-3 py-2 text-2xl font-black tabular-nums text-primary-foreground shadow-[0_8px_18px_rgba(79,70,229,0.25)]">
                    {progressDraft}%
                  </span>
                </div>
                <Slider
                  aria-label={`Update progress for ${detailsTask.title}`}
                  value={[progressDraft]}
                  onValueChange={([value]) => setProgressDraft(value)}
                  onValueCommit={([value]) => void saveTaskProgress(value)}
                  max={100}
                  step={1}
                  disabled={
                    savingProgress ||
                    detailsTask.status === "completed" ||
                    detailsTask.status === "Completed"
                  }
                  className="py-1"
                />
                <div className="mt-2 flex justify-between text-[10px] font-medium tabular-nums text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
                <div className="mt-3 flex min-h-5 items-center justify-between gap-3 border-t border-primary/10 pt-3 text-xs">
                  <span className="font-medium text-muted-foreground">
                    {progressDraft === 100
                      ? "Ready for review"
                      : progressDraft === 0
                        ? "Not started"
                        : "In progress"}
                  </span>
                  {savingProgress && (
                    <span
                      className="inline-flex items-center gap-1.5 font-medium text-primary"
                      role="status"
                    >
                      <LoaderCircle className="size-3.5 animate-spin" /> Saving update...
                    </span>
                  )}
                </div>
              </section>
              <div>
                {detailsTask.description && (
                  <div className="mb-4">
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Description
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {detailsTask.description}
                    </p>
                  </div>
                )}
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Latest note
                  </div>
                  {detailsTask.notes && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Task update
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap rounded-2xl border border-border/60 bg-card p-3.5 text-sm leading-relaxed text-muted-foreground shadow-sm">
                  {detailsTask.notes || "No note added yet."}
                </p>
              </div>
              <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 border-t border-border/70 bg-background/95 px-5 pb-1 pt-4 backdrop-blur sm:-mx-6 sm:px-6">
                {detailsTask.progress === 100 &&
                  detailsTask.status === "review" &&
                  detailsTask.source?.review_status === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={async () => {
                        if (await onApprove(detailsTask)) setDetailsTask(null);
                      }}
                    >
                      <CheckCircle2 className="size-4" /> Approve & complete
                    </Button>
                  )}
                <Button
                  type="button"
                  className="shadow-sm"
                  onClick={() => {
                    onEdit(detailsTask);
                    setDetailsTask(null);
                  }}
                >
                  <Pencil className="size-4" /> Edit task
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
