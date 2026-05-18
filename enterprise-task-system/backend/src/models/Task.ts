import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "ready_for_review",
  "approved",
  "completed",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const WORKFLOW_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "ready_for_review",
  "approved",
  "completed",
];

export const ADMIN_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "ready_for_review", "approved", "completed"],
  in_progress: ["todo", "ready_for_review", "approved", "completed"],
  ready_for_review: ["in_progress", "approved", "completed"],
  approved: ["completed", "in_progress"],
  completed: ["approved"],
};

const taskSchema = new Schema(
  {
    taskCode: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: "", maxlength: 6000 },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium", index: true },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    progressUpdates: {
      type: [
        {
          oldProgress: { type: Number, min: 0, max: 100, required: true },
          newProgress: { type: Number, min: 0, max: 100, required: true },
          note: { type: String, required: true, trim: true, maxlength: 3000 },
          employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
          employeeName: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    deadline: { type: Date, default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewComment: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ createdAt: -1 });

export type TaskDocument = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
};

export const Task = model("Task", taskSchema);
