-- Existing approved employees without a joining date are treated as May 2026 hires.
UPDATE public.profiles
SET joining_date = DATE '2026-05-01'
WHERE approval_status = 'approved'
  AND joining_date IS NULL;

-- Future approved employees get their joining date from the approval date.
CREATE OR REPLACE FUNCTION public.set_joining_date_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status = 'approved'
     AND NEW.joining_date IS NULL
     AND (TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM 'approved') THEN
    NEW.joining_date := CURRENT_DATE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_joining_date_on_approval ON public.profiles;
CREATE TRIGGER trg_set_joining_date_on_approval
BEFORE INSERT OR UPDATE OF approval_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_joining_date_on_approval();
