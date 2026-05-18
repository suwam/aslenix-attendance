import type { Response } from "express";
import { TaskComment } from "../models/TaskComment";
import { Task } from "../models/Task";
import { type AuthRequest, canManageTasks } from "../middleware/auth";
import { logTaskActivity } from "../services/activity.service";

export async function addComment(req: AuthRequest, res: Response) {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const isAssigned = task.assignedTo.toString() === req.user._id.toString();
  if (!isAssigned && !canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "You cannot comment on this task" });
  }

  const body = String(req.body.body || "").trim();
  if (!body) return res.status(422).json({ message: "Comment is required" });

  const comment = await TaskComment.create({
    taskId: task._id,
    authorId: req.user._id,
    authorName: req.user.name,
    authorRole: req.user.role,
    body,
    isReviewComment: canManageTasks(req.user.role) && Boolean(req.body.isReviewComment),
  });

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "comment",
    message: `${req.user.name} added a comment`,
    metadata: { note: body },
  });
  task.lastUpdatedBy = req.user._id;
  await task.save();

  return res.status(201).json({ comment });
}
