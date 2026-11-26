export const adminRoutePermissions: Record<string, string | null> = {
  "/admin/employees": "employees.view",
  "/admin/attendance": "attendance.view",
  "/admin/attendance-corrections": "attendance.approve",
  "/admin/leaves": "leaves.view",
  "/admin/shifts": "shifts.view",
  "/admin/reports": "reports.view",
  "/admin/meetings": "meetings.view",
  "/admin/user-role-management": null,
  "/admin/tasks": null,
  "/admin/notifications": null,
  "/admin/settings": null,
  "/admin/approvals": null,
  "/admin/qr-ids": null,
  "/admin/card-reader-attendance": null,
  "/admin/whatsapp-settings": null,
  "/admin/whatsapp-history": null,
  "/admin/employee-of-month": null,
};

export function requiredAdminPermission(pathname: string) {
  const exact = adminRoutePermissions[pathname];
  if (exact !== undefined) return exact;
  return Object.entries(adminRoutePermissions).find(([path]) => pathname.startsWith(`${path}/`))?.[1];
}
