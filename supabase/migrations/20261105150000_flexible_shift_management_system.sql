-- ============================================================================
-- ASLENIX HR MANAGEMENT SYSTEM: ADVANCED FLEXIBLE SHIFT & ATTENDANCE MODULE
-- ============================================================================

-- 1. Shifts Table
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL DEFAULT '18:00:00',
  grace_period_mins INT NOT NULL DEFAULT 10,
  checkout_grace_period_mins INT NOT NULL DEFAULT 0,
  break_duration_mins INT NOT NULL DEFAULT 60,
  working_days TEXT[] NOT NULL DEFAULT '{"Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for shifts.updated_at
CREATE TRIGGER trg_shifts_updated
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Employee Shift Assignments Table
CREATE TABLE IF NOT EXISTS public.employee_shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE, -- NULL means ongoing/current
  assigned_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'scheduled', 'temporary')),
  is_temporary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for employee_shift_assignments.updated_at
CREATE TRIGGER trg_employee_shift_assignments_updated
  BEFORE UPDATE ON public.employee_shift_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_id ON public.employee_shift_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift_id ON public.employee_shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_effective ON public.employee_shift_assignments(user_id, effective_from, effective_to);

-- 3. Extend Attendance Table with Shift & Duration Fields
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_check_in TIME,
  ADD COLUMN IF NOT EXISTS scheduled_check_out TIME,
  ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_checkout_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_working_minutes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_minutes INT NOT NULL DEFAULT 0;

-- 4. Seed Initial Shifts: Morning Shift (Shift A) & Afternoon Shift (Shift B)
INSERT INTO public.shifts (code, name, start_time, end_time, grace_period_mins, checkout_grace_period_mins, break_duration_mins, working_days, description, is_active, is_default)
VALUES
  (
    'SHIFT_A',
    'Shift A – Morning Shift',
    '09:00:00',
    '18:00:00',
    10,
    0,
    60,
    '{"Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"}',
    'Morning Shift: Reporting at 09:00 AM, Closing at 06:00 PM, 10-minute grace period. Expected duration 9 hours including breaks.',
    true,
    true
  ),
  (
    'SHIFT_B',
    'Shift B – Afternoon Shift',
    '13:00:00',
    '18:00:00',
    10,
    0,
    0,
    '{"Sunday","Monday","Tuesday","Wednesday","Thursday","Friday"}',
    'Afternoon Shift: Reporting at 01:00 PM, Closing at 06:00 PM, 10-minute grace period. Expected duration 5 hours.',
    true,
    false
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  grace_period_mins = EXCLUDED.grace_period_mins,
  break_duration_mins = EXCLUDED.break_duration_mins,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  is_default = EXCLUDED.is_default;

-- 5. Backfill Default Shift (Shift A) for All Existing Employees
DO $$
DECLARE
  v_default_shift_id UUID;
  v_emp RECORD;
BEGIN
  SELECT id INTO v_default_shift_id FROM public.shifts WHERE code = 'SHIFT_A' LIMIT 1;
  IF v_default_shift_id IS NOT NULL THEN
    FOR v_emp IN
      SELECT p.user_id, COALESCE(p.joining_date::date, p.created_at::date, '2026-01-01'::date) AS start_d
      FROM public.profiles p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.employee_shift_assignments esa WHERE esa.user_id = p.user_id
      )
    LOOP
      INSERT INTO public.employee_shift_assignments (user_id, shift_id, effective_from, status, notes)
      VALUES (v_emp.user_id, v_default_shift_id, v_emp.start_d, 'active', 'Initial system migration default assignment')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 6. Helper Function: Get Active Shift for Employee on a Specific Date
