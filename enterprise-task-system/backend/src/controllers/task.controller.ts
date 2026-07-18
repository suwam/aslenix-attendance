import type { Response } from "express";
import { Types } from "mongoose";
import {
  ADMIN_STATUS_TRANSITIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  Task,
  type TaskStatus,
} from "../models/Task";
import { TaskActivity } from "../models/TaskActivity";
import { TaskAttachment } from "../models/TaskAttachment";
import { TaskComment } from "../models/TaskComment";
import { canManageTasks, type AuthRequest } from "../middleware/auth";
import { logTaskActivity } from "../services/activity.service";
import { notifyAdmins } from "../services/notification.service";

const ADMIN_PATCH_FIELDS = [
  "title",
  "description",
  "deadline",
  "priority",
  "assignedTo",
  "status",
] as const;

function assertObjectId(id: string) {
  return Types.ObjectId.isValid(id);
}

function isValidStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.includes(value as TaskStatus);
}

function normalizeDeadline(value: unknown) {
  if (value === null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function assertAdminTransition(current: TaskStatus, next: TaskStatus) {
  return current === next || ADMIN_STATUS_TRANSITIONS[current].includes(next);
}

async function getAccessibleTask(req: AuthRequest, taskId: string) {
  if (!assertObjectId(taskId)) return null;
  const task = await Task.findById(taskId);
  if (!task) return null;
  const isOwner = task.assignedTo.toString() === req.user._id.toString();
  if (isOwner || canManageTasks(req.user.role)) return task;
  return null;
}

export async function listTasks(req: AuthRequest, res: Response) {
  const query = canManageTasks(req.user.role) ? {} : { assignedTo: req.user._id };
  const tasks = await Task.find(query)
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email role")
    .sort({ updatedAt: -1 });
  return res.json({ tasks });
}

export async function createTask(req: AuthRequest, res: Response) {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "Only managers and admins can create tasks" });
  }

  const title = String(req.body.title || "").trim();
  const assignedTo = String(req.body.assignedTo || "");
  const deadline = normalizeDeadline(req.body.deadline);

  if (!title) return res.status(422).json({ message: "Task title is required" });
  if (!assertObjectId(assignedTo))
    return res.status(422).json({ message: "Assigned employee is required" });
  if (req.body.priority && !TASK_PRIORITIES.includes(req.body.priority)) {
    return res.status(422).json({ message: "Invalid priority" });
  }
  if (deadline === undefined) return res.status(422).json({ message: "Invalid deadline" });

  const task = await Task.create({
    taskCode: `TASK-${Date.now()}`,
    title,
    description: String(req.body.description || ""),
    priority: req.body.priority || "medium",
    deadline,
    assignedTo,
    createdBy: req.user._id,
    lastUpdatedBy: req.user._id,
  });

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "status_change",
    message: `${req.user.name} created task ${task.taskCode}`,
    metadata: { newStatus: task.status },
  });

  return res.status(201).json({ task });
}

