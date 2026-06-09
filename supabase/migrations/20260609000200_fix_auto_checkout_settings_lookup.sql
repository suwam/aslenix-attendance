ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS auto_checkout_time TIME NOT NULL DEFAULT '19:00';

CREATE OR REPLACE FUNCTION public.auto_checkout_unchecked_attendance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto_checkout_time TIME;
  v_office_latitude DOUBLE PRECISION;
  v_office_longitude DOUBLE PRECISION;
  v_updated_rows INTEGER;
BEGIN
  SELECT settings.auto_checkout_time,
         settings.office_latitude,
         settings.office_longitude
  INTO v_auto_checkout_time,
       v_office_latitude,
       v_office_longitude
  FROM public.settings AS settings
  ORDER BY settings.updated_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_auto_checkout_time IS NULL THEN
    RETURN 0;
  END IF;

  IF v_office_latitude IS NULL OR v_office_longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is required for auto checkout';
  END IF;

  UPDATE public.attendance AS attendance
  SET
    check_out_time = ((attendance.date + v_auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu'),
    check_out_latitude = v_office_latitude,
    check_out_longitude = v_office_longitude,
    check_out_accuracy_meters = 0,
    is_early_checkout = false,
    work_hours = GREATEST(
      ROUND(
        EXTRACT(
          EPOCH FROM (
            ((attendance.date + v_auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu')
            - attendance.check_in_time
          )
        ) / 3600 * 100
      ) / 100,
      0
    )
  WHERE attendance.check_in_time IS NOT NULL
    AND attendance.check_out_time IS NULL
    AND ((attendance.date + v_auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu') <= now();

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows;
END;
$$;

DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'cron schema is not available; skipping auto checkout cron registration';
    RETURN;
  END IF;

  EXECUTE $cron$
    SELECT cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'attendance-auto-checkout'
  $cron$;

  EXECUTE $cron$
    SELECT cron.schedule(
      'attendance-auto-checkout',
      '*/5 * * * *',
      'SELECT public.auto_checkout_unchecked_attendance();'
    )
  $cron$;
END;
$$;
