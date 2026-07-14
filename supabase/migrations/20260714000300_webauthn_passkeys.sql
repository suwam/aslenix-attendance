-- WebAuthn Passkeys and Challenges for Biometric Attendance

CREATE TABLE IF NOT EXISTS public.device_passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one passkey is registered per device per employee
CREATE UNIQUE INDEX IF NOT EXISTS device_passkeys_device_idx 
ON public.device_passkeys (employee_id, device_fingerprint);

-- Temporary storage for WebAuthn challenges during registration/authentication
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes'
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_lookup_idx
ON public.webauthn_challenges (employee_id, device_fingerprint, challenge);

ALTER TABLE public.device_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Employees can see if their device has a passkey registered
DROP POLICY IF EXISTS "employees view own passkeys" ON public.device_passkeys;
CREATE POLICY "employees view own passkeys"
ON public.device_passkeys FOR SELECT
USING (auth.uid() = employee_id);

-- Write operations (INSERT/UPDATE/DELETE) on device_passkeys and webauthn_challenges 
-- are intentionally NOT permitted for regular users via RLS.
-- They will be performed securely by TanStack Start Server Functions 
-- using the Supabase Service Role Key after cryptographic verification.

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_device_passkeys_updated ON public.device_passkeys;
CREATE TRIGGER trg_device_passkeys_updated
BEFORE UPDATE ON public.device_passkeys
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
