import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const taskCommentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ["employee", "manager", "admin"], required: true },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    isReviewComment: { type: Boolean, default: false },
  },
  { timestamps: true },
);

taskCommentSchema.index({ taskId: 1, createdAt: -1 });

export type TaskCommentDocument = InferSchemaType<typeof taskCommentSchema> & {
  _id: Types.ObjectId;
};

export const TaskComment = model("TaskComment", taskCommentSchema);
