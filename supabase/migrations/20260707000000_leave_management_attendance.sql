-- 20260707000000_leave_management_attendance.sql

COMMIT;

ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'holiday';
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'weekend';

-- 1. Create holidays table
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'holidays' AND policyname = 'view all holidays'
  ) THEN
    CREATE POLICY "view all holidays" ON public.holidays FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'holidays' AND policyname = 'admins manage holidays'
  ) THEN
    CREATE POLICY "admins manage holidays" ON public.holidays FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_holidays_updated ON public.holidays;
CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON public.holidays FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Create leave_balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  used NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_balances' AND policyname = 'view own leave balances'
  ) THEN
    CREATE POLICY "view own leave balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_balances' AND policyname = 'admins view all leave balances'
  ) THEN
    CREATE POLICY "admins view all leave balances" ON public.leave_balances FOR SELECT USING (public.is_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'leave_balances' AND policyname = 'admins manage leave balances'
  ) THEN
    CREATE POLICY "admins manage leave balances" ON public.leave_balances FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_leave_balances_updated ON public.leave_balances;
CREATE TRIGGER trg_leave_balances_updated BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Leave Approval RPC
CREATE OR REPLACE FUNCTION public.approve_leave_request(p_leave_id UUID, p_admin_id UUID, p_comment TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- Validate admin
  IF NOT public.is_admin(p_admin_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get leave request
  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF v_leave IS NULL THEN
    RAISE EXCEPTION 'Leave request not found';
  END IF;

  IF v_leave.status != 'pending' THEN
    RAISE EXCEPTION 'Leave request is not pending';
  END IF;

  -- Calculate days to deduct
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

  -- Deduct leave balance
  IF v_days_to_deduct > 0 THEN
    SELECT balance - used INTO v_balance FROM public.leave_balances WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
    IF v_balance IS NULL THEN
      -- Automatically create a leave balance row if it doesn't exist
      INSERT INTO public.leave_balances (user_id, leave_type, balance, used) VALUES (v_leave.user_id, v_leave.leave_type, 0, v_days_to_deduct);
    ELSIF v_balance < v_days_to_deduct THEN
      RAISE EXCEPTION 'Insufficient leave balance (Required: %, Available: %)', v_days_to_deduct, v_balance;
    ELSE
      UPDATE public.leave_balances SET used = used + v_days_to_deduct WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
    END IF;
  END IF;

  -- Update leave status
  UPDATE public.leave_requests SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id WHERE id = p_leave_id;

  -- Process attendance insertion
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

  -- Audit Log
  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_admin_id, 'approve_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'start_date', v_leave.start_date, 'end_date', v_leave.end_date));

  -- Notification
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_leave.user_id, 'Leave Approved', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been approved.', 'success');

END;
$$;

-- 4. Leave Rejection RPC
CREATE OR REPLACE FUNCTION public.reject_leave_request(p_leave_id UUID, p_admin_id UUID, p_comment TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_leave RECORD;
BEGIN
  -- Validate admin
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

  UPDATE public.leave_requests SET status = 'rejected', admin_comment = p_comment, reviewed_by = p_admin_id WHERE id = p_leave_id;

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_admin_id, 'reject_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'comment', p_comment));

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_leave.user_id, 'Leave Rejected', 'Your ' || v_leave.leave_type || ' leave from ' || v_leave.start_date || ' to ' || v_leave.end_date || ' has been rejected.', 'warning');
END;
$$;

-- 5. Leave Cancellation RPC (Employee or Admin)
CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_leave_id UUID, p_user_id UUID, p_comment TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Employee can only cancel their own. Admin can cancel any.
  IF v_leave.user_id != p_user_id AND NOT public.is_admin(p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_leave.status != 'approved' THEN
    RAISE EXCEPTION 'Only approved leaves can be cancelled to restore balance';
  END IF;

  -- Calculate days to restore
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

  -- Restore balance
  IF v_days_to_restore > 0 THEN
    UPDATE public.leave_balances SET used = GREATEST(used - v_days_to_restore, 0) WHERE user_id = v_leave.user_id AND leave_type = v_leave.leave_type;
  END IF;

  -- Update status
  UPDATE public.leave_requests SET status = 'cancelled', admin_comment = COALESCE(admin_comment, '') || '\nCancelled: ' || p_comment WHERE id = p_leave_id;

  -- Remove attendance records
  DELETE FROM public.attendance 
  WHERE user_id = v_leave.user_id 
    AND date >= v_leave.start_date 
    AND date <= v_leave.end_date
    AND status IN ('leave', 'half_day', 'holiday', 'weekend');

  INSERT INTO public.activity_logs (user_id, action, details)
  VALUES (p_user_id, 'cancel_leave', jsonb_build_object('leave_id', p_leave_id, 'employee_id', v_leave.user_id, 'restored', v_days_to_restore));

END;
$$;

-- 6. Modify Leave RPC
CREATE OR REPLACE FUNCTION public.modify_leave_request(p_leave_id UUID, p_admin_id UUID, p_new_start DATE, p_new_end DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_leave RECORD;
BEGIN
  -- First, restore old dates
  PERFORM public.cancel_leave_request(p_leave_id, p_admin_id, 'Modified dates');
  
  -- Then update the dates and set to pending
  UPDATE public.leave_requests SET start_date = p_new_start, end_date = p_new_end, status = 'pending', admin_comment = NULL WHERE id = p_leave_id;
  
  -- Re-approve
  PERFORM public.approve_leave_request(p_leave_id, p_admin_id, 'Dates modified by admin');
END;
$$;

-- 7. Daily Attendance Automation
CREATE OR REPLACE FUNCTION public.process_daily_attendance(p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employee RECORD;
  v_day_of_week INT;
  v_is_holiday BOOLEAN;
  v_is_weekend BOOLEAN;
  v_attendance_exists BOOLEAN;
BEGIN
  v_day_of_week := EXTRACT(ISODOW FROM p_date);
  v_is_weekend := v_day_of_week IN (6, 7);
  SELECT EXISTS(SELECT 1 FROM public.holidays WHERE date = p_date AND is_active = true) INTO v_is_holiday;

  FOR v_employee IN 
    SELECT user_id FROM public.profiles WHERE is_suspended = false
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.attendance WHERE user_id = v_employee.user_id AND date = p_date) INTO v_attendance_exists;
    
    IF NOT v_attendance_exists THEN
      INSERT INTO public.attendance (user_id, date, status, remarks)
      VALUES (
        v_employee.user_id,
        p_date,
        CASE 
          WHEN v_is_holiday THEN 'holiday'::public.attendance_status
          WHEN v_is_weekend THEN 'weekend'::public.attendance_status
          ELSE 'absent'::public.attendance_status
        END,
        'Auto-generated'
      );
    END IF;
  END LOOP;
END;
$$;

-- 8. pg_cron for Daily Attendance Processing
DO $cron$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema is not available; skipping auto attendance processor cron registration';
  ELSE
    -- Unschedule if exists to replace. Some pg_cron versions raise when the
    -- name is absent, so tolerate that case for idempotent migration retries.
    BEGIN
      PERFORM cron.unschedule('auto-attendance-processor');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    -- Run every day at 00:05 AM for the previous day
    PERFORM cron.schedule(
      'auto-attendance-processor',
      '5 0 * * *',
      $$SELECT public.process_daily_attendance((CURRENT_DATE - INTERVAL '1 day')::DATE)$$
    );
  END IF;
END
$cron$;
