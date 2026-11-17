-- Keep the 2 PM Nepal-time cutoff for normal attendance check-ins, but allow
-- corrections made through the audited admin workflow. That workflow sets this
-- transaction-local context before it updates the attendance row.
CREATE OR REPLACE FUNCTION public.enforce_attendance_checkin_cutoff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.check_in_time IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time)
     AND current_setting('attendance.audit_context', true) IS DISTINCT FROM 'admin_edit'
     AND (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kathmandu')::time >= TIME '14:00' THEN
    RAISE EXCEPTION 'Attendance check-in is closed after 2:00 PM Nepal time';
  END IF;

  RETURN NEW;
END;
$$;
