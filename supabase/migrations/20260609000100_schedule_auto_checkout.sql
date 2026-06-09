CREATE OR REPLACE FUNCTION public.auto_checkout_unchecked_attendance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.settings%ROWTYPE;
  v_updated_rows INTEGER;
BEGIN
  SELECT *
  INTO v_settings
  FROM public.settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_settings.auto_checkout_time IS NULL THEN
    RETURN 0;
  END IF;

  IF v_settings.office_latitude IS NULL OR v_settings.office_longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is required for auto checkout';
  END IF;

  UPDATE public.attendance AS attendance
  SET
    check_out_time = ((attendance.date + v_settings.auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu'),
    check_out_latitude = v_settings.office_latitude,
    check_out_longitude = v_settings.office_longitude,
    check_out_accuracy_meters = 0,
    is_early_checkout = false,
    work_hours = GREATEST(
      ROUND(
        EXTRACT(
          EPOCH FROM (
            ((attendance.date + v_settings.auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu')
            - attendance.check_in_time
          )
        ) / 3600 * 100
      ) / 100,
      0
    )
  WHERE attendance.check_in_time IS NOT NULL
    AND attendance.check_out_time IS NULL
    AND ((attendance.date + v_settings.auto_checkout_time)::timestamp AT TIME ZONE 'Asia/Kathmandu') <= now();

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  RETURN v_updated_rows;
END;
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION
  WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'pg_cron extension is not available; configure an external scheduler to call public.auto_checkout_unchecked_attendance()';
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
