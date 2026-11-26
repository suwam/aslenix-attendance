-- Migration: Set 24-day annual leave quota, allow unlimited leaves without error blocks
-- (2 days paid per month, beyond 24 days or 2 days/mo it counts as unpaid, never blocking approval)

-- 1. Ensure all employee leave balances have at least 24 days quota (50 for vacation)
UPDATE public.leave_balances
SET balance = GREATEST(balance, 24)
WHERE leave_type != 'vacation';

UPDATE public.leave_balances
SET balance = GREATEST(balance, 50)
WHERE leave_type = 'vacation';

-- 2. Backfill missing leave_balances for all users
INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
SELECT p.user_id, lt.t::public.leave_type, 24, 0
FROM public.profiles p
CROSS JOIN (VALUES ('casual'), ('sick'), ('emergency'), ('wfh')) AS lt(t)
ON CONFLICT (user_id, leave_type) DO UPDATE
SET balance = GREATEST(public.leave_balances.balance, 24);

INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
SELECT p.user_id, 'vacation'::public.leave_type, 50, 0
FROM public.profiles p
ON CONFLICT (user_id, leave_type) DO UPDATE
SET balance = GREATEST(public.leave_balances.balance, 50);

-- 3. Update approve_leave_request to never throw Insufficient leave balance
CREATE OR REPLACE FUNCTION public.approve_leave_request(p_leave_id UUID, p_admin_id UUID, p_comment TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_date DATE;
  v_day_of_week INT;
  v_is_holiday BOOLEAN;
  v_is_weekend BOOLEAN;
  v_days_to_deduct NUMERIC := 0;
  v_default_quota NUMERIC := 24;
BEGIN
  -- Permission check: Allow Super Admin, Admin, or HR Manager
  IF NOT (
    public.is_admin(p_admin_id) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = p_admin_id AND role IN ('super_admin', 'admin', 'hr_manager')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF v_leave IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_leave.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending';
  END IF;

  FOR v_date IN
    SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
    v_day_of_week := EXTRACT(ISODOW FROM v_date);
    v_is_weekend := v_day_of_week IN (6, 7);

    IF NOT v_is_holiday AND NOT v_is_weekend THEN
      v_days_to_deduct := v_days_to_deduct + (CASE WHEN v_leave.is_half_day THEN 0.5 ELSE 1 END);
    END IF;
  END LOOP;

  IF v_days_to_deduct > 0 THEN
    v_default_quota := CASE WHEN v_leave.leave_type = 'vacation' THEN 50 ELSE 24 END;

    -- Ensure record exists with 24 quota and update used days. Never block with Insufficient leave balance.
    INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
    VALUES (v_leave.user_id, v_leave.leave_type, v_default_quota, v_days_to_deduct)
    ON CONFLICT (user_id, leave_type) DO UPDATE
    SET balance = GREATEST(public.leave_balances.balance, v_default_quota),
        used = public.leave_balances.used + v_days_to_deduct;
  END IF;

  UPDATE public.leave_requests
  SET status = 'approved',
      admin_comment = p_comment,
      reviewed_by = p_admin_id,
      updated_at = now()
  WHERE id = p_leave_id;

  FOR v_date IN
    SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
    v_day_of_week := EXTRACT(ISODOW FROM v_date);
    v_is_weekend := v_day_of_week IN (6, 7);

    INSERT INTO public.attendance (user_id, date, status, remarks)
    VALUES (
      v_leave.user_id,
      v_date,
      CASE
        WHEN v_is_holiday THEN 'holiday'::public.attendance_status
        WHEN v_is_weekend THEN 'weekend'::public.attendance_status
        ELSE (CASE WHEN v_leave.is_half_day THEN 'half_day'::public.attendance_status ELSE 'leave'::public.attendance_status END)
      END,
      'Approved Leave'
    )
    ON CONFLICT (user_id, date) WHERE (deleted_at IS NULL) DO UPDATE SET
      status = CASE
        WHEN v_is_holiday THEN 'holiday'::public.attendance_status
        WHEN v_is_weekend THEN 'weekend'::public.attendance_status
        ELSE (CASE WHEN v_leave.is_half_day THEN 'half_day'::public.attendance_status ELSE 'leave'::public.attendance_status END)
      END,
      remarks = EXCLUDED.remarks;
  END LOOP;

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_admin_id, 'approve_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'start_date', v_leave.start_date, 'end_date', v_leave.end_date));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_leave.user_id, 'Leave Approved', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been approved.', 'success');
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_leave_request(UUID, UUID, TEXT) TO authenticated;

-- 4. Update resolve_leave_attendance_conflict to never throw Insufficient leave balance
CREATE OR REPLACE FUNCTION public.resolve_leave_attendance_conflict(
  p_leave_id UUID,
  p_admin_id UUID,
  p_action TEXT,
  p_comment TEXT,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_date DATE;
  v_day_of_week INT;
  v_is_holiday BOOLEAN;
  v_is_weekend BOOLEAN;
  v_days_to_deduct NUMERIC := 0;
  v_admin_name TEXT;
  v_employee_name TEXT;
  v_attendance_snapshots JSONB;
  v_default_quota NUMERIC := 24;
BEGIN
  IF NOT (
    public.is_admin(p_admin_id) OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = p_admin_id AND role IN ('super_admin', 'admin', 'hr_manager')
    )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF v_leave IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_leave.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending';
  END IF;

  SELECT full_name INTO v_admin_name FROM public.profiles WHERE user_id = p_admin_id;
  SELECT full_name INTO v_employee_name FROM public.profiles WHERE user_id = v_leave.user_id;

  SELECT jsonb_agg(to_jsonb(a)) INTO v_attendance_snapshots
  FROM public.attendance a
  WHERE a.user_id = v_leave.user_id
    AND a.date >= v_leave.start_date
    AND a.date <= v_leave.end_date
    AND a.deleted_at IS NULL;

  v_default_quota := CASE WHEN v_leave.leave_type = 'vacation' THEN 50 ELSE 24 END;

  IF p_action = 'keep_attendance_reject_leave' THEN
    UPDATE public.leave_requests
    SET status = 'rejected',
        admin_comment = p_comment,
        reviewed_by = p_admin_id,
        updated_at = now()
    WHERE id = p_leave_id;

    INSERT INTO public.leave_conflict_audit_logs (
      leave_id, action_performed, performed_by, performed_by_name,
      previous_status, new_status, reason, attendance_details
    ) VALUES (
      p_leave_id, p_action, p_admin_id, COALESCE(v_admin_name, 'Admin'),
      'pending', 'rejected', p_reason, v_attendance_snapshots
    );

    INSERT INTO public.activity_logs (user_id, action, details)
    VALUES (p_admin_id, 'reject_leave_conflict', jsonb_build_object(
      'leave_id', p_leave_id,
      'employee_id', v_leave.user_id,
      'reason', p_reason
    ));

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_leave.user_id, 'Leave Request Rejected', 'Your leave request was rejected due to existing attendance records.', 'info');

  ELSIF p_action = 'override_attendance_approve_leave' THEN
    FOR v_date IN
      SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
      v_day_of_week := EXTRACT(ISODOW FROM v_date);
      v_is_weekend := v_day_of_week IN (6, 7);

      IF NOT v_is_holiday AND NOT v_is_weekend THEN
        v_days_to_deduct := v_days_to_deduct + (CASE WHEN v_leave.is_half_day THEN 0.5 ELSE 1 END);
      END IF;
    END LOOP;

    IF v_days_to_deduct > 0 THEN
      INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
      VALUES (v_leave.user_id, v_leave.leave_type, v_default_quota, v_days_to_deduct)
      ON CONFLICT (user_id, leave_type) DO UPDATE
      SET balance = GREATEST(public.leave_balances.balance, v_default_quota),
          used = public.leave_balances.used + v_days_to_deduct;
    END IF;

    UPDATE public.attendance
    SET deleted_at = now()
    WHERE user_id = v_leave.user_id
      AND date >= v_leave.start_date
      AND date <= v_leave.end_date
      AND deleted_at IS NULL;

    DECLARE
      v_att_rec RECORD;
    BEGIN
      FOR v_att_rec IN
        SELECT * FROM public.attendance
        WHERE user_id = v_leave.user_id
          AND date >= v_leave.start_date
          AND date <= v_leave.end_date
          AND deleted_at IS NOT NULL
          AND deleted_at >= now() - interval '10 seconds'
      LOOP
        INSERT INTO public.attendance_audit_logs (
          attendance_id, employee_id, employee_name,
          original_value, updated_value, edited_by, edited_by_name, reason, source
        ) VALUES (
          v_att_rec.id, v_leave.user_id, COALESCE(v_employee_name, 'Employee'),
          jsonb_build_object('status', v_att_rec.status, 'deleted_at', null),
          jsonb_build_object('status', v_att_rec.status, 'deleted_at', v_att_rec.deleted_at),
          p_admin_id, COALESCE(v_admin_name, 'Admin'), p_reason, 'conflict_soft_delete'
        );
      END LOOP;
    END;

    UPDATE public.leave_requests
    SET status = 'approved',
        admin_comment = p_comment,
        reviewed_by = p_admin_id,
        updated_at = now()
    WHERE id = p_leave_id;

    FOR v_date IN
      SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
      v_day_of_week := EXTRACT(ISODOW FROM v_date);
      v_is_weekend := v_day_of_week IN (6, 7);

      INSERT INTO public.attendance (user_id, date, status, remarks)
      VALUES (
        v_leave.user_id,
        v_date,
        CASE
          WHEN v_is_holiday THEN 'holiday'::public.attendance_status
          WHEN v_is_weekend THEN 'weekend'::public.attendance_status
          ELSE (CASE WHEN v_leave.is_half_day THEN 'half_day'::public.attendance_status ELSE 'leave'::public.attendance_status END)
        END,
        'Approved Leave (Overrode Attendance)'
      )
      ON CONFLICT (user_id, date) WHERE (deleted_at IS NULL) DO UPDATE SET
        status = CASE
          WHEN v_is_holiday THEN 'holiday'::public.attendance_status
          WHEN v_is_weekend THEN 'weekend'::public.attendance_status
          ELSE (CASE WHEN v_leave.is_half_day THEN 'half_day'::public.attendance_status ELSE 'leave'::public.attendance_status END)
        END,
        remarks = EXCLUDED.remarks;
    END LOOP;

    INSERT INTO public.leave_conflict_audit_logs (
      leave_id, action_performed, performed_by, performed_by_name,
      previous_status, new_status, reason, attendance_details
    ) VALUES (
      p_leave_id, p_action, p_admin_id, COALESCE(v_admin_name, 'Admin'),
      'pending', 'approved', p_reason, v_attendance_snapshots
    );

    INSERT INTO public.activity_logs (user_id, action, details)
    VALUES (p_admin_id, 'approve_leave_conflict', jsonb_build_object(
      'leave_id', p_leave_id,
      'employee_id', v_leave.user_id,
      'reason', p_reason
    ));

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_leave.user_id, 'Leave Approved', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been approved.', 'success');

  ELSIF p_action = 'convert_to_half_day' THEN
    v_days_to_deduct := 0;
    UPDATE public.leave_requests
    SET is_half_day = true,
        half_day_session = 'morning',
        status = 'approved',
        admin_comment = p_comment,
        reviewed_by = p_admin_id,
        updated_at = now()
    WHERE id = p_leave_id;

    FOR v_date IN
      SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
      v_day_of_week := EXTRACT(ISODOW FROM v_date);
      v_is_weekend := v_day_of_week IN (6, 7);

      IF NOT v_is_holiday AND NOT v_is_weekend THEN
        v_days_to_deduct := v_days_to_deduct + 0.5;
      END IF;
    END LOOP;

    IF v_days_to_deduct > 0 THEN
      INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
      VALUES (v_leave.user_id, v_leave.leave_type, v_default_quota, v_days_to_deduct)
      ON CONFLICT (user_id, leave_type) DO UPDATE
      SET balance = GREATEST(public.leave_balances.balance, v_default_quota),
          used = public.leave_balances.used + v_days_to_deduct;
    END IF;

    INSERT INTO public.leave_conflict_audit_logs (
      leave_id, action_performed, performed_by, performed_by_name,
      previous_status, new_status, reason, attendance_details
    ) VALUES (
      p_leave_id, p_action, p_admin_id, COALESCE(v_admin_name, 'Admin'),
      'pending', 'approved', p_reason, v_attendance_snapshots
    );

    INSERT INTO public.activity_logs (user_id, action, details)
    VALUES (p_admin_id, 'convert_leave_to_half_day_conflict', jsonb_build_object(
      'leave_id', p_leave_id,
      'employee_id', v_leave.user_id,
      'reason', p_reason,
      'attendance_details', v_attendance_snapshots
    ));

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_leave.user_id, 'Leave Approved as Half-Day', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been approved as a half-day leave.', 'success');

  ELSE
    RAISE EXCEPTION 'Invalid resolution action';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_leave_attendance_conflict(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
