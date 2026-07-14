-- ALTER ENUMS TO ADD CONFLICT HANDLING STATUSES
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'half_day_present';
ALTER TYPE public.leave_status ADD VALUE IF NOT EXISTS 'half_day_approved';

-- ADD DELETED_AT TO ATTENDANCE FOR SOFT DELETES
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- REPLACE UNIQUE CONSTRAINT WITH PARTIAL UNIQUE INDEX FOR ACTIVE ATTENDANCE
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;
DROP INDEX IF EXISTS attendance_user_id_date_active_idx;
CREATE UNIQUE INDEX attendance_user_id_date_active_idx ON public.attendance (user_id, date) WHERE (deleted_at IS NULL);

-- UPDATE SELECT RLS POLICIES FOR ATTENDANCE
DROP POLICY IF EXISTS "view own attendance" ON public.attendance;
CREATE POLICY "view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "admins view all attendance" ON public.attendance;
CREATE POLICY "admins view all attendance" ON public.attendance FOR SELECT USING (public.is_admin(auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "update own attendance" ON public.attendance;
CREATE POLICY "update own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

-- CREATE LEAVE CONFLICT AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.leave_conflict_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  action_performed TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT,
  attendance_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_conflict_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view own leave conflict logs" ON public.leave_conflict_audit_logs;
CREATE POLICY "view own leave conflict logs" ON public.leave_conflict_audit_logs FOR SELECT 
  USING (auth.uid() = (SELECT user_id FROM public.leave_requests WHERE id = leave_id));

DROP POLICY IF EXISTS "admins view all leave conflict logs" ON public.leave_conflict_audit_logs;
CREATE POLICY "admins view all leave conflict logs" ON public.leave_conflict_audit_logs FOR SELECT 
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins manage leave conflict logs" ON public.leave_conflict_audit_logs;
CREATE POLICY "admins manage leave conflict logs" ON public.leave_conflict_audit_logs FOR ALL 
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RPC RESOLUTION FUNCTION
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
  v_balance NUMERIC;
  v_admin_name TEXT;
  v_employee_name TEXT;
  v_attendance_snapshots JSONB;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
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

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'date', date,
      'check_in_time', check_in_time,
      'check_out_time', check_out_time,
      'work_hours', work_hours,
      'status', status
    )
  ) INTO v_attendance_snapshots
  FROM public.attendance
  WHERE user_id = v_leave.user_id
    AND date >= v_leave.start_date
    AND date <= v_leave.end_date
    AND deleted_at IS NULL;

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
    VALUES (p_admin_id, 'reject_leave_with_conflict', jsonb_build_object(
      'leave_id', p_leave_id,
      'employee_id', v_leave.user_id,
      'reason', p_reason,
      'attendance_details', v_attendance_snapshots
    ));

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_leave.user_id, 'Leave Rejected', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been rejected due to attendance conflict.', 'warning');

  ELSIF p_action = 'delete_attendance_approve_leave' THEN
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
      SELECT balance - used INTO v_balance
      FROM public.leave_balances
      WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;

      IF v_balance IS NULL THEN
        INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
        VALUES (v_leave.user_id, v_leave.leave_type, 0, v_days_to_deduct);
      ELSIF v_balance < v_days_to_deduct THEN
        RAISE EXCEPTION 'Insufficient leave balance (Required: %, Available: %)', v_days_to_deduct, v_balance;
      ELSE
        UPDATE public.leave_balances
        SET used = used + v_days_to_deduct
        WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
      END IF;
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
    VALUES (p_admin_id, 'approve_leave_with_conflict_delete_attendance', jsonb_build_object(
      'leave_id', p_leave_id,
      'employee_id', v_leave.user_id,
      'reason', p_reason,
      'attendance_details', v_attendance_snapshots
    ));

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_leave.user_id, 'Leave Approved', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been approved. Conflicting attendance was removed.', 'success');

  ELSIF p_action = 'convert_to_half_day_leave' THEN
    UPDATE public.attendance
    SET status = 'half_day_present',
        remarks = 'Converted to Half-Day due to leave conflict'
    WHERE user_id = v_leave.user_id
      AND date >= v_leave.start_date
      AND date <= v_leave.end_date
      AND deleted_at IS NULL;

    UPDATE public.leave_requests
    SET status = 'half_day_approved',
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
      SELECT balance - used INTO v_balance
      FROM public.leave_balances
      WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;

      IF v_balance IS NULL THEN
        INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
        VALUES (v_leave.user_id, v_leave.leave_type, 0, v_days_to_deduct);
      ELSIF v_balance < v_days_to_deduct THEN
        RAISE EXCEPTION 'Insufficient leave balance (Required: %, Available: %)', v_days_to_deduct, v_balance;
      ELSE
        UPDATE public.leave_balances
        SET used = used + v_days_to_deduct
        WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
      END IF;
    END IF;

    INSERT INTO public.leave_conflict_audit_logs (
      leave_id, action_performed, performed_by, performed_by_name,
      previous_status, new_status, reason, attendance_details
    ) VALUES (
      p_leave_id, p_action, p_admin_id, COALESCE(v_admin_name, 'Admin'),
      'pending', 'half_day_approved', p_reason, v_attendance_snapshots
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

-- RPC REVERSION FUNCTION
CREATE OR REPLACE FUNCTION public.revert_leave_conflict_resolution(
  p_leave_id UUID,
  p_admin_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_log RECORD;
  v_date DATE;
  v_day_of_week INT;
  v_is_holiday BOOLEAN;
  v_is_weekend BOOLEAN;
  v_days_to_restore NUMERIC := 0;
BEGIN
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF v_leave IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  SELECT * INTO v_log FROM public.leave_conflict_audit_logs WHERE leave_id = p_leave_id ORDER BY created_at DESC LIMIT 1;
  IF v_log IS NULL THEN
    RAISE EXCEPTION 'No conflict resolution log found for this leave request';
  END IF;

  UPDATE public.leave_requests
  SET status = 'pending',
      admin_comment = NULL,
      reviewed_by = NULL,
      updated_at = now()
  WHERE id = p_leave_id;

  IF v_log.new_status = 'approved' THEN
    FOR v_date IN
      SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
      v_day_of_week := EXTRACT(ISODOW FROM v_date);
      v_is_weekend := v_day_of_week IN (6, 7);

      IF NOT v_is_holiday AND NOT v_is_weekend THEN
        v_days_to_restore := v_days_to_restore + (CASE WHEN v_leave.is_half_day THEN 0.5 ELSE 1 END);
      END IF;
    END LOOP;
  ELSIF v_log.new_status = 'half_day_approved' THEN
    FOR v_date IN
      SELECT generate_series(v_leave.start_date, v_leave.end_date, '1 day'::interval)::DATE
    LOOP
      SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = v_date AND is_active = true) INTO v_is_holiday;
      v_day_of_week := EXTRACT(ISODOW FROM v_date);
      v_is_weekend := v_day_of_week IN (6, 7);

      IF NOT v_is_holiday AND NOT v_is_weekend THEN
        v_days_to_restore := v_days_to_restore + 0.5;
      END IF;
    END LOOP;
  END IF;

  IF v_days_to_restore > 0 THEN
    UPDATE public.leave_balances
    SET used = GREATEST(used - v_days_to_restore, 0)
    WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
  END IF;

  IF v_log.action_performed = 'delete_attendance_approve_leave' THEN
    UPDATE public.attendance
    SET deleted_at = NULL
    WHERE user_id = v_leave.user_id
      AND date >= v_leave.start_date
      AND date <= v_leave.end_date
      AND deleted_at IS NOT NULL;

    DELETE FROM public.attendance
    WHERE user_id = v_leave.user_id
      AND date >= v_leave.start_date
      AND date <= v_leave.end_date
      AND status = 'leave'
      AND deleted_at IS NULL;

  ELSIF v_log.action_performed = 'convert_to_half_day_leave' THEN
    DECLARE
      v_snapshot RECORD;
      v_att_item JSONB;
    BEGIN
      FOR v_att_item IN SELECT * FROM jsonb_array_elements(v_log.attendance_details)
      LOOP
        UPDATE public.attendance
        SET status = (v_att_item->>'status')::public.attendance_status,
            remarks = 'Reverted from Half-Day'
        WHERE id = (v_att_item->>'id')::UUID;
      END LOOP;
    END;
  END IF;

  DELETE FROM public.leave_conflict_audit_logs WHERE id = v_log.id;

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_admin_id, 'revert_leave_conflict_resolution', jsonb_build_object(
    'leave_id', p_leave_id,
    'employee_id', v_leave.user_id,
    'reverted_action', v_log.action_performed
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_leave_attendance_conflict(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revert_leave_conflict_resolution(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
