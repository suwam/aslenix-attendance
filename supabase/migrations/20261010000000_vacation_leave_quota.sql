-- Vacation leave has its own allowance: up to 50 working days.
-- Existing balances are raised so previously-created 4-day balances do not
-- continue to block vacation requests.
UPDATE public.leave_balances
SET balance = GREATEST(balance, 50)
WHERE leave_type = 'vacation';

-- Create the correct balance before an employee submits their first vacation
-- request. The approval RPC then uses this balance instead of its legacy
-- fallback allowance.
CREATE OR REPLACE FUNCTION public.prepare_vacation_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE;
  v_working_days NUMERIC := 0;
BEGIN
  IF NEW.leave_type <> 'vacation' THEN
    RETURN NEW;
  END IF;

  FOR v_date IN
    SELECT generate_series(NEW.start_date, NEW.end_date, '1 day'::interval)::DATE
  LOOP
    IF EXTRACT(ISODOW FROM v_date) NOT IN (6, 7)
       AND NOT EXISTS (
         SELECT 1
         FROM public.holidays
         WHERE date = v_date AND is_active = true
       ) THEN
      v_working_days := v_working_days + CASE WHEN NEW.is_half_day THEN 0.5 ELSE 1 END;
    END IF;
  END LOOP;

  IF v_working_days > 50 THEN
    RAISE EXCEPTION 'Vacation leave is limited to 50 working days per request';
  END IF;

  INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
  VALUES (NEW.user_id, 'vacation', 50, 0)
  ON CONFLICT (user_id, leave_type) DO UPDATE
  SET balance = GREATEST(public.leave_balances.balance, 50);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_vacation_leave_request ON public.leave_requests;
CREATE TRIGGER trg_prepare_vacation_leave_request
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.prepare_vacation_leave_request();
