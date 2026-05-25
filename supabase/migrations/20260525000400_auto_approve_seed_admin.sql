CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_is_seed_admin BOOLEAN;
BEGIN
  v_is_seed_admin := lower(NEW.email) IN (
    'info.asleninx.np@gmail.com',
    'info.aslenix.np@gmail.com'
  );

  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    phone,
    department,
    position,
    address,
    avatar_url,
    approval_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'position',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN v_is_seed_admin THEN 'approved'::public.approval_status ELSE 'pending'::public.approval_status END
  );

  SELECT COUNT(*) INTO v_count FROM public.user_roles;

  IF v_count = 0 OR v_is_seed_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
