CREATE OR REPLACE FUNCTION public.notify_admins_on_attendance_correction_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance_date DATE;
BEGIN
  SELECT date INTO v_attendance_date
  FROM public.attendance
  WHERE id = NEW.attendance_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT DISTINCT
    role_row.user_id,
    'Attendance correction request',
    NEW.employee_name
      || ' requested an attendance correction'
      || COALESCE(' for ' || to_char(v_attendance_date, 'Mon DD, YYYY'), '')
      || '. Reason: '
      || NEW.reason,
    'warning'
  FROM public.user_roles role_row
  JOIN public.profiles profile ON profile.user_id = role_row.user_id
  WHERE role_row.role IN ('super_admin', 'admin', 'hr_manager')
    AND profile.approval_status = 'approved'
    AND profile.is_suspended = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_correction_request_admin_notify
ON public.attendance_correction_requests;

CREATE TRIGGER attendance_correction_request_admin_notify
AFTER INSERT ON public.attendance_correction_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_attendance_correction_request();
