CREATE OR REPLACE FUNCTION public.assign_employee_qr()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := 'ASL-' || LPAD(nextval('public.employee_code_seq')::text, 5, '0');
  END IF;
  IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
    NEW.qr_token := encode(extensions.gen_random_bytes(24), 'hex');
    NEW.qr_generated_at := now();
  END IF;
  RETURN NEW;
END;
$function$;