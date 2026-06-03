ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS work_location TEXT NOT NULL DEFAULT 'Office',
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  original_value JSONB NOT NULL,
  updated_value JSONB NOT NULL,
  edited_by UUID NOT NULL,
  edited_by_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'admin_edit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  requested_check_in_time TIMESTAMPTZ,
  requested_check_out_time TIMESTAMPTZ,
  requested_status public.attendance_status,
  requested_work_location TEXT,
  reason TEXT NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  admin_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_correction_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view attendance audit logs"
ON public.attendance_audit_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "employees view own attendance audit logs"
ON public.attendance_audit_logs
FOR SELECT
USING (auth.uid() = employee_id);

CREATE POLICY "admins view correction requests"
ON public.attendance_correction_requests
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "employees view own correction requests"
ON public.attendance_correction_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "employees create own correction requests"
ON public.attendance_correction_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "admins update correction requests"
ON public.attendance_correction_requests
FOR UPDATE
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.attendance_edit_snapshot(_row public.attendance)
RETURNS JSONB
LANGUAGE SQL
STABLE
AS $$
  SELECT jsonb_build_object(
    'check_in_time', _row.check_in_time,
    'check_out_time', _row.check_out_time,
    'status', _row.status,
    'work_location', _row.work_location,
    'work_hours', _row.work_hours,
    'is_late', _row.is_late,
    'is_early_checkout', _row.is_early_checkout
  );
$$;

CREATE OR REPLACE FUNCTION public.calculate_attendance_work_hours(
  _check_in TIMESTAMPTZ,
  _check_out TIMESTAMPTZ
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _check_in IS NULL OR _check_out IS NULL OR _check_out <= _check_in THEN NULL
    ELSE ROUND((EXTRACT(EPOCH FROM (_check_out - _check_in)) / 3600)::numeric, 2)
  END;
$$;

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
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and HR can approve correction requests';
  END IF;

  SELECT * INTO v_request
  FROM public.attendance_correction_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Correction request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Correction request has already been reviewed';
  END IF;

  SELECT * INTO v_old
  FROM public.attendance
  WHERE id = v_request.attendance_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found';
  END IF;

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
    check_in_time = COALESCE(v_request.requested_check_in_time, v_old.check_in_time),
    check_out_time = COALESCE(v_request.requested_check_out_time, v_old.check_out_time),
    status = COALESCE(v_request.requested_status, v_old.status),
    work_location = COALESCE(NULLIF(BTRIM(v_request.requested_work_location), ''), v_old.work_location, 'Office'),
    work_hours = public.calculate_attendance_work_hours(
      COALESCE(v_request.requested_check_in_time, v_old.check_in_time),
      COALESCE(v_request.requested_check_out_time, v_old.check_out_time)
    ),
    is_late = COALESCE(v_request.requested_status, v_old.status) = 'late',
    is_early_checkout = CASE
      WHEN COALESCE(v_request.requested_check_out_time, v_old.check_out_time) IS NULL THEN false
      WHEN COALESCE(v_request.requested_status, v_old.status) = 'half_day' THEN false
      ELSE (COALESCE(v_request.requested_check_out_time, v_old.check_out_time)::time < COALESCE(v_office_end, '18:00'::time))
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

CREATE OR REPLACE FUNCTION public.reject_attendance_correction_request(
  _request_id UUID,
  _admin_comment TEXT DEFAULT NULL
)
RETURNS public.attendance_correction_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.attendance_correction_requests;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and HR can reject correction requests';
  END IF;

  UPDATE public.attendance_correction_requests
  SET
    status = 'rejected',
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_comment = _admin_comment,
    updated_at = now()
  WHERE id = _request_id
    AND status = 'pending'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending correction request not found';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_request.user_id,
    'Attendance correction rejected',
    COALESCE(NULLIF(BTRIM(_admin_comment), ''), 'Your attendance correction request was rejected.'),
    'warning'
  );

  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.restrict_employee_attendance_direct_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    IF current_setting('attendance.audit_context', true) IS NULL
      AND public.attendance_edit_snapshot(OLD) IS DISTINCT FROM public.attendance_edit_snapshot(NEW) THEN
      RAISE EXCEPTION 'Use the audited attendance edit workflow';
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() <> OLD.user_id THEN
    RAISE EXCEPTION 'Attendance updates are not allowed';
  END IF;

  IF OLD.check_out_time IS NOT NULL THEN
    RAISE EXCEPTION 'Submit a correction request to change completed attendance';
  END IF;

  IF NEW.user_id <> OLD.user_id
    OR NEW.date <> OLD.date
    OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.work_location IS DISTINCT FROM OLD.work_location
    OR NEW.remarks IS DISTINCT FROM OLD.remarks
    OR NEW.is_late IS DISTINCT FROM OLD.is_late
    OR NEW.is_edited IS DISTINCT FROM OLD.is_edited THEN
    RAISE EXCEPTION 'Submit a correction request to edit attendance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_employee_attendance_direct_edits ON public.attendance;
CREATE TRIGGER restrict_employee_attendance_direct_edits
BEFORE UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.restrict_employee_attendance_direct_edits();

GRANT EXECUTE ON FUNCTION public.apply_admin_attendance_edit(UUID, TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_attendance_correction_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_attendance_correction_request(UUID, TEXT) TO authenticated;
