-- Device management security tables for Supabase-backed ASLENIX attendance.

CREATE TABLE IF NOT EXISTS public.employee_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  browser TEXT NOT NULL,
  operating_system TEXT NOT NULL,
  device_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_devices_employee_fingerprint_key
ON public.employee_devices (employee_id, device_fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS employee_devices_one_active_idx
ON public.employee_devices (employee_id)
WHERE status = 'Active';

CREATE TABLE IF NOT EXISTS public.pending_device_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  browser TEXT NOT NULL,
  operating_system TEXT NOT NULL,
  device_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pending_device_requests_pending_key
ON public.pending_device_requests (employee_id, device_fingerprint)
WHERE status = 'Pending';

CREATE TABLE IF NOT EXISTS public.attendance_device_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT,
  browser TEXT NOT NULL,
  os TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('Check In', 'Check Out', 'Break Start', 'Break End')),
  status TEXT NOT NULL CHECK (status IN ('Allowed', 'Blocked')),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_device_logs_employee_created_idx
ON public.attendance_device_logs (employee_id, created_at DESC);

ALTER TABLE public.employee_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_device_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees view own devices" ON public.employee_devices;
CREATE POLICY "employees view own devices"
ON public.employee_devices FOR SELECT
USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "admins manage employee devices" ON public.employee_devices;
CREATE POLICY "admins manage employee devices"
ON public.employee_devices FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "employees view own pending device requests" ON public.pending_device_requests;
CREATE POLICY "employees view own pending device requests"
ON public.pending_device_requests FOR SELECT
USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employees create own pending device requests" ON public.pending_device_requests;
CREATE POLICY "employees create own pending device requests"
ON public.pending_device_requests FOR INSERT
WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "admins manage pending device requests" ON public.pending_device_requests;
CREATE POLICY "admins manage pending device requests"
ON public.pending_device_requests FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "employees create own attendance device logs" ON public.attendance_device_logs;
CREATE POLICY "employees create own attendance device logs"
ON public.attendance_device_logs FOR INSERT
WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employees view own attendance device logs" ON public.attendance_device_logs;
CREATE POLICY "employees view own attendance device logs"
ON public.attendance_device_logs FOR SELECT
USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "admins view attendance device logs" ON public.attendance_device_logs;
CREATE POLICY "admins view attendance device logs"
ON public.attendance_device_logs FOR SELECT
USING (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_employee_devices_updated ON public.employee_devices;
CREATE TRIGGER trg_employee_devices_updated
BEFORE UPDATE ON public.employee_devices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_pending_device_requests_updated ON public.pending_device_requests;
CREATE TRIGGER trg_pending_device_requests_updated
BEFORE UPDATE ON public.pending_device_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
