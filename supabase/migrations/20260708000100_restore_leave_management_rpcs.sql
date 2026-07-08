-- Ensure PostgREST can resolve the leave management RPCs by the parameter
-- names used by the frontend: p_leave_id, p_admin_id, and p_comment.

DROP FUNCTION IF EXISTS public.modify_leave_request(UUID, UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.cancel_leave_request(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_leave_request(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.approve_leave_request(UUID, UUID, TEXT);

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
    ON CONFLICT (user_id, date) DO UPDATE SET
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

CREATE OR REPLACE FUNCTION public.reject_leave_request(p_leave_id UUID, p_admin_id UUID, p_comment TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
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

  UPDATE public.leave_requests
  SET status = 'rejected',
      admin_comment = p_comment,
      reviewed_by = p_admin_id
  WHERE id = p_leave_id;

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_admin_id, 'reject_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'comment', p_comment));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_leave.user_id, 'Leave Rejected', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been rejected.', 'warning');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_leave_id UUID, p_user_id UUID, p_comment TEXT)
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
  v_days_to_restore NUMERIC := 0;
BEGIN
  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF v_leave IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_leave.user_id != p_user_id AND NOT public.is_admin(p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_leave.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved leaves can be cancelled to restore balance';
  END IF;

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

  IF v_days_to_restore > 0 THEN
    UPDATE public.leave_balances
    SET used = GREATEST(used - v_days_to_restore, 0)
    WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
  END IF;

  UPDATE public.leave_requests
  SET status = 'cancelled',
      admin_comment = COALESCE(admin_comment, '') || E'\nCancelled: ' || p_comment
  WHERE id = p_leave_id;

  DELETE FROM public.attendance
  WHERE user_id = v_leave.user_id
    AND date >= v_leave.start_date
    AND date <= v_leave.end_date
    AND status IN ('leave', 'half_day', 'holiday', 'weekend');

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_user_id, 'cancel_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'restored', v_days_to_restore));
END;
$$;

CREATE OR REPLACE FUNCTION public.modify_leave_request(p_leave_id UUID, p_admin_id UUID, p_new_start DATE, p_new_end DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cancel_leave_request(p_leave_id, p_admin_id, 'Modified dates');

  UPDATE public.leave_requests
  SET start_date = p_new_start,
      end_date = p_new_end,
      status = 'pending',
      admin_comment = NULL
  WHERE id = p_leave_id;

  PERFORM public.approve_leave_request(p_leave_id, p_admin_id, 'Dates modified by admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_leave_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_leave_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modify_leave_request(UUID, UUID, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
