import { Router, type RequestHandler } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  adminUpdateTask,
  completeTask,
  createTask,
  deleteTask,
  employeeUpdateProgress,
  getTaskDetail,
  listTasks,
  reviewTask,
  submitForReview,
} from "../controllers/task.controller";
import { addComment } from "../controllers/task-comment.controller";
import { addAttachment } from "../controllers/task-attachment.controller";

export const taskRouter = Router();
const authed = (handler: unknown) => handler as RequestHandler;

taskRouter.use(requireAuth);

taskRouter.get("/", authed(listTasks));
taskRouter.post("/", requireRole("admin", "manager"), authed(createTask));
taskRouter.get("/:taskId", authed(getTaskDetail));
taskRouter.patch("/:taskId", requireRole("admin", "manager"), authed(adminUpdateTask));
taskRouter.delete("/:taskId", requireRole("admin", "manager"), authed(deleteTask));

taskRouter.patch("/:taskId/progress", authed(employeeUpdateProgress));
taskRouter.post("/:taskId/submit-review", authed(submitForReview));
taskRouter.post("/:taskId/review", requireRole("admin", "manager"), authed(reviewTask));
taskRouter.post("/:taskId/complete", requireRole("admin", "manager"), authed(completeTask));

taskRouter.post("/:taskId/comments", authed(addComment));
taskRouter.post("/:taskId/attachments", authed(addAttachment));
