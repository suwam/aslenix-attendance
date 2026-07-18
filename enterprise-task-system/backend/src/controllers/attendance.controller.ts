import type { Response } from "express";
import { AttendanceRecord } from "../models/AttendanceRecord";
import type { AuthRequest } from "../middleware/auth";
import { logAttendanceAttempt } from "../services/device.service";
import { getRequestIp, readDeviceMetadata } from "../types/device";
import { resolveAttendanceAction } from "../middleware/deviceAttendance";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function logAllowed(req: AuthRequest) {
  await logAttendanceAttempt({
    employeeId: req.user._id,
    metadata: readDeviceMetadata(req),
    ipAddress: getRequestIp(req),
    action: resolveAttendanceAction(req),
    status: "Allowed",
    reason: "Active registered device matched",
  });
}

export async function checkIn(req: AuthRequest, res: Response) {
  const metadata = readDeviceMetadata(req);
  const now = new Date();
  const record = await AttendanceRecord.findOneAndUpdate(
    { employeeId: req.user._id, workDate: todayKey() },
    {
      $setOnInsert: {
        employeeId: req.user._id,
        workDate: todayKey(),
        checkInAt: now,
        deviceFingerprint: metadata.deviceFingerprint,
      },
    },
    { upsert: true, new: true },
  );

  await logAllowed(req);
  return res.status(201).json({ attendance: record });
}

export async function checkOut(req: AuthRequest, res: Response) {
  const record = await AttendanceRecord.findOneAndUpdate(
    { employeeId: req.user._id, workDate: todayKey(), checkInAt: { $ne: null } },
    { checkOutAt: new Date() },
    { new: true },
  );
  if (!record) return res.status(422).json({ message: "Check in before checking out" });

  await logAllowed(req);
  return res.json({ attendance: record });
}

export async function breakStart(req: AuthRequest, res: Response) {
  const record = await AttendanceRecord.findOneAndUpdate(
    { employeeId: req.user._id, workDate: todayKey(), checkInAt: { $ne: null }, checkOutAt: null },
    { $push: { breaks: { startedAt: new Date(), endedAt: null } } },
    { new: true },
  );
  if (!record)
    return res.status(422).json({ message: "Active attendance is required to start a break" });

  await logAllowed(req);
  return res.json({ attendance: record });
}

export async function breakEnd(req: AuthRequest, res: Response) {
  const record = await AttendanceRecord.findOneAndUpdate(
    {
      employeeId: req.user._id,
      workDate: todayKey(),
      "breaks.endedAt": null,
    },
    { $set: { "breaks.$.endedAt": new Date() } },
    { new: true },
  );
  if (!record) return res.status(422).json({ message: "No active break found" });

  await logAllowed(req);
  return res.json({ attendance: record });
}
