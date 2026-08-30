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
  SELECT *
  FROM public.admin_card_reader_audit_history(50);
$$;

GRANT EXECUTE ON FUNCTION public.admin_card_reader_audit_history() TO authenticated;

NOTIFY pgrst, 'reload schema';
