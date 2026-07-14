import type { Response } from "express";
import { EmployeeDevice } from "../models/EmployeeDevice";
import { PendingDeviceRequest } from "../models/PendingDeviceRequest";
import type { AuthRequest } from "../middleware/auth";
import {
  approveDeviceRequest,
  recordEmployeeLoginDevice,
  rejectDeviceRequest,
  removeEmployeeDevice,
  replaceEmployeeDevice,
} from "../services/device.service";
import { readDeviceMetadata } from "../types/device";

function handleControllerError(error: unknown, res: Response) {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 500;
  return res.status(Number.isFinite(statusCode) ? statusCode : 500).json({
    message: error instanceof Error ? error.message : "Unexpected server error",
  });
}

export async function registerLoginDevice(req: AuthRequest, res: Response) {
  try {
    const result = await recordEmployeeLoginDevice(req.user, readDeviceMetadata(req));
    return res.json(result);
  } catch (error) {
    return handleControllerError(error, res);
  }
}

export async function getMyDeviceStatus(req: AuthRequest, res: Response) {
  const [activeDevice, pendingRequests] = await Promise.all([
    EmployeeDevice.findOne({ employeeId: req.user._id, status: "Active" }),
    PendingDeviceRequest.find({ employeeId: req.user._id, status: "Pending" }).sort({ requestedAt: -1 }),
  ]);

  return res.json({ activeDevice, pendingRequests });
}

export async function listEmployeeDevices(_req: AuthRequest, res: Response) {
  const [devices, requests] = await Promise.all([
    EmployeeDevice.find()
      .populate("employeeId", "name email role")
      .sort({ status: 1, lastLogin: -1 }),
    PendingDeviceRequest.find({ status: "Pending" })
      .populate("employeeId", "name email role")
      .sort({ requestedAt: -1 }),
  ]);

  return res.json({ devices, pendingRequests: requests });
}

export async function approvePendingDevice(req: AuthRequest, res: Response) {
  try {
    const result = await approveDeviceRequest(req.params.requestId, req.user._id);
    return res.json(result);
  } catch (error) {
    return handleControllerError(error, res);
  }
}

export async function rejectPendingDevice(req: AuthRequest, res: Response) {
  try {
    const request = await rejectDeviceRequest(req.params.requestId, req.user._id);
    return res.json({ request });
  } catch (error) {
    return handleControllerError(error, res);
  }
}

export async function replaceDevice(req: AuthRequest, res: Response) {
  try {
    const result = await replaceEmployeeDevice(req.params.deviceId, String(req.body.requestId || ""), req.user._id);
    return res.json(result);
  } catch (error) {
    return handleControllerError(error, res);
  }
}

export async function removeDevice(req: AuthRequest, res: Response) {
  try {
    const device = await removeEmployeeDevice(req.params.deviceId);
    return res.json({ device });
  } catch (error) {
    return handleControllerError(error, res);
  }
}
