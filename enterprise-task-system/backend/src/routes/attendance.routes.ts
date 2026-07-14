import { Router, type RequestHandler } from "express";
import { breakEnd, breakStart, checkIn, checkOut } from "../controllers/attendance.controller";
import { requireAuth } from "../middleware/auth";
import { requireRegisteredAttendanceDevice } from "../middleware/deviceAttendance";

export const attendanceRouter = Router();
const authed = (handler: unknown) => handler as RequestHandler;

attendanceRouter.use(requireAuth, requireRegisteredAttendanceDevice);

attendanceRouter.post("/check-in", authed(checkIn));
attendanceRouter.post("/check-out", authed(checkOut));
attendanceRouter.post("/break-start", authed(breakStart));
attendanceRouter.post("/break-end", authed(breakEnd));
