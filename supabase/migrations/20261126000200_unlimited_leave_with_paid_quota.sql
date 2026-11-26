ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS paid_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_days NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.leave_paid_allocations (
  leave_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  leave_year INTEGER NOT NULL,
  paid_days NUMERIC NOT NULL DEFAULT 0,
  unpaid_days NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (leave_id, leave_year)
);

ALTER TABLE public.leave_paid_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leave_paid_allocations FROM PUBLIC, anon, authenticated;

-- Existing requests and balances must not be blocked by the old per-type limits.
UPDATE public.leave_balances
SET balance = used + 1000000000;

INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
SELECT DISTINCT user_id, leave_type, 1000000000, 0
FROM public.leave_requests
WHERE status = 'pending'
ON CONFLICT (user_id, leave_type) DO UPDATE
SET balance = GREATEST(public.leave_balances.balance, public.leave_balances.used + 1000000000);

CREATE OR REPLACE FUNCTION public.prepare_unlimited_leave_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, leave_type, balance, used)
  VALUES (NEW.user_id, NEW.leave_type, 1000000000, 0)
  ON CONFLICT (user_id, leave_type) DO UPDATE
  SET balance = GREATEST(public.leave_balances.balance, public.leave_balances.used + 1000000000);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_unlimited_leave_balance ON public.leave_requests;
CREATE TRIGGER trg_prepare_unlimited_leave_balance
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.prepare_unlimited_leave_balance();
REVOKE ALL ON FUNCTION public.prepare_unlimited_leave_balance() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_paid_leave_year(p_user_id UUID, p_year INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_date DATE;
  v_year_start DATE := make_date(p_year, 1, 1);
  v_year_end DATE := make_date(p_year, 12, 31);
  v_is_holiday BOOLEAN;
  v_day_amount NUMERIC;
  v_day_paid NUMERIC;
  v_requested_days NUMERIC;
  v_paid_days NUMERIC;
  v_paid_used NUMERIC := 0;
  v_accrued_quota NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::TEXT), p_year);

  DELETE FROM public.leave_paid_allocations allocation
  USING public.leave_requests request
  WHERE allocation.leave_id = request.id
    AND allocation.leave_year = p_year
    AND request.user_id = p_user_id
    AND (
      request.status::TEXT NOT IN ('approved', 'half_day_approved')
      OR request.start_date > v_year_end
      OR request.end_date < v_year_start
    );

  FOR v_leave IN
    SELECT id, start_date, end_date, is_half_day, status
    FROM public.leave_requests
    WHERE user_id = p_user_id
      AND start_date <= v_year_end
      AND end_date >= v_year_start
      AND status::TEXT IN ('approved', 'half_day_approved')
    ORDER BY start_date, created_at, id
  LOOP
    v_requested_days := 0;
    v_paid_days := 0;

    FOR v_date IN
      SELECT generate_series(
        GREATEST(v_leave.start_date, v_year_start),
        LEAST(v_leave.end_date, v_year_end),
        '1 day'::INTERVAL
      )::DATE
    LOOP
      SELECT EXISTS (
        SELECT 1
        FROM public.holidays
        WHERE date = v_date AND is_active = TRUE
      ) INTO v_is_holiday;

      IF EXTRACT(ISODOW FROM v_date) NOT IN (6, 7) AND NOT v_is_holiday THEN
        v_day_amount := CASE
          WHEN v_leave.status = 'half_day_approved' OR v_leave.is_half_day THEN 0.5
          ELSE 1
        END;
        v_requested_days := v_requested_days + v_day_amount;
        v_accrued_quota := LEAST(24, EXTRACT(MONTH FROM v_date) * 2);
        v_day_paid := LEAST(
          v_day_amount,
          GREATEST(v_accrued_quota - v_paid_used, 0)
        );
        v_paid_days := v_paid_days + v_day_paid;
        v_paid_used := v_paid_used + v_day_paid;
      END IF;
    END LOOP;

    INSERT INTO public.leave_paid_allocations (leave_id, leave_year, paid_days, unpaid_days)
    VALUES (v_leave.id, p_year, v_paid_days, GREATEST(v_requested_days - v_paid_days, 0))
    ON CONFLICT (leave_id, leave_year) DO UPDATE
    SET paid_days = EXCLUDED.paid_days,
        unpaid_days = EXCLUDED.unpaid_days;

    UPDATE public.leave_requests request
    SET paid_days = (
          SELECT COALESCE(SUM(allocation.paid_days), 0)
          FROM public.leave_paid_allocations allocation
          WHERE allocation.leave_id = request.id
        ),
        unpaid_days = (
          SELECT COALESCE(SUM(allocation.unpaid_days), 0)
          FROM public.leave_paid_allocations allocation
          WHERE allocation.leave_id = request.id
        )
    WHERE request.id = v_leave.id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_paid_leave_year(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_paid_leave_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status::TEXT IN ('approved', 'half_day_approved') THEN
      FOR v_year IN
        SELECT generate_series(
          EXTRACT(YEAR FROM OLD.start_date)::INTEGER,
          EXTRACT(YEAR FROM OLD.end_date)::INTEGER
        )
      LOOP
        PERFORM public.recalculate_paid_leave_year(OLD.user_id, v_year);
      END LOOP;
    END IF;

    IF NEW.status::TEXT IN ('approved', 'half_day_approved') THEN
      FOR v_year IN
        SELECT generate_series(
          EXTRACT(YEAR FROM NEW.start_date)::INTEGER,
          EXTRACT(YEAR FROM NEW.end_date)::INTEGER
        )
      LOOP
        PERFORM public.recalculate_paid_leave_year(NEW.user_id, v_year);
      END LOOP;
    ELSE
      UPDATE public.leave_requests
      SET paid_days = 0, unpaid_days = 0
      WHERE id = NEW.id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.status::TEXT IN ('approved', 'half_day_approved') THEN
    FOR v_year IN
      SELECT generate_series(
        EXTRACT(YEAR FROM OLD.start_date)::INTEGER,
        EXTRACT(YEAR FROM OLD.end_date)::INTEGER
      )
    LOOP
      PERFORM public.recalculate_paid_leave_year(OLD.user_id, v_year);
    END LOOP;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_paid_leave_after_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_paid_leave_usage(p_year INTEGER)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(allocation.paid_days), 0)
  FROM public.leave_paid_allocations allocation
  JOIN public.leave_requests request ON request.id = allocation.leave_id
  WHERE request.user_id = auth.uid()
    AND allocation.leave_year = p_year;
