
CREATE OR REPLACE FUNCTION public.verify_employee_qr(_token text)
RETURNS TABLE (
  employee_code text,
  full_name text,
  department text,
  job_position text,
  joining_date date,
  avatar_url text,
  approval_status approval_status,
  qr_status qr_status,
  role app_role,
  qr_generated_at timestamptz,
  is_valid boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.employee_code,
    p.full_name,
    p.department,
    p.position AS job_position,
    p.joining_date,
    p.avatar_url,
    p.approval_status,
    p.qr_status,
    (SELECT r.role FROM public.user_roles r WHERE r.user_id = p.user_id ORDER BY r.created_at LIMIT 1) AS role,
    p.qr_generated_at,
    (p.qr_status = 'active' AND p.approval_status = 'approved' AND p.is_suspended = false) AS is_valid
  FROM public.profiles p
  WHERE p.qr_token = _token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_employee_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_employee_qr(text) TO anon, authenticated;
