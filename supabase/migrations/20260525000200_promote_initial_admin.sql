UPDATE public.profiles
SET
  approval_status = 'approved',
  is_suspended = false
WHERE email = 'info.asleninx.np@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role
FROM public.profiles
WHERE email = 'info.asleninx.np@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET
  approval_status = 'approved',
  is_suspended = false
WHERE email = 'info.aslenix.np@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.app_role
FROM public.profiles
WHERE email = 'info.aslenix.np@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
