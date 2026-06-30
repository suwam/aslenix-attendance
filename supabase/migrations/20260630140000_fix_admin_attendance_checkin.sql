-- Migration to allow admins (like HRs) to check themselves in and out
-- without triggering the audited attendance edit workflow exception.

CREATE OR REPLACE FUNCTION public.restrict_employee_attendance_direct_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(auth.uid()) THEN
    -- If admin is editing SOMEONE ELSE's record, enforce audit context
    IF auth.uid() <> OLD.user_id THEN
      IF current_setting('attendance.audit_context', true) IS NULL
        AND public.attendance_edit_snapshot(OLD) IS DISTINCT FROM public.attendance_edit_snapshot(NEW) THEN
        RAISE EXCEPTION 'Use the audited attendance edit workflow';
      END IF;
      RETURN NEW;
    END IF;
    
    -- If editing their own record, let it fall through to employee checks
    -- UNLESS they are explicitly using the audit context to bypass employee checks!
    IF current_setting('attendance.audit_context', true) IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  IF auth.uid() <> OLD.user_id THEN
    RAISE EXCEPTION 'Attendance updates are not allowed';
  END IF;

  IF OLD.check_out_time IS NOT NULL THEN
    RAISE EXCEPTION 'Submit a correction request to change completed attendance';
  END IF;

  IF NEW.user_id <> OLD.user_id
    OR NEW.date <> OLD.date
    OR NEW.check_in_time IS DISTINCT FROM OLD.check_in_time
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.work_location IS DISTINCT FROM OLD.work_location
    OR NEW.remarks IS DISTINCT FROM OLD.remarks
    OR NEW.is_late IS DISTINCT FROM OLD.is_late
    OR NEW.is_edited IS DISTINCT FROM OLD.is_edited THEN
    RAISE EXCEPTION 'Submit a correction request to edit attendance';
  END IF;

  RETURN NEW;
END;
$$;
