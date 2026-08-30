DROP FUNCTION IF EXISTS public.admin_card_reader_audit_history(INT);

CREATE OR REPLACE FUNCTION public.admin_card_reader_audit_history()
RETURNS TABLE (
  id UUID,
  attendance_id UUID,
  employee_id UUID,
  employee_code TEXT,
  employee_name TEXT,
  admin_id UUID,
  admin_name TEXT,
  action TEXT,
  attendance_method TEXT,
  card_uid TEXT,
  reader_id TEXT,
  reader_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.attendance_id,
    e.employee_id,
    employee.employee_code,
    COALESCE(employee.full_name, 'Unknown employee') AS employee_name,
    e.admin_id,
    COALESCE(admin.full_name, 'Administrator') AS admin_name,
    e.action,
    e.attendance_method,
    '****' || e.card_uid_last4 AS card_uid,
    e.reader_id,
    e.reader_name,
    e.reason,
    e.created_at
  FROM public.card_reader_attendance_events e
  LEFT JOIN public.profiles employee ON employee.user_id = e.employee_id
  LEFT JOIN public.profiles admin ON admin.user_id = e.admin_id
  WHERE public.is_admin(auth.uid())
    AND e.action IN ('check_in', 'check_out', 'register_card', 'unknown_card', 'duplicate')
  ORDER BY e.created_at DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.admin_card_reader_audit_history() TO authenticated;

NOTIFY pgrst, 'reload schema';
