import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const DEVICE_STATUSES = ["Active", "Inactive"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

const employeeDeviceSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceFingerprint: { type: String, required: true, trim: true },
    browser: { type: String, required: true, trim: true },
    operatingSystem: { type: String, required: true, trim: true },
    deviceName: { type: String, required: true, trim: true },
    status: { type: String, enum: DEVICE_STATUSES, default: "Active", required: true, index: true },
    registeredAt: { type: Date, default: Date.now, required: true },
    lastLogin: { type: Date, default: Date.now, required: true },
  },
  { timestamps: true },
);

employeeDeviceSchema.index(
  { employeeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "Active" } },
);
employeeDeviceSchema.index({ employeeId: 1, deviceFingerprint: 1 }, { unique: true });

export type EmployeeDeviceDocument = InferSchemaType<typeof employeeDeviceSchema> & {
  _id: Types.ObjectId;
};

export const EmployeeDevice = model("EmployeeDevice", employeeDeviceSchema);
