CREATE OR REPLACE FUNCTION public.apply_admin_attendance_edit(
  _attendance_id UUID,
  _check_in_time TIMESTAMPTZ,
  _check_out_time TIMESTAMPTZ,
  _status public.attendance_status,
  _work_location TEXT,
  _reason TEXT
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.attendance;
  v_new public.attendance;
  v_employee_name TEXT;
  v_editor_name TEXT;
  v_office_end TIME;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and HR can edit attendance';
  END IF;

  IF COALESCE(BTRIM(_reason), '') = '' THEN
    RAISE EXCEPTION 'Reason for change is required';
  END IF;

  SELECT * INTO v_old
  FROM public.attendance
  WHERE id = _attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

  SELECT full_name INTO v_employee_name
  FROM public.profiles
  WHERE user_id = v_old.user_id
  LIMIT 1;

  SELECT full_name INTO v_editor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT office_end_time::time INTO v_office_end
  FROM public.settings
  LIMIT 1;

  PERFORM set_config('attendance.audit_context', 'admin_edit', true);

  UPDATE public.attendance
  SET
    check_in_time = _check_in_time,
    check_out_time = _check_out_time,
    status = COALESCE(_status, v_old.status),
    work_location = COALESCE(NULLIF(BTRIM(_work_location), ''), 'Office'),
    work_hours = public.calculate_attendance_work_hours(_check_in_time, _check_out_time),
    is_late = COALESCE(_status, v_old.status) = 'late',
    is_early_checkout = CASE
      WHEN _check_out_time IS NULL THEN false
      WHEN COALESCE(_status, v_old.status) = 'half_day' THEN false
      ELSE (_check_out_time::time < COALESCE(v_office_end, '18:00'::time))
    END,
    is_edited = true,
    updated_at = now()
  WHERE id = _attendance_id
  RETURNING * INTO v_new;

  INSERT INTO public.attendance_audit_logs (
    attendance_id,
    employee_id,
    employee_name,
    original_value,
    updated_value,
    edited_by,
    edited_by_name,
    reason,
    source
  )
  VALUES (
    v_new.id,
    v_new.user_id,
    COALESCE(v_employee_name, 'Unknown employee'),
    public.attendance_edit_snapshot(v_old),
    public.attendance_edit_snapshot(v_new),
    auth.uid(),
    COALESCE(v_editor_name, 'Administrator'),
    BTRIM(_reason),
    'admin_edit'
  );

  UPDATE public.attendance_correction_requests
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_comment = COALESCE(NULLIF(admin_comment, ''), 'Completed after admin attendance edit.'),
    updated_at = now()
  WHERE attendance_id = v_new.id
    AND status = 'pending';

  RETURN v_new;
END;
$$;

UPDATE public.attendance_correction_requests request
SET
  status = 'approved',
  reviewed_at = COALESCE(request.reviewed_at, now()),
  admin_comment = COALESCE(NULLIF(request.admin_comment, ''), 'Completed after attendance audit edit.'),
  updated_at = now()
FROM public.attendance attendance
WHERE request.attendance_id = attendance.id
  AND request.status = 'pending'
  AND attendance.is_edited = true;
