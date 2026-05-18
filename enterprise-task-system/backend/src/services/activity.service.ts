import { TaskActivity } from "../models/TaskActivity";
import type { Role } from "../models/User";

type Actor = {
  _id: unknown;
  name: string;
  role: Role;
};

export async function logTaskActivity(input: {
  taskId: unknown;
  actor: Actor;
  type:
    | "progress_update"
    | "progress_note"
    | "comment"
    | "attachment"
    | "status_change"
    | "assignment_change"
    | "deadline_change"
    | "review_decision";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return TaskActivity.create({
    taskId: input.taskId,
    actorId: input.actor._id,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    type: input.type,
    message: input.message,
    metadata: input.metadata || {},
  });
}
