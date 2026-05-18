export type Role = "employee" | "manager" | "admin";

export type TaskStatus = "todo" | "in_progress" | "ready_for_review" | "approved" | "completed";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type UserSummary = {
  _id: string;
  name: string;
  email: string;
  role: Role;
};

export type Task = {
  _id: string;
  taskCode: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  progressUpdates: ProgressUpdateNote[];
  deadline: string | null;
  assignedTo: UserSummary;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
  reviewComment?: string;
};

export type ProgressUpdateNote = {
  oldProgress: number;
  newProgress: number;
  note: string;
  employeeId: string;
  employeeName: string;
  createdAt: string;
};

export type TaskComment = {
  _id: string;
  authorName: string;
  authorRole: Role;
  body: string;
  isReviewComment: boolean;
  createdAt: string;
};

export type TaskAttachment = {
  _id: string;
  uploadedByName: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type TaskActivity = {
  _id: string;
  actorName: string;
  actorRole: Role;
  type:
    | "progress_update"
    | "progress_note"
    | "comment"
    | "attachment"
    | "status_change"
    | "assignment_change"
    | "deadline_change"
    | "review_decision";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AdminTaskPatch = Partial<{
  title: string;
  description: string;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string;
}>;

export type TaskDetailPayload = {
  task: Task;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  timeline: TaskActivity[];
};
