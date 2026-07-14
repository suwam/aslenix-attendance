import type {
  AttendanceAction,
  AttendanceBlockedError,
  DeviceManagementPayload,
  EmployeeDevice,
  PendingDeviceRequest,
} from "../types/device";
import { getDeviceMetadata } from "../utils/deviceFingerprint";

const API_BASE = import.meta.env.VITE_TASK_API_BASE || "http://localhost:4000/api";

type RequestOptions = RequestInit & {
  includeDevice?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}) {
  const token = localStorage.getItem("accessToken");
  const device = options.includeDevice ? await getDeviceMetadata() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(device
        ? {
            "x-device-fingerprint": device.deviceFingerprint,
            "x-device-browser": device.browser,
            "x-device-os": device.operatingSystem,
            "x-device-name": device.deviceName,
          }
        : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
    const error = new Error(errorBody.message || "Request failed") as AttendanceBlockedError;
    error.code = errorBody.code;
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const hrmsApi = {
  async registerLoginDevice() {
    const device = await getDeviceMetadata();
    return request<{ status: "registered" | "recognized" | "pending_request" }>("/devices/login", {
      method: "POST",
      body: JSON.stringify(device),
    });
  },
  myDeviceStatus() {
    return request<{ activeDevice: EmployeeDevice | null; pendingRequests: PendingDeviceRequest[] }>("/devices/me");
  },
  deviceManagement() {
    return request<DeviceManagementPayload>("/devices");
  },
  approveDevice(requestId: string) {
    return request(`/devices/requests/${requestId}/approve`, { method: "POST" });
  },
  rejectDevice(requestId: string) {
    return request(`/devices/requests/${requestId}/reject`, { method: "POST" });
  },
  replaceDevice(deviceId: string, requestId: string) {
    return request(`/devices/${deviceId}/replace`, {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
  },
  removeDevice(deviceId: string) {
    return request(`/devices/${deviceId}`, { method: "DELETE" });
  },
  attendance(action: AttendanceAction) {
    const pathByAction: Record<AttendanceAction, string> = {
      "Check In": "/attendance/check-in",
      "Check Out": "/attendance/check-out",
      "Break Start": "/attendance/break-start",
      "Break End": "/attendance/break-end",
    };

    return request(pathByAction[action], { method: "POST", includeDevice: true });
  },
};