export async function getTaskDetail(req: AuthRequest, res: Response) {
  const task = await getAccessibleTask(req, req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const [comments, attachments, timeline] = await Promise.all([
    TaskComment.find({ taskId: task._id }).sort({ createdAt: 1 }),
    TaskAttachment.find({ taskId: task._id }).sort({ createdAt: 1 }),
    TaskActivity.find({ taskId: task._id }).sort({ createdAt: 1 }),
  ]);

  await task.populate("assignedTo", "name email role");
  await task.populate("createdBy", "name email role");
  return res.json({ task, comments, attachments, timeline });
}

export async function adminUpdateTask(req: AuthRequest, res: Response) {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "Only managers and admins can edit task fields" });
  }

  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const unknownFields = Object.keys(req.body).filter(
    (key) => !ADMIN_PATCH_FIELDS.includes(key as never),
  );
  if (unknownFields.length) {
    return res
      .status(422)
      .json({ message: `Unsupported task fields: ${unknownFields.join(", ")}` });
  }

  const oldStatus = task.status;
  const oldAssignedTo = task.assignedTo.toString();
  const oldDeadline = task.deadline;
  const oldProgress = task.progress;

  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(422).json({ message: "Task title is required" });
    task.title = title;
  }
  if (req.body.description !== undefined) task.description = String(req.body.description || "");
  if (req.body.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(req.body.priority))
      return res.status(422).json({ message: "Invalid priority" });
    task.priority = req.body.priority;
  }
  if (req.body.assignedTo !== undefined) {
    if (!assertObjectId(String(req.body.assignedTo)))
      return res.status(422).json({ message: "Invalid assignee" });
    task.assignedTo = req.body.assignedTo;
  }
  if (req.body.deadline !== undefined) {
    const deadline = normalizeDeadline(req.body.deadline);
    if (deadline === undefined) return res.status(422).json({ message: "Invalid deadline" });
    task.deadline = deadline;
  }
  if (req.body.status !== undefined) {
    if (!isValidStatus(req.body.status)) return res.status(422).json({ message: "Invalid status" });
    if (!assertAdminTransition(oldStatus, req.body.status)) {
      return res
        .status(422)
        .json({ message: `Cannot move task from ${oldStatus} to ${req.body.status}` });
    }
    task.status = req.body.status;
  }

  if (task.status === "completed") {
    task.progress = 100;
    task.completedAt = new Date();
  } else {
    task.completedAt = null;
  }
  if (task.status === "approved" || task.status === "completed") {
    task.approvedAt = task.approvedAt || new Date();
  } else {
    task.approvedAt = null;
  }
  task.lastUpdatedBy = req.user._id;
  await task.save();

  if (oldStatus !== task.status) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "status_change",
      message: `${req.user.name} changed status ${oldStatus} to ${task.status}`,
      metadata: { oldStatus, newStatus: task.status },
    });
  }
  if (oldAssignedTo !== task.assignedTo.toString()) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "assignment_change",
      message: `${req.user.name} reassigned the task`,
      metadata: { oldAssignedTo, newAssignedTo: task.assignedTo.toString() },
    });
  }
  if (String(oldDeadline || "") !== String(task.deadline || "")) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "deadline_change",
      message: `${req.user.name} updated the deadline`,
      metadata: { oldDeadline, newDeadline: task.deadline },
    });
  }
  if (oldProgress !== task.progress) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "progress_update",
      message: `${req.user.name} updated progress from ${oldProgress}% to ${task.progress}%`,
      metadata: { oldProgress, newProgress: task.progress },
    });
  }

  return res.json({ task });
}

export async function employeeUpdateProgress(req: AuthRequest, res: Response) {
  const task = await getAccessibleTask(req, req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (task.assignedTo.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the assigned employee can update progress" });
  }
  if (["approved", "completed"].includes(task.status)) {
    return res
      .status(422)
      .json({ message: "Approved or completed tasks cannot be updated by employees" });
  }

  const nextProgress = Number(req.body.progress);
  const note = String(req.body.note || "").trim();
  if (!Number.isInteger(nextProgress) || nextProgress < 0 || nextProgress > 100) {
    return res.status(422).json({ message: "Progress must be a whole number from 0 to 100" });
  }
  if (nextProgress !== task.progress && !note) {
    return res.status(422).json({ message: "Update note is required when progress changes" });
  }

  const oldProgress = task.progress;
  const oldStatus = task.status;
  task.progress = nextProgress;
  if (nextProgress > oldProgress) {
    task.progressUpdates.push({
      oldProgress,
      newProgress: nextProgress,
      note,
      employeeId: req.user._id,
      employeeName: req.user.name,
      createdAt: new Date(),
    });
  }
  if (task.status === "todo" && nextProgress > 0) task.status = "in_progress";
  if (nextProgress === 100) task.status = "ready_for_review";
  task.lastUpdatedBy = req.user._id;
  await task.save();

  if (oldProgress !== nextProgress) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "progress_update",
      message: `${req.user.name} updated progress from ${oldProgress}% to ${nextProgress}%`,
      metadata: { oldProgress, newProgress: nextProgress, note },
    });
  } else if (note) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "progress_note",
      message: `${req.user.name} added a progress update note`,
      metadata: { oldProgress, newProgress: nextProgress, note },
    });
  }
  if (oldStatus !== task.status) {
    await logTaskActivity({
      taskId: task._id,
      actor: req.user,
      type: "status_change",
      message: `Task moved from ${oldStatus} to ${task.status}`,
      metadata: { oldStatus, newStatus: task.status },
    });
  }
  if (nextProgress === 100) {
    await notifyAdmins("Task is ready for review", {
      taskId: task._id,
      taskCode: task.taskCode,
      employee: req.user.name,
    });
  }

  return res.json({ task });
}