$$;
REVOKE ALL ON FUNCTION public.get_paid_leave_usage(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_paid_leave_usage(INTEGER) TO authenticated;

DROP TRIGGER IF EXISTS trg_recalculate_paid_leave_after_change ON public.leave_requests;
CREATE TRIGGER trg_recalculate_paid_leave_after_change
AFTER UPDATE OF status, start_date, end_date, is_half_day ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_paid_leave_after_change();

DROP TRIGGER IF EXISTS trg_recalculate_paid_leave_after_delete ON public.leave_requests;
CREATE TRIGGER trg_recalculate_paid_leave_after_delete
AFTER DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.recalculate_paid_leave_after_change();

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT DISTINCT request.user_id, years.leave_year
    FROM public.leave_requests request
    CROSS JOIN LATERAL generate_series(
      EXTRACT(YEAR FROM request.start_date)::INTEGER,
      EXTRACT(YEAR FROM request.end_date)::INTEGER
    ) AS years(leave_year)
    WHERE request.status::TEXT IN ('approved', 'half_day_approved')
  LOOP
    PERFORM public.recalculate_paid_leave_year(v_row.user_id, v_row.leave_year::INTEGER);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_log_hr_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data JSONB;
  record_id UUID;
  target_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'leave_requests'
     AND TG_OP = 'UPDATE'
     AND (to_jsonb(OLD) - 'paid_days' - 'unpaid_days' - 'updated_at')
       = (to_jsonb(NEW) - 'paid_days' - 'unpaid_days' - 'updated_at') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hr_manager'
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  record_id := NULLIF(row_data->>'id', '')::UUID;
  target_id := NULLIF(row_data->>'user_id', '')::UUID;

  INSERT INTO public.admin_activity_logs (
    actor_user_id, action, module, target_user_id, target_record_id, details
  )
  VALUES (
    auth.uid(), lower(TG_OP), TG_ARGV[0], target_id, record_id,
    jsonb_build_object('table', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
