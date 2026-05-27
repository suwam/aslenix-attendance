ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_eom_eligible boolean NOT NULL DEFAULT true;

UPDATE public.profiles
SET is_eom_eligible = false
WHERE lower(coalesce(department, '')) IN ('hr', 'human resources')
  OR lower(coalesce(position, '')) IN ('hr', 'human resources', 'supervisor');

UPDATE public.profiles p
SET is_eom_eligible = false
WHERE EXISTS (
  SELECT 1
  FROM public.user_roles r
  WHERE r.user_id = p.user_id
    AND r.role IN ('super_admin', 'admin', 'hr_manager')
);

CREATE INDEX IF NOT EXISTS idx_profiles_eom_eligible
  ON public.profiles(is_eom_eligible)
  WHERE approval_status = 'approved' AND is_suspended = false;
