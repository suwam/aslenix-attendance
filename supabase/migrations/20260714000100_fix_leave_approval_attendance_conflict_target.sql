-- Fix leave approval attendance upserts after attendance soft deletes.
--
-- 20260714000000_attendance_conflict_handling.sql replaced the old
-- attendance(user_id, date) unique constraint with a partial unique index for
-- active rows only:
--   attendance_user_id_date_active_idx ON (user_id, date) WHERE deleted_at IS NULL
--
-- The normal approval RPC still used ON CONFLICT (user_id, date), which no
-- longer matches any full unique/exclusion constraint. PostgreSQL requires the
-- conflict target to include the partial-index predicate.

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
  v_balance NUMERIC;
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

  UPDATE public.leave_requests
  SET status = 'approved',
      admin_comment = p_comment,
      reviewed_by = p_admin_id
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
