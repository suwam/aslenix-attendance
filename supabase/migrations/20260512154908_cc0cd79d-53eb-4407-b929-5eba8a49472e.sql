
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- QR status enum
CREATE TYPE public.qr_status AS ENUM ('active', 'inactive', 'revoked');

-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_status public.qr_status NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ;

-- Sequence for employee codes
CREATE SEQUENCE IF NOT EXISTS public.employee_code_seq START 1001;

-- Function: generate employee_code + qr_token on insert
CREATE OR REPLACE FUNCTION public.assign_employee_qr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_assign_employee_qr ON public.profiles;
CREATE TRIGGER trg_assign_employee_qr
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_employee_qr();

-- Function: sync qr_status with approval/suspension
CREATE OR REPLACE FUNCTION public.sync_qr_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_suspended = true OR NEW.approval_status IN ('rejected','suspended') THEN
    NEW.qr_status := 'revoked';
  ELSIF NEW.approval_status = 'approved' AND NEW.qr_status = 'inactive' THEN
    NEW.qr_status := 'active';
    IF NEW.qr_generated_at IS NULL THEN
      NEW.qr_generated_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_qr_status ON public.profiles;
CREATE TRIGGER trg_sync_qr_status
BEFORE INSERT OR UPDATE OF approval_status, is_suspended ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_qr_status();

-- Backfill existing profiles
UPDATE public.profiles
SET employee_code = 'ASL-' || LPAD(nextval('public.employee_code_seq')::text, 5, '0')
WHERE employee_code IS NULL OR employee_code = '';

UPDATE public.profiles
SET qr_token = encode(extensions.gen_random_bytes(24), 'hex'),
    qr_generated_at = COALESCE(qr_generated_at, now())
WHERE qr_token IS NULL;

UPDATE public.profiles
SET qr_status = CASE
  WHEN is_suspended OR approval_status IN ('rejected','suspended') THEN 'revoked'::public.qr_status
  WHEN approval_status = 'approved' THEN 'active'::public.qr_status
  ELSE 'inactive'::public.qr_status
END;
