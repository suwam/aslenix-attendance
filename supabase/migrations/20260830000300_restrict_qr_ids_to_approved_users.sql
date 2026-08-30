CREATE OR REPLACE FUNCTION public.sync_qr_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.is_suspended = true OR NEW.approval_status IN ('rejected', 'suspended') THEN
    NEW.qr_status := 'revoked';
    NEW.qr_token := NULL;
    NEW.qr_generated_at := NULL;
  ELSIF NEW.approval_status <> 'approved' THEN
    NEW.qr_status := 'inactive';
    NEW.qr_token := NULL;
    NEW.qr_generated_at := NULL;
  ELSE
    IF NEW.qr_token IS NULL OR NEW.qr_token = '' THEN
      NEW.qr_token := encode(extensions.gen_random_bytes(24), 'hex');
      NEW.qr_generated_at := now();
    END IF;

    IF NEW.qr_status NOT IN ('active', 'inactive', 'revoked') THEN
      NEW.qr_status := 'active';
    END IF;

    IF TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      NEW.qr_status := 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_qr_status ON public.profiles;
CREATE TRIGGER trg_sync_qr_status
BEFORE INSERT OR UPDATE OF approval_status, is_suspended, qr_status, qr_token ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_qr_status();

UPDATE public.profiles
SET qr_status = CASE
    WHEN is_suspended OR approval_status IN ('rejected', 'suspended') THEN 'revoked'::public.qr_status
    ELSE 'inactive'::public.qr_status
  END,
  qr_token = NULL,
  qr_generated_at = NULL
WHERE approval_status <> 'approved'
  OR is_suspended = true;

UPDATE public.profiles
SET qr_token = COALESCE(NULLIF(qr_token, ''), encode(extensions.gen_random_bytes(24), 'hex')),
  qr_generated_at = COALESCE(qr_generated_at, now()),
  qr_status = CASE
    WHEN qr_status = 'revoked' THEN 'revoked'::public.qr_status
    WHEN qr_status = 'inactive' THEN 'inactive'::public.qr_status
    ELSE 'active'::public.qr_status
  END
WHERE approval_status = 'approved'
  AND is_suspended = false;
