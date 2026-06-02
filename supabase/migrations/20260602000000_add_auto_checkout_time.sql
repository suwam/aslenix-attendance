ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS auto_checkout_time TIME NOT NULL DEFAULT '19:00';

CREATE OR REPLACE FUNCTION public.auto_checkout_unchecked_attendance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.settings%ROWTYPE;
  v_checkout_time timestamptz;
  v_updated_rows INTEGER;
BEGIN
  SELECT *
  INTO v_settings
  FROM public.settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_settings.auto_checkout_time IS NULL THEN
    RETURN 0;
  END IF;

  IF v_settings.office_latitude IS NULL OR v_settings.office_longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is required for auto checkout';
  END IF;

  v_checkout_time := ((timezone('Asia/Kathmandu', now())::date) + v_settings.auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu';

  UPDATE public.attendance
  SET
    check_out_time = v_checkout_time,
    check_out_latitude = v_settings.office_latitude,
    check_out_longitude = v_settings.office_longitude,
    check_out_accuracy_meters = 0,
    is_early_checkout = false,
    work_hours = GREATEST(
      ROUND(EXTRACT(EPOCH FROM (v_checkout_time - check_in_time)) / 3600 * 100) / 100,
      0
    )
  WHERE date = timezone('Asia/Kathmandu', now())::date
    AND check_in_time IS NOT NULL
    AND check_out_time IS NULL;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows;
END;
$$;
