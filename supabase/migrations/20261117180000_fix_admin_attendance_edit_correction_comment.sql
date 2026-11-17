-- Repair deployed versions of apply_admin_attendance_edit that referenced the
-- non-existent attendance_correction_requests.review_notes column. The table
-- stores reviewer text in admin_comment.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.apply_admin_attendance_edit(uuid, timestamptz, timestamptz, public.attendance_status, text, text)'::regprocedure
  )
  INTO function_definition;

  IF function_definition LIKE '%review_notes%' THEN
    EXECUTE replace(function_definition, 'review_notes =', 'admin_comment =');
  END IF;
END;
$$;
