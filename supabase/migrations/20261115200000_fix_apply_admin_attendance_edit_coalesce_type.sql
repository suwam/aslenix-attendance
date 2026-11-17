-- Migration: Fix COALESCE type mismatch in apply_admin_attendance_edit
-- Description: Replaces untyped COALESCE(_status, CASE WHEN ...) with type-safe handling of
-- public.attendance_status, avoiding PostgreSQL error 42804 ("COALESCE types attendance_status and text cannot be matched").
-- Also cleans up timestamps and flags when status is set to 'absent' or 'leave'.

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
  v_shift RECORD;
  v_status public.attendance_status;
  v_is_late BOOLEAN := false;
  v_late_mins INT := 0;
  v_is_early BOOLEAN := false;
  v_early_mins INT := 0;
  v_work_mins INT := 0;
  v_work_hours NUMERIC := 0;
  v_overtime_mins INT := 0;
  v_check_in_local TIME;
  v_check_out_local TIME;
  v_late_threshold TIME;
  v_early_threshold TIME;
  v_effective_check_in TIMESTAMPTZ;
  v_effective_check_out TIMESTAMPTZ;
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

  -- Retrieve shift applicable to this employee on this attendance date
  SELECT * INTO v_shift
  FROM public.get_employee_shift_for_date(v_old.user_id, v_old.date)
  LIMIT 1;

  -- Resolve attendance status with strict type safety (no enum/text COALESCE mismatch)
  IF _status IS NOT NULL THEN
    v_status := _status;
  ELSIF v_old.status IS NOT NULL THEN
    v_status := v_old.status;
  ELSE
    v_status := 'present'::public.attendance_status;
  END IF;

  -- If marked absent or leave, clear check-in / check-out times and all duration metrics
  IF v_status IN ('absent', 'leave') THEN
    v_effective_check_in := NULL;
    v_effective_check_out := NULL;
    v_is_late := false;
    v_late_mins := 0;
    v_is_early := false;
    v_early_mins := 0;
    v_work_mins := 0;
    v_work_hours := 0;
    v_overtime_mins := 0;
  ELSE
    v_effective_check_in := _check_in_time;
    v_effective_check_out := _check_out_time;

    -- Calculate check-in metrics against assigned shift
    IF v_effective_check_in IS NOT NULL AND v_shift.start_time IS NOT NULL THEN
      v_check_in_local := (v_effective_check_in AT TIME ZONE 'Asia/Kathmandu')::time;
      v_late_threshold := (v_shift.start_time + (v_shift.grace_period_mins || ' minutes')::interval)::time;
      IF v_check_in_local > v_late_threshold THEN
        v_is_late := true;
        v_late_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_check_in_local - v_shift.start_time)) / 60));
      ELSE
        v_is_late := false;
        v_late_mins := 0;
      END IF;
    END IF;

    -- Calculate check-out metrics against assigned shift
    IF v_effective_check_out IS NOT NULL AND v_shift.end_time IS NOT NULL THEN
      v_check_out_local := (v_effective_check_out AT TIME ZONE 'Asia/Kathmandu')::time;
      v_early_threshold := (v_shift.end_time - (COALESCE(v_shift.checkout_grace_period_mins, 0) || ' minutes')::interval)::time;
      IF v_check_out_local < v_early_threshold THEN
        v_is_early := true;
        v_early_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_shift.end_time - v_check_out_local)) / 60));
      ELSE
        v_is_early := false;
        v_early_mins := 0;
        IF v_check_out_local > v_shift.end_time THEN
          v_overtime_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_check_out_local - v_shift.end_time)) / 60));
        END IF;
      END IF;
    END IF;

    -- Calculate total working time
    IF v_effective_check_in IS NOT NULL AND v_effective_check_out IS NOT NULL AND v_effective_check_out > v_effective_check_in THEN
      v_work_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_effective_check_out - v_effective_check_in)) / 60));
      v_work_hours := ROUND((v_work_mins::numeric / 60.0), 2);
    ELSE
      v_work_mins := 0;
      v_work_hours := 0;
    END IF;

    -- If no explicit status was supplied, infer late vs present
    IF _status IS NULL THEN
      IF v_is_late THEN
        v_status := 'late'::public.attendance_status;
      ELSE
        v_status := 'present'::public.attendance_status;
      END IF;
    ELSIF v_status = 'present' THEN
      v_is_late := false;
      v_late_mins := 0;
    ELSIF v_status = 'late' THEN
      v_is_late := true;
    END IF;
  END IF;

  PERFORM set_config('attendance.audit_context', 'admin_edit', true);

  UPDATE public.attendance
  SET
    check_in_time = v_effective_check_in,
    check_out_time = v_effective_check_out,
    status = v_status,
    work_location = COALESCE(NULLIF(BTRIM(_work_location), ''), 'Office'),
    work_hours = v_work_hours,
    is_late = v_is_late,
    is_early_checkout = CASE
      WHEN v_status IN ('absent', 'leave') THEN false
      WHEN v_status IN ('present', 'half_day') AND v_effective_check_out IS NULL THEN false
      WHEN v_status = 'present' AND NOT v_is_early THEN false
      ELSE v_is_early
    END,
    shift_id = COALESCE(shift_id, v_shift.shift_id),
    shift_name_snapshot = COALESCE(shift_name_snapshot, v_shift.shift_name),
    scheduled_check_in = COALESCE(scheduled_check_in, v_shift.start_time),
    scheduled_check_out = COALESCE(scheduled_check_out, v_shift.end_time),
    late_minutes = v_late_mins,
    early_checkout_minutes = v_early_mins,
    total_working_minutes = v_work_mins,
    overtime_minutes = v_overtime_mins,
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
    admin_comment = 'Applied automatically via Admin edit: ' || BTRIM(_reason),
    updated_at = now()
  WHERE attendance_id = _attendance_id
    AND status = 'pending';

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_admin_attendance_edit(UUID, TIMESTAMPTZ, TIMESTAMPTZ, public.attendance_status, TEXT, TEXT) TO authenticated;

