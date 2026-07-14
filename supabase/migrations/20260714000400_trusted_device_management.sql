-- Trusted device management: two-device limit, replacement flow, audit log,
-- and HR-configurable maximum device count.

DROP INDEX IF EXISTS public.employee_devices_one_active_idx;

ALTER TABLE public.employee_devices
  ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS force_logout_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT;

ALTER TABLE public.pending_device_requests
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'HR Approval'
    CHECK (verification_method IN ('Auto First Device', 'OTP', 'HR Approval', 'Replacement')),
  ADD COLUMN IF NOT EXISTS replace_device_id UUID REFERENCES public.employee_devices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.device_security_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  max_trusted_devices INTEGER NOT NULL DEFAULT 2 CHECK (max_trusted_devices BETWEEN 1 AND 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.device_security_settings (id, max_trusted_devices)
VALUES (true, 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.trusted_device_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.employee_devices(id) ON DELETE SET NULL,
  device_fingerprint TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT NOT NULL DEFAULT 'employee' CHECK (actor_role IN ('employee', 'admin', 'system')),
  action TEXT NOT NULL CHECK (
    action IN (
      'auto_registered',
      'registration_requested',
      'approved',
      'rejected',
      'renamed',
      'removed',
      'replaced',
      'force_logout',
      'passkey_registered',
      'last_login_updated',
      'max_devices_changed'
    )
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trusted_device_audit_logs_employee_created_idx
ON public.trusted_device_audit_logs (employee_id, created_at DESC);

ALTER TABLE public.device_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_device_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated view device security settings" ON public.device_security_settings;
CREATE POLICY "authenticated view device security settings"
ON public.device_security_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins manage device security settings" ON public.device_security_settings;
CREATE POLICY "admins manage device security settings"
ON public.device_security_settings FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "employees view own trusted device audit logs" ON public.trusted_device_audit_logs;
CREATE POLICY "employees view own trusted device audit logs"
ON public.trusted_device_audit_logs FOR SELECT
USING (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employees create own trusted device audit logs" ON public.trusted_device_audit_logs;
CREATE POLICY "employees create own trusted device audit logs"
ON public.trusted_device_audit_logs FOR INSERT
WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "admins view trusted device audit logs" ON public.trusted_device_audit_logs;
CREATE POLICY "admins view trusted device audit logs"
ON public.trusted_device_audit_logs FOR SELECT
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins create trusted device audit logs" ON public.trusted_device_audit_logs;
CREATE POLICY "admins create trusted device audit logs"
ON public.trusted_device_audit_logs FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "employees rename or remove own devices" ON public.employee_devices;
CREATE POLICY "employees rename or remove own devices"
ON public.employee_devices FOR UPDATE
USING (auth.uid() = employee_id)
WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "admins manage passkeys" ON public.device_passkeys;
CREATE POLICY "admins manage passkeys"
ON public.device_passkeys FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_device_security_settings_updated ON public.device_security_settings;
CREATE TRIGGER trg_device_security_settings_updated
BEFORE UPDATE ON public.device_security_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
