CREATE OR REPLACE FUNCTION public.enforce_attendance_checkin_cutoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.check_in_time IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time)
     AND NOT public.is_admin(auth.uid())
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kathmandu')::time >= TIME '14:00' THEN
    RAISE EXCEPTION 'Attendance check-in is closed after 2:00 PM Nepal time';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_checkin_cutoff ON public.attendance;
CREATE TRIGGER trg_attendance_checkin_cutoff
BEFORE INSERT OR UPDATE OF check_in_time ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION public.enforce_attendance_checkin_cutoff();
