import { useMemo, useState } from "react";
import {
  CalendarDays,
  Circle,
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
    <article className="min-w-0 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
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
            Filter tasks by module, employee, role, status, or progress.
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
  moduleFilter,
  setModuleFilter,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: BoardTask[];
  modules: { id: string; name: string }[];
  moduleFilter: string;
  setModuleFilter: (value: string) => void;
  onEdit: (task: BoardTask) => void;
  onDelete: (task: BoardTask) => void;
  onStatusChange: (task: BoardTask, status: BoardStatus) => void;
}) {
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [detailsTask, setDetailsTask] = useState<BoardTask | null>(null);

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
                onOpen={setDetailsTask}
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
                      onClick={() => setDetailsTask(task)}
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
                        onClick={() => setDetailsTask(task)}
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

      <Dialog open={Boolean(detailsTask)} onOpenChange={(open) => !open && setDetailsTask(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words">{detailsTask?.title}</DialogTitle>
            <DialogDescription>Assignment details and current progress.</DialogDescription>
          </DialogHeader>
          {detailsTask && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Assigned employees
                </div>
                <div className="space-y-2">
                  {detailsTask.employees.map((employee) => (
                    <div
                      key={employee.userId}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      {employee.avatarUrl ? (
                        <img
                          src={employee.avatarUrl}
                          alt=""
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
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
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Module</div>
                  <div className="mt-1 font-medium">{detailsTask.moduleName}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Due date</div>
                  <div className="mt-1 font-medium">
                    {detailsTask.dueDate
                      ? `${formatNepaliDate(detailsTask.dueDate)} BS`
                      : "Not set"}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Priority</div>
                  <div className="mt-1 font-medium capitalize">
                    {detailsTask.priority || "medium"}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <StatusBadge status={detailsTask.status} />
                  </div>
                </div>
              </div>
              <div>
                {detailsTask.description && (
                  <div className="mb-4">
                    <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                      Description
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {detailsTask.description}
                    </p>
                  </div>
                )}
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  Progress · {detailsTask.progress}%
                </div>
                <ProgressIndicator progress={detailsTask.progress} />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground">Note</div>
                <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                  {detailsTask.notes || "No note added yet."}
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
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
