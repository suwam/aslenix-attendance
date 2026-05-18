import type { AdminTaskPatch, TaskDetailPayload } from "../types/task";

const API_BASE = import.meta.env.VITE_TASK_API_BASE || "http://localhost:4000/api";

async function request<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const taskApi = {
  detail(taskId: string) {
    return request<TaskDetailPayload>(`/tasks/${taskId}`);
  },
  updateAdminFields(taskId: string, payload: AdminTaskPatch) {
    return request(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  updateProgress(taskId: string, progress: number, note: string) {
    return request(`/tasks/${taskId}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ progress, note }),
    });
  },
  submitReview(taskId: string) {
    return request(`/tasks/${taskId}/submit-review`, { method: "POST" });
  },
  review(taskId: string, decision: "approve" | "reject", comment: string) {
    return request(`/tasks/${taskId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, comment }),
    });
  },
  complete(taskId: string) {
    return request(`/tasks/${taskId}/complete`, { method: "POST" });
  },
  delete(taskId: string) {
    return request(`/tasks/${taskId}`, { method: "DELETE" });
  },
  comment(taskId: string, body: string, isReviewComment = false) {
    return request(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, isReviewComment }),
    });
  },
  attach(taskId: string, payload: { fileName: string; fileUrl: string; mimeType: string; size: number }) {
    return request(`/tasks/${taskId}/attachments`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
