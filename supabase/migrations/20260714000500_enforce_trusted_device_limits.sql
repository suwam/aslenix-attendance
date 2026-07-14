-- Enforce trusted-device limits and allow employees to manage only their own
-- first-device registration/removal paths.

CREATE OR REPLACE FUNCTION public.enforce_trusted_device_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_devices INTEGER;
  v_active_count INTEGER;
BEGIN
  IF NEW.status <> 'Active' THEN
    RETURN NEW;
  END IF;

  SELECT max_trusted_devices
  INTO v_max_devices
  FROM public.device_security_settings
  WHERE id = true;

  v_max_devices := COALESCE(v_max_devices, 2);

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.employee_devices
  WHERE employee_id = NEW.employee_id
    AND status = 'Active'
    AND id IS DISTINCT FROM NEW.id;

  IF v_active_count >= v_max_devices THEN
    RAISE EXCEPTION 'Trusted device limit reached. Maximum allowed devices: %', v_max_devices;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trusted_device_limit ON public.employee_devices;
CREATE TRIGGER trg_enforce_trusted_device_limit
BEFORE INSERT OR UPDATE OF status, employee_id
ON public.employee_devices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_trusted_device_limit();

DROP POLICY IF EXISTS "employees register own trusted device" ON public.employee_devices;
CREATE POLICY "employees register own trusted device"
ON public.employee_devices FOR INSERT
WITH CHECK (auth.uid() = employee_id);

DROP POLICY IF EXISTS "employees delete own passkeys" ON public.device_passkeys;
CREATE POLICY "employees delete own passkeys"
ON public.device_passkeys FOR DELETE
USING (auth.uid() = employee_id);

