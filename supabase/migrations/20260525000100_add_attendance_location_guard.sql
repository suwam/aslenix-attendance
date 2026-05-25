ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS office_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS office_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS attendance_radius_meters INTEGER NOT NULL DEFAULT 20;

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS check_in_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS check_in_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS check_in_accuracy_meters DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS check_out_latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS check_out_longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS check_out_accuracy_meters DOUBLE PRECISION;

UPDATE public.settings
SET
  office_latitude = COALESCE(office_latitude, 27.6875625),
  office_longitude = COALESCE(office_longitude, 85.3304375),
  attendance_radius_meters = COALESCE(attendance_radius_meters, 20);

CREATE OR REPLACE FUNCTION public.distance_meters(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians((lon2 - lon1) / 2)), 2)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_attendance_office_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.settings%ROWTYPE;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_distance DOUBLE PRECISION;
BEGIN
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_settings
  FROM public.settings
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_settings.office_latitude IS NULL OR v_settings.office_longitude IS NULL THEN
    RAISE EXCEPTION 'Office location is not configured';
  END IF;

  IF TG_OP = 'INSERT' OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time THEN
    v_lat := NEW.check_in_latitude;
    v_lon := NEW.check_in_longitude;
  ELSIF NEW.check_out_time IS NOT NULL AND NEW.check_out_time IS DISTINCT FROM OLD.check_out_time THEN
    v_lat := NEW.check_out_latitude;
    v_lon := NEW.check_out_longitude;
  ELSE
    RETURN NEW;
  END IF;

  IF v_lat IS NULL OR v_lon IS NULL THEN
    RAISE EXCEPTION 'Location is required to mark attendance';
  END IF;

  v_distance := public.distance_meters(
    v_settings.office_latitude,
    v_settings.office_longitude,
    v_lat,
    v_lon
  );

  IF v_distance > v_settings.attendance_radius_meters THEN
    RAISE EXCEPTION 'You must be within % meters of the office to mark attendance',
      v_settings.attendance_radius_meters;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_office_location ON public.attendance;
CREATE TRIGGER trg_attendance_office_location
BEFORE INSERT OR UPDATE OF check_in_time, check_out_time ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.enforce_attendance_office_location();