export async function submitForReview(req: AuthRequest, res: Response) {
  const task = await getAccessibleTask(req, req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (task.assignedTo.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Only the assigned employee can submit this task" });
  }
  if (["approved", "completed"].includes(task.status)) {
    return res.status(422).json({ message: "Task has already passed review" });
  }

  const oldStatus = task.status;
  task.status = "ready_for_review";
  task.lastUpdatedBy = req.user._id;
  await task.save();

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "status_change",
    message: `${req.user.name} submitted task for review`,
    metadata: { oldStatus, newStatus: task.status },
  });
  await notifyAdmins("Task submitted for review", { taskId: task._id, taskCode: task.taskCode });
  return res.json({ task });
}

export async function reviewTask(req: AuthRequest, res: Response) {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "Only managers and admins can review tasks" });
  }
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });

  const decision = req.body.decision;
  if (!["approve", "reject"].includes(decision)) {
    return res.status(422).json({ message: "Decision must be approve or reject" });
  }
  if (task.status !== "ready_for_review") {
    return res
      .status(422)
      .json({ message: "Only tasks ready for review can be approved or rejected" });
  }

  const oldStatus = task.status;
  task.status = decision === "approve" ? "approved" : "in_progress";
  task.reviewComment = String(req.body.comment || "").trim();
  task.approvedAt = decision === "approve" ? new Date() : null;
  task.lastUpdatedBy = req.user._id;
  await task.save();

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "review_decision",
    message: `${req.user.name} ${decision === "approve" ? "approved" : "rejected"} the task`,
    metadata: { oldStatus, newStatus: task.status, decision, note: task.reviewComment },
  });

  if (task.reviewComment) {
    await TaskComment.create({
      taskId: task._id,
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: req.user.role,
      body: task.reviewComment,
      isReviewComment: true,
    });
  }

  return res.json({ task });
}

export async function completeTask(req: AuthRequest, res: Response) {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "Only managers and admins can complete tasks" });
  }
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (task.status !== "approved") {
    return res.status(422).json({ message: "Only approved tasks can be completed" });
  }

  const oldStatus = task.status;
  task.status = "completed";
  task.progress = 100;
  task.completedAt = new Date();
  task.lastUpdatedBy = req.user._id;
  await task.save();

  await logTaskActivity({
    taskId: task._id,
    actor: req.user,
    type: "status_change",
    message: `${req.user.name} marked the task completed`,
    metadata: { oldStatus, newStatus: "completed" },
  });

  return res.json({ task });
}

export async function deleteTask(req: AuthRequest, res: Response) {
  if (!canManageTasks(req.user.role)) {
    return res.status(403).json({ message: "Only managers and admins can delete tasks" });
  }
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: "Task not found" });
  await Promise.all([
    Task.findByIdAndDelete(task._id),
    TaskActivity.deleteMany({ taskId: task._id }),
    TaskAttachment.deleteMany({ taskId: task._id }),
    TaskComment.deleteMany({ taskId: task._id }),
  ]);
  return res.status(204).send();
}
