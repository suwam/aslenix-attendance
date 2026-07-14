import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const attendanceRecordSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workDate: { type: String, required: true, index: true },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    breaks: [
      {
        startedAt: { type: Date, required: true },
        endedAt: { type: Date, default: null },
      },
    ],
    deviceFingerprint: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

attendanceRecordSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });

export type AttendanceRecordDocument = InferSchemaType<typeof attendanceRecordSchema> & {
  _id: Types.ObjectId;
};

export const AttendanceRecord = model("AttendanceRecord", attendanceRecordSchema);
