export type DeviceStatus = "Active" | "Inactive";
export type DeviceRequestStatus = "Pending" | "Approved" | "Rejected";
export type AttendanceAction = "Check In" | "Check Out" | "Break Start" | "Break End";

export type EmployeeSummary = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

export type EmployeeDevice = {
  _id: string;
  employeeId: EmployeeSummary | string;
  deviceFingerprint: string;
  browser: string;
  operatingSystem: string;
  deviceName: string;
  status: DeviceStatus;
  registeredAt: string;
  lastLogin: string;
};

export type PendingDeviceRequest = {
  _id: string;
  employeeId: EmployeeSummary | string;
  deviceFingerprint: string;
  browser: string;
  operatingSystem: string;
  deviceName: string;
  requestedAt: string;
  status: DeviceRequestStatus;
};

export type DeviceManagementPayload = {
  devices: EmployeeDevice[];
  pendingRequests: PendingDeviceRequest[];
};

export type AttendanceBlockedError = Error & {
  code?: "DEVICE_NOT_REGISTERED";
};
