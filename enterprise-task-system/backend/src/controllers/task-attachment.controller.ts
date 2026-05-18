import type { Response } from "express";
import { Task } from "../models/Task";
import { TaskAttachment } from "../models/TaskAttachment";
import { type AuthRequest, canManageTasks } from "../middleware/auth";
import { logTaskActivity } from "../services/activity.service";

export async function addAttachment(req: AuthRequest, res: Response) {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  const isAssigned = task.assignedTo.toString() === req.user._id.toString();
  if (!isAssigned && !canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "You cannot upload files to this task" });
  }

  const fileName = String(req.body.fileName || "").trim();
  const fileUrl = String(req.body.fileUrl || "").trim();
  if (!fileName || !fileUrl) return res.status(422).json({ message: "File metadata is required" });

  const attachment = await TaskAttachment.create({
    taskId: task._id,
    uploadedBy: req.user._id,
    uploadedByName: req.user.name,
    fileName,
    fileUrl,
    mimeType: req.body.mimeType || "application/octet-stream",
    size: Number(req.body.size || 0),
  });

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "attachment",
    message: `${req.user.name} uploaded ${fileName}`,
    metadata: { fileName, fileUrl, fileMimeType: attachment.mimeType, fileSize: attachment.size },
  });
  task.lastUpdatedBy = req.user._id;
  await task.save();

  return res.status(201).json({ attachment });
}
