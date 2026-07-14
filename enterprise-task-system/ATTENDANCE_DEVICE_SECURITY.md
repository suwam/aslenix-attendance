# Attendance Device Security

This MERN slice enforces a single active registered device for attendance actions.

## Backend

Mounted routes:

- `POST /api/devices/login` - call after a successful employee login. The first device is registered automatically. New fingerprints create a pending HR request.
- `GET /api/devices/me` - returns the employee active device and pending requests.
- `GET /api/devices` - HR/admin device management list.
- `POST /api/devices/requests/:requestId/approve` - approves a pending device and makes previous devices inactive.
- `POST /api/devices/requests/:requestId/reject` - rejects a pending device.
- `POST /api/devices/:deviceId/replace` - inactivates the old device and approves the supplied pending request.
- `DELETE /api/devices/:deviceId` - marks a device inactive.
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `POST /api/attendance/break-start`
- `POST /api/attendance/break-end`

Attendance routes use `requireRegisteredAttendanceDevice` before controller execution. Blocked attempts are recorded in `AttendanceLog` with employee, IP address, browser, operating system, fingerprint, action, timestamp, and reason.

## Frontend

Use `hrmsApi.registerLoginDevice()` immediately after login succeeds. It uses FingerprintJS `visitorId` and sends the fingerprint directly to the API; the device identifier is not stored in cookies or localStorage.

Reusable UI:

- `AttendanceSecurityPanel` - check in/out and break controls with the required blocked modal.
- `DeviceManagementPage` - HR device management table with approve, reject, replace, and remove actions.