CREATE OR REPLACE FUNCTION public.get_employee_shift_for_date(_user_id UUID, _date DATE)
RETURNS TABLE (
  shift_id UUID,
  shift_code TEXT,
  shift_name TEXT,
  start_time TIME,
  end_time TIME,
  grace_period_mins INT,
  checkout_grace_period_mins INT,
  break_duration_mins INT,
  working_days TEXT[],
  assignment_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_default_shift RECORD;
BEGIN
  -- Look for active assignment matching date range
  SELECT esa.id AS assignment_id, s.id AS shift_id, s.code, s.name, s.start_time, s.end_time,
         s.grace_period_mins, s.checkout_grace_period_mins, s.break_duration_mins, s.working_days
  INTO v_assignment
  FROM public.employee_shift_assignments esa
  JOIN public.shifts s ON s.id = esa.shift_id
  WHERE esa.user_id = _user_id
    AND esa.status IN ('active', 'temporary')
    AND esa.effective_from <= _date
    AND (esa.effective_to IS NULL OR esa.effective_to >= _date)
  ORDER BY esa.is_temporary DESC, esa.effective_from DESC, esa.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    shift_id := v_assignment.shift_id;
    shift_code := v_assignment.code;
    shift_name := v_assignment.name;
    start_time := v_assignment.start_time;
    end_time := v_assignment.end_time;
    grace_period_mins := v_assignment.grace_period_mins;
    checkout_grace_period_mins := v_assignment.checkout_grace_period_mins;
    break_duration_mins := v_assignment.break_duration_mins;
    working_days := v_assignment.working_days;
    assignment_id := v_assignment.assignment_id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Fallback to default shift (Shift A)
  SELECT s.id, s.code, s.name, s.start_time, s.end_time, s.grace_period_mins,
         s.checkout_grace_period_mins, s.break_duration_mins, s.working_days
  INTO v_default_shift
  FROM public.shifts s
  WHERE s.is_default = true AND s.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT s.id, s.code, s.name, s.start_time, s.end_time, s.grace_period_mins,
           s.checkout_grace_period_mins, s.break_duration_mins, s.working_days
    INTO v_default_shift
    FROM public.shifts s
    WHERE s.is_active = true
    ORDER BY s.start_time ASC
    LIMIT 1;
  END IF;

  IF FOUND THEN
    shift_id := v_default_shift.id;
    shift_code := v_default_shift.code;
    shift_name := v_default_shift.name;
    start_time := v_default_shift.start_time;
    end_time := v_default_shift.end_time;
    grace_period_mins := v_default_shift.grace_period_mins;
    checkout_grace_period_mins := v_default_shift.checkout_grace_period_mins;
    break_duration_mins := v_default_shift.break_duration_mins;
    working_days := v_default_shift.working_days;
    assignment_id := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_shift_for_date(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_shift_for_date(UUID, DATE) TO anon;

-- 7. Update apply_admin_attendance_edit to use Employee Assigned Shift
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

  IF _check_in_time IS NOT NULL AND v_shift.start_time IS NOT NULL THEN
    v_check_in_local := (_check_in_time AT TIME ZONE 'Asia/Kathmandu')::time;
    v_late_threshold := (v_shift.start_time + (v_shift.grace_period_mins || ' minutes')::interval)::time;
    IF v_check_in_local > v_late_threshold THEN
      v_is_late := true;
      v_late_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_check_in_local - v_shift.start_time)) / 60));
    ELSE
      v_is_late := false;
      v_late_mins := 0;
    END IF;
  END IF;

  IF _check_out_time IS NOT NULL AND v_shift.end_time IS NOT NULL THEN
    v_check_out_local := (_check_out_time AT TIME ZONE 'Asia/Kathmandu')::time;
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

  IF _check_in_time IS NOT NULL AND _check_out_time IS NOT NULL AND _check_out_time > _check_in_time THEN
    v_work_mins := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (_check_out_time - _check_in_time)) / 60));
    v_work_hours := ROUND((v_work_mins::numeric / 60.0), 2);
  ELSE
    v_work_mins := 0;
    v_work_hours := 0;
  END IF;

  v_status := COALESCE(_status, CASE WHEN v_is_late THEN 'late' ELSE 'present' END);
  IF v_status = 'present' THEN
    v_is_late := false;
    v_late_mins := 0;
  ELSIF v_status = 'late' THEN
    v_is_late := true;
  END IF;

  PERFORM set_config('attendance.audit_context', 'admin_edit', true);

  UPDATE public.attendance
  SET
    check_in_time = _check_in_time,
    check_out_time = _check_out_time,
    status = v_status,
    work_location = COALESCE(NULLIF(BTRIM(_work_location), ''), 'Office'),
    work_hours = v_work_hours,
    is_late = v_is_late,
    is_early_checkout = CASE
      WHEN v_status IN ('present', 'half_day') AND _check_out_time IS NULL THEN false
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
    review_notes = 'Applied automatically via Admin edit: ' || BTRIM(_reason),
    updated_at = now()
  WHERE attendance_id = _attendance_id
    AND status = 'pending';

  RETURN v_new;
END;
$$;

-- 8. Enable Row Level Security (RLS) on New Tables
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;

-- Shifts RLS Policies
DROP POLICY IF EXISTS "shifts_select_authenticated" ON public.shifts;
CREATE POLICY "shifts_select_authenticated" ON public.shifts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "shifts_admin_all" ON public.shifts;
CREATE POLICY "shifts_admin_all" ON public.shifts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Employee Shift Assignments RLS Policies
DROP POLICY IF EXISTS "employee_shifts_select" ON public.employee_shift_assignments;
CREATE POLICY "employee_shifts_select" ON public.employee_shift_assignments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "employee_shifts_admin_all" ON public.employee_shift_assignments;
CREATE POLICY "employee_shifts_admin_all" ON public.employee_shift_assignments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 9. Realtime Publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_shift_assignments;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
