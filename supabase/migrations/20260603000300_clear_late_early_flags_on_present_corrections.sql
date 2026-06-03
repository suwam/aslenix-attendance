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
  v_status public.attendance_status;
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

  v_status := COALESCE(_status, v_old.status);

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
    status = v_status,
    work_location = COALESCE(NULLIF(BTRIM(_work_location), ''), 'Office'),
    work_hours = public.calculate_attendance_work_hours(_check_in_time, _check_out_time),
    is_late = v_status = 'late',
    is_early_checkout = CASE
      WHEN v_status = 'present' THEN false
      WHEN _check_out_time IS NULL THEN false
      WHEN v_status = 'half_day' THEN false
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

CREATE OR REPLACE FUNCTION public.approve_attendance_correction_request(
  _request_id UUID,
  _admin_comment TEXT DEFAULT NULL
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.attendance_correction_requests;
  v_old public.attendance;
  v_new public.attendance;
  v_editor_name TEXT;
  v_office_end TIME;
  v_check_in TIMESTAMPTZ;
  v_check_out TIMESTAMPTZ;
  v_status public.attendance_status;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and HR can approve attendance corrections';
  END IF;

  SELECT * INTO v_request
  FROM public.attendance_correction_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'This correction request has already been reviewed';
  END IF;

  SELECT * INTO v_old
  FROM public.attendance
  WHERE id = v_request.attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

  v_check_in := COALESCE(v_request.requested_check_in_time, v_old.check_in_time);
  v_check_out := COALESCE(v_request.requested_check_out_time, v_old.check_out_time);
  v_status := COALESCE(v_request.requested_status, v_old.status);

  SELECT full_name INTO v_editor_name
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT office_end_time::time INTO v_office_end
  FROM public.settings
  LIMIT 1;

  PERFORM set_config('attendance.audit_context', 'employee_request', true);

  UPDATE public.attendance
  SET
    check_in_time = v_check_in,
    check_out_time = v_check_out,
    status = v_status,
    work_location = COALESCE(NULLIF(BTRIM(v_request.requested_work_location), ''), v_old.work_location, 'Office'),
    work_hours = public.calculate_attendance_work_hours(v_check_in, v_check_out),
    is_late = v_status = 'late',
    is_early_checkout = CASE
      WHEN v_status = 'present' THEN false
      WHEN v_check_out IS NULL THEN false
      WHEN v_status = 'half_day' THEN false
      ELSE (v_check_out::time < COALESCE(v_office_end, '18:00'::time))
    END,
    is_edited = true,
    updated_at = now()
  WHERE id = v_old.id
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
    v_request.employee_name,
    public.attendance_edit_snapshot(v_old),
    public.attendance_edit_snapshot(v_new),
    auth.uid(),
    COALESCE(v_editor_name, 'Administrator'),
    v_request.reason,
    'employee_request'
  );

  UPDATE public.attendance_correction_requests
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_comment = _admin_comment,
    updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_request.user_id,
    'Attendance correction approved',
    'Your attendance correction request has been approved and applied.',
    'success'
  );

  RETURN v_new;
END;
$$;

UPDATE public.attendance
SET
  is_late = false,
  is_early_checkout = false,
  updated_at = now()
WHERE is_edited = true
  AND status = 'present'
  AND (is_late = true OR is_early_checkout = true);
