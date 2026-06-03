CREATE OR REPLACE FUNCTION public.get_admin_attendance_correction_requests()
RETURNS TABLE (
  id UUID,
  attendance_id UUID,
  user_id UUID,
  employee_name TEXT,
  requested_check_in_time TIMESTAMPTZ,
  requested_check_out_time TIMESTAMPTZ,
  requested_status public.attendance_status,
  requested_work_location TEXT,
  reason TEXT,
  status TEXT,
  admin_comment TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  attendance_date DATE,
  attendance_check_in_time TIMESTAMPTZ,
  attendance_check_out_time TIMESTAMPTZ,
  attendance_status public.attendance_status,
  attendance_work_location TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and HR can view attendance correction requests';
  END IF;

  RETURN QUERY
  SELECT
    request.id,
    request.attendance_id,
    request.user_id,
    request.employee_name,
    request.requested_check_in_time,
    request.requested_check_out_time,
    request.requested_status,
    request.requested_work_location,
    request.reason,
    request.status::TEXT,
    request.admin_comment,
    request.reviewed_by,
    request.reviewed_at,
    request.created_at,
    request.updated_at,
    attendance.date,
    attendance.check_in_time,
    attendance.check_out_time,
    attendance.status,
    attendance.work_location
  FROM public.attendance_correction_requests request
  LEFT JOIN public.attendance attendance ON attendance.id = request.attendance_id
  ORDER BY
    CASE WHEN request.status = 'pending' THEN 0 ELSE 1 END,
    request.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_attendance_correction_requests() TO authenticated;
