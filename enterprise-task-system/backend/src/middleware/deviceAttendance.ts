import type { NextFunction, Request, Response } from "express";
import { ATTENDANCE_ACTIONS, type AttendanceAction } from "../models/AttendanceLog";
import type { AuthRequest } from "./auth";
import { DEVICE_BLOCK_MESSAGE, logAttendanceAttempt, validateActiveDevice } from "../services/device.service";
import { getRequestIp, readDeviceMetadata } from "../types/device";

const actionByPath: Record<string, AttendanceAction> = {
  "check-in": "Check In",
  "check-out": "Check Out",
  "break-start": "Break Start",
  "break-end": "Break End",
};

export function resolveAttendanceAction(req: Request): AttendanceAction {
  const action = actionByPath[req.path.replace("/", "")] || req.body.action;
  return ATTENDANCE_ACTIONS.includes(action) ? action : "Check In";
}

export async function requireRegisteredAttendanceDevice(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthRequest;
  const metadata = readDeviceMetadata(req);
  const action = resolveAttendanceAction(req);

  try {
    const isValid = await validateActiveDevice(authReq.user._id, metadata);
    if (!isValid) {
      await logAttendanceAttempt({
        employeeId: authReq.user._id,
        metadata,
        ipAddress: getRequestIp(req),
        action,
        status: "Blocked",
        reason: DEVICE_BLOCK_MESSAGE,
      });

      return res.status(403).json({
        code: "DEVICE_NOT_REGISTERED",
        message: DEVICE_BLOCK_MESSAGE,
      });
    }

    next();
  } catch (error) {
    await logAttendanceAttempt({
      employeeId: authReq.user._id,
      metadata,
      ipAddress: getRequestIp(req),
      action,
      status: "Blocked",
      reason: error instanceof Error ? error.message : "Unable to validate device",
    });
    return res.status(422).json({ message: error instanceof Error ? error.message : "Unable to validate device" });
  }
}
