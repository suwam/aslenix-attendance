import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const taskAttachmentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedByName: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
  },
  { timestamps: true },
);

taskAttachmentSchema.index({ taskId: 1, createdAt: -1 });

export type TaskAttachmentDocument = InferSchemaType<typeof taskAttachmentSchema> & {
  _id: Types.ObjectId;
};

export const TaskAttachment = model("TaskAttachment", taskAttachmentSchema);
