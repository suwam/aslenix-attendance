import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const ACTIVITY_TYPES = [
  "progress_update",
  "progress_note",
  "comment",
  "attachment",
  "status_change",
  "assignment_change",
  "deadline_change",
  "review_decision",
] as const;

const taskActivitySchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, enum: ["employee", "manager", "admin"], required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true, index: true },
    message: { type: String, required: true },
    metadata: {
      oldProgress: Number,
      newProgress: Number,
      oldStatus: String,
      newStatus: String,
      note: String,
      fileName: String,
      fileUrl: String,
      fileMimeType: String,
      fileSize: Number,
      oldAssignedTo: String,
      newAssignedTo: String,
      oldDeadline: Date,
      newDeadline: Date,
      decision: String,
    },
  },
  { timestamps: true },
);

taskActivitySchema.index({ taskId: 1, createdAt: -1 });

export type TaskActivityDocument = InferSchemaType<typeof taskActivitySchema> & {
  _id: Types.ObjectId;
};

export const TaskActivity = model("TaskActivity", taskActivitySchema);
