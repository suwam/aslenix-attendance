import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export const DEVICE_REQUEST_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type DeviceRequestStatus = (typeof DEVICE_REQUEST_STATUSES)[number];

const pendingDeviceRequestSchema = new Schema(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceFingerprint: { type: String, required: true, trim: true },
    browser: { type: String, required: true, trim: true },
    operatingSystem: { type: String, required: true, trim: true },
    deviceName: { type: String, required: true, trim: true },
    requestedAt: { type: Date, default: Date.now, required: true },
    status: {
      type: String,
      enum: DEVICE_REQUEST_STATUSES,
      default: "Pending",
      required: true,
      index: true,
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

pendingDeviceRequestSchema.index(
  { employeeId: 1, deviceFingerprint: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "Pending" } },
);

export type PendingDeviceRequestDocument = InferSchemaType<typeof pendingDeviceRequestSchema> & {
  _id: Types.ObjectId;
};

export const PendingDeviceRequest = model("PendingDeviceRequest", pendingDeviceRequestSchema);
