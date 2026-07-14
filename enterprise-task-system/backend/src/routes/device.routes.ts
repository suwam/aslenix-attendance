import { Router, type RequestHandler } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  approvePendingDevice,
  getMyDeviceStatus,
  listEmployeeDevices,
  registerLoginDevice,
  rejectPendingDevice,
  removeDevice,
  replaceDevice,
} from "../controllers/device.controller";

export const deviceRouter = Router();
const authed = (handler: unknown) => handler as RequestHandler;

deviceRouter.use(requireAuth);

deviceRouter.post("/login", authed(registerLoginDevice));
deviceRouter.get("/me", authed(getMyDeviceStatus));

deviceRouter.get("/", requireRole("admin", "manager"), authed(listEmployeeDevices));
deviceRouter.post("/requests/:requestId/approve", requireRole("admin", "manager"), authed(approvePendingDevice));
deviceRouter.post("/requests/:requestId/reject", requireRole("admin", "manager"), authed(rejectPendingDevice));
deviceRouter.post("/:deviceId/replace", requireRole("admin", "manager"), authed(replaceDevice));
deviceRouter.delete("/:deviceId", requireRole("admin", "manager"), authed(removeDevice));
