import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const ATTENDANCE_ACTIONS = ["Check In", "Check Out", "Break Start", "Break End"] as const;
export const ATTENDANCE_LOG_STATUSES = ["Allowed", "Blocked"] as const;
export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number];
export type AttendanceLogStatus = (typeof ATTENDANCE_LOG_STATUSES)[number];

const attendanceLogSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceFingerprint: { type: String, required: true, trim: true },
    ipAddress: { type: String, required: true, trim: true },
    browser: { type: String, required: true, trim: true },
    os: { type: String, required: true, trim: true },
    action: { type: String, enum: ATTENDANCE_ACTIONS, required: true },
    status: { type: String, enum: ATTENDANCE_LOG_STATUSES, required: true, index: true },
    reason: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

attendanceLogSchema.index({ employeeId: 1, createdAt: -1 });
attendanceLogSchema.index({ status: 1, createdAt: -1 });

export type AttendanceLogDocument = InferSchemaType<typeof attendanceLogSchema> & {
  _id: Types.ObjectId;
};

export const AttendanceLog = model("AttendanceLog", attendanceLogSchema);
