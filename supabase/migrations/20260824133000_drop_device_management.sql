-- Drop device registration feature tables and functions

DROP TABLE IF EXISTS public.device_passkeys CASCADE;
DROP TABLE IF EXISTS public.webauthn_challenges CASCADE;
DROP TABLE IF EXISTS public.trusted_device_audit_logs CASCADE;
DROP TABLE IF EXISTS public.attendance_device_logs CASCADE;
DROP TABLE IF EXISTS public.pending_device_requests CASCADE;
DROP TABLE IF EXISTS public.employee_devices CASCADE;
DROP TABLE IF EXISTS public.device_security_settings CASCADE;

DROP FUNCTION IF EXISTS public.enforce_trusted_device_limit() CASCADE;
