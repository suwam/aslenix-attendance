export async function notifyAdmins(message: string, payload: Record<string, unknown>) {
  // Wire this to email, Slack, in-app notifications, or a queue worker.
  console.info("[admin-notification]", message, payload);
}
