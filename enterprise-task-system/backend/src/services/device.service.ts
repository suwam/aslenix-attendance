import { Types } from "mongoose";
import { AttendanceLog, type AttendanceAction } from "../models/AttendanceLog";
import { EmployeeDevice } from "../models/EmployeeDevice";
import { PendingDeviceRequest } from "../models/PendingDeviceRequest";
import { notifyAdmins } from "./notification.service";
import type { DeviceMetadata } from "../types/device";

const DEVICE_BLOCK_MESSAGE =
  "This device is not registered. Please use your registered device or contact HR.";

type EmployeeRef = {
  _id: Types.ObjectId;
  name: string;
  email: string;
};

function assertFingerprint(metadata: DeviceMetadata) {
  if (!metadata.deviceFingerprint) {
    throw Object.assign(new Error("Device fingerprint is required"), { statusCode: 422 });
  }
}

export async function recordEmployeeLoginDevice(employee: EmployeeRef, metadata: DeviceMetadata) {
  assertFingerprint(metadata);

  const activeDevice = await EmployeeDevice.findOne({ employeeId: employee._id, status: "Active" });
  if (!activeDevice) {
    const existingDevice = await EmployeeDevice.findOne({
      employeeId: employee._id,
      deviceFingerprint: metadata.deviceFingerprint,
    });

    if (existingDevice) {
      existingDevice.status = "Active";
      existingDevice.browser = metadata.browser;
      existingDevice.operatingSystem = metadata.operatingSystem;
      existingDevice.deviceName = metadata.deviceName;
      existingDevice.lastLogin = new Date();
      await existingDevice.save();
      return { status: "registered" as const, device: existingDevice };
    }

    const device = await EmployeeDevice.create({
      employeeId: employee._id,
      deviceFingerprint: metadata.deviceFingerprint,
      browser: metadata.browser,
      operatingSystem: metadata.operatingSystem,
      deviceName: metadata.deviceName,
      status: "Active",
      registeredAt: new Date(),
      lastLogin: new Date(),
    });
    return { status: "registered" as const, device };
  }

  if (activeDevice.deviceFingerprint === metadata.deviceFingerprint) {
    activeDevice.browser = metadata.browser;
    activeDevice.operatingSystem = metadata.operatingSystem;
    activeDevice.deviceName = metadata.deviceName;
    activeDevice.lastLogin = new Date();
    await activeDevice.save();
    return { status: "recognized" as const, device: activeDevice };
  }

  const request = await PendingDeviceRequest.findOneAndUpdate(
    {
      employeeId: employee._id,
      deviceFingerprint: metadata.deviceFingerprint,
      status: "Pending",
    },
    {
      $set: {
        browser: metadata.browser,
        operatingSystem: metadata.operatingSystem,
        deviceName: metadata.deviceName,
      },
      $setOnInsert: {
        employeeId: employee._id,
        deviceFingerprint: metadata.deviceFingerprint,
        requestedAt: new Date(),
        status: "Pending",
      },
    },
    { new: true, upsert: true },
  );

  await notifyAdmins("New device approval requested", {
    employeeId: employee._id.toString(),
    employeeName: employee.name,
    employeeEmail: employee.email,
    deviceFingerprint: metadata.deviceFingerprint,
    browser: metadata.browser,
    operatingSystem: metadata.operatingSystem,
    deviceName: metadata.deviceName,
  });

  return { status: "pending_request" as const, activeDevice, request };
}

export async function validateActiveDevice(employeeId: Types.ObjectId, metadata: DeviceMetadata) {
  assertFingerprint(metadata);
  const activeDevice = await EmployeeDevice.findOne({ employeeId, status: "Active" });
  return Boolean(activeDevice && activeDevice.deviceFingerprint === metadata.deviceFingerprint);
}

export async function logAttendanceAttempt(input: {
  employeeId: Types.ObjectId;
  metadata: DeviceMetadata;
  ipAddress: string;
  action: AttendanceAction;
  status: "Allowed" | "Blocked";
  reason: string;
}) {
  return AttendanceLog.create({
    employeeId: input.employeeId,
    deviceFingerprint: input.metadata.deviceFingerprint || "unknown",
    ipAddress: input.ipAddress,
    browser: input.metadata.browser || "Unknown browser",
    os: input.metadata.operatingSystem || "Unknown OS",
    action: input.action,
    status: input.status,
    reason: input.reason,
  });
}

export async function approveDeviceRequest(requestId: string, reviewerId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(requestId)) {
    throw Object.assign(new Error("Invalid device request id"), { statusCode: 422 });
  }

  const request = await PendingDeviceRequest.findById(requestId);
  if (!request || request.status !== "Pending") {
    throw Object.assign(new Error("Pending device request not found"), { statusCode: 404 });
  }

  await EmployeeDevice.updateMany(
    { employeeId: request.employeeId, status: "Active" },
    { status: "Inactive" },
  );
  const device = await EmployeeDevice.findOneAndUpdate(
    { employeeId: request.employeeId, deviceFingerprint: request.deviceFingerprint },
    {
      employeeId: request.employeeId,
      deviceFingerprint: request.deviceFingerprint,
      browser: request.browser,
      operatingSystem: request.operatingSystem,
      deviceName: request.deviceName,
      status: "Active",
      registeredAt: new Date(),
      lastLogin: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  request.status = "Approved";
  request.reviewedAt = new Date();
  request.reviewedBy = reviewerId;
  await request.save();

  return { request, device };
}

export async function rejectDeviceRequest(requestId: string, reviewerId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(requestId)) {
    throw Object.assign(new Error("Invalid device request id"), { statusCode: 422 });
  }

  const request = await PendingDeviceRequest.findById(requestId);
  if (!request || request.status !== "Pending") {
    throw Object.assign(new Error("Pending device request not found"), { statusCode: 404 });
  }

  request.status = "Rejected";
  request.reviewedAt = new Date();
  request.reviewedBy = reviewerId;
  await request.save();
  return request;
}

export async function removeEmployeeDevice(deviceId: string) {
  if (!Types.ObjectId.isValid(deviceId)) {
    throw Object.assign(new Error("Invalid device id"), { statusCode: 422 });
  }

  const device = await EmployeeDevice.findById(deviceId);
  if (!device) {
    throw Object.assign(new Error("Device not found"), { statusCode: 404 });
  }

  device.status = "Inactive";
  await device.save();
  return device;
}

export async function replaceEmployeeDevice(
  deviceId: string,
  requestId: string,
  reviewerId: Types.ObjectId,
) {
  await removeEmployeeDevice(deviceId);
  return approveDeviceRequest(requestId, reviewerId);
}

export { DEVICE_BLOCK_MESSAGE };
