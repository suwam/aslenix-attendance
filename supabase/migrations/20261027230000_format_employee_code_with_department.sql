-- Update employee_code format to ASL-[DEPT_SHORT]-[Number] starting from 01002
-- e.g. ASL-SD-01002 for Software Developer, ASL-FE-01003 for Frontend, etc.

-- 1. Ensure sequence starts from 1002
CREATE SEQUENCE IF NOT EXISTS public.employee_code_seq START WITH 1002;

-- Helper function to get standardized department short code
CREATE OR REPLACE FUNCTION public.get_department_short_code(p_dept text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  v_norm text;
  v_words text[];
  v_word text;
  v_abbr text := '';
BEGIN
  v_norm := lower(trim(COALESCE(p_dept, '')));
  v_norm := regexp_replace(v_norm, '[^a-z0-9\s/&-]', '', 'g');

  IF v_norm = '' THEN
    RETURN 'STAFF';
  END IF;

  IF v_norm LIKE '%software%' OR v_norm = 'sd' THEN
    RETURN 'SD';
  ELSIF v_norm LIKE '%frontend%' OR v_norm = 'fe' THEN
    RETURN 'FE';
  ELSIF v_norm LIKE '%backend%' OR v_norm = 'be' THEN
    RETURN 'BE';
  ELSIF v_norm LIKE '%marketing%' OR v_norm = 'dm' THEN
    RETURN 'DM';
  ELSIF v_norm LIKE '%human%resource%' OR v_norm = 'hr' THEN
    RETURN 'HR';
  ELSIF v_norm LIKE '%admin%' OR v_norm = 'adm' THEN
    RETURN 'ADM';
  ELSIF v_norm LIKE '%ui%' OR v_norm LIKE '%ux%' OR v_norm LIKE '%design%' THEN
    RETURN 'UIUX';
  ELSIF v_norm LIKE '%quality%assurance%' OR v_norm = 'qa' THEN
    RETURN 'QA';
  ELSIF v_norm LIKE '%devops%' THEN
    RETURN 'DEVOPS';
  END IF;

  -- Multi-word: take first letter of each word
  v_words := regexp_split_to_array(trim(v_norm), '\s+');
  IF array_length(v_words, 1) > 1 THEN
    FOREACH v_word IN ARRAY v_words LOOP
      IF length(v_word) > 0 THEN
        v_abbr := v_abbr || upper(substring(v_word from 1 for 1));
      END IF;
    END LOOP;
    IF length(v_abbr) >= 2 THEN
      RETURN v_abbr;
    END IF;
  END IF;

  IF length(v_norm) <= 4 THEN
    RETURN upper(v_norm);
  ELSE
    RETURN upper(substring(v_norm from 1 for 3));
  END IF;
END;
$func$;

-- 2. Trigger function: assign_employee_qr()
CREATE OR REPLACE FUNCTION public.assign_employee_qr()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_dept_code text;
  v_num text;
  v_existing_num text;
BEGIN
  v_dept_code := public.get_department_short_code(NEW.department);
  IF v_dept_code = 'STAFF' AND lower(COALESCE(NEW.email, '')) LIKE '%admin%' THEN
    v_dept_code := 'ADM';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
      v_num := LPAD(nextval('public.employee_code_seq')::text, 5, '0');
      NEW.employee_code := 'ASL-' || v_dept_code || '-' || v_num;
    ELSIF NEW.employee_code ~ '^ASL-[0-9]+$' THEN
      v_existing_num := substring(NEW.employee_code from '[0-9]+$');
      NEW.employee_code := 'ASL-' || v_dept_code || '-' || LPAD(v_existing_num, 5, '0');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
      v_num := LPAD(nextval('public.employee_code_seq')::text, 5, '0');
      NEW.employee_code := 'ASL-' || v_dept_code || '-' || v_num;
    ELSIF NEW.employee_code ~ '^ASL-[0-9]+$' THEN
      -- Upgrade legacy format ASL-01001 to ASL-[DEPT_SHORT]-01001
      v_existing_num := substring(NEW.employee_code from '[0-9]+$');
      NEW.employee_code := 'ASL-' || v_dept_code || '-' || LPAD(v_existing_num, 5, '0');
    ELSIF NEW.department IS DISTINCT FROM OLD.department AND (NEW.employee_code = OLD.employee_code OR NEW.employee_code IS NULL) THEN
      -- Department changed: keep the existing employee number, update the department segment
      v_existing_num := substring(NEW.employee_code from '[0-9]+$');
      IF v_existing_num IS NOT NULL AND v_existing_num <> '' THEN
        NEW.employee_code := 'ASL-' || v_dept_code || '-' || LPAD(v_existing_num, 5, '0');
      END IF;
    END IF;
  END IF;

  -- Ensure qr_token is present
  IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
    NEW.qr_token := encode(extensions.gen_random_bytes(24), 'hex');
    NEW.qr_generated_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- Temporarily drop the trigger during backfill to avoid recursive interference
DROP TRIGGER IF EXISTS trg_assign_employee_qr ON public.profiles;

-- 3. Backfill existing profiles
DO $$
DECLARE
  r RECORD;
  v_dept_code text;
  v_num text;
  v_counter int := 1002;
BEGIN
  -- Temporary neutral placeholder to prevent unique key conflicts during renumbering
  UPDATE public.profiles
  SET employee_code = 'TMP-' || id::text
  WHERE employee_code IS NOT NULL;

  FOR r IN (
    SELECT id, department, email, employee_code
    FROM public.profiles
    ORDER BY COALESCE(joining_date::timestamp, created_at, '2026-01-01'::timestamp), id
  ) LOOP
    v_dept_code := public.get_department_short_code(r.department);
    IF v_dept_code = 'STAFF' AND lower(COALESCE(r.email, '')) LIKE '%admin%' THEN
      v_dept_code := 'ADM';
    END IF;

    v_num := LPAD(v_counter::text, 5, '0');
    v_counter := v_counter + 1;

    UPDATE public.profiles
    SET employee_code = 'ASL-' || v_dept_code || '-' || v_num,
        qr_token = COALESCE(qr_token, encode(extensions.gen_random_bytes(24), 'hex')),
        qr_generated_at = COALESCE(qr_generated_at, now())
    WHERE id = r.id;
  END LOOP;

  -- Ensure next sequence value starts from the next sequential number (at least 1002)
  PERFORM setval('public.employee_code_seq', GREATEST(v_counter, 1002), false);
END;
$$;

-- 4. Re-create the trigger for both INSERT and UPDATE of department/employee_code
CREATE TRIGGER trg_assign_employee_qr
BEFORE INSERT OR UPDATE OF department, employee_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_employee_qr();
