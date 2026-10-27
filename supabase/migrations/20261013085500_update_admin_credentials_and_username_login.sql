-- Update Admin credentials and profile
UPDATE auth.users
SET encrypted_password = extensions.crypt('Aslenix@2024', extensions.gen_salt('bf')),
    raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', '"Alenix-ADMIN"'),
    updated_at = now()
WHERE email = 'info.aslenix.np@gmail.com';

UPDATE public.profiles
SET full_name = 'Alenix-ADMIN',
    updated_at = now()
WHERE email = 'info.aslenix.np@gmail.com';

-- Ensure handle_new_user accommodates Alenix-ADMIN / seed admin
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
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      approval_status = EXCLUDED.approval_status;

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

-- Function to allow resolving username / full_name / employee_code / alias to login email
CREATE OR REPLACE FUNCTION public.get_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_clean text;
BEGIN
  v_clean := trim(p_identifier);
  
  IF v_clean = '' THEN
    RETURN v_clean;
  END IF;

  IF v_clean LIKE '%@%' THEN
    RETURN v_clean;
  END IF;

  -- Match admin aliases explicitly
  IF lower(v_clean) IN ('alenix-admin', 'aslenix-admin', 'admin', 'alenix_admin', 'aslenix_admin', 'aslenix', 'alenix') THEN
    RETURN 'info.aslenix.np@gmail.com';
  END IF;

  -- Match full_name or employee_code in profiles (case-insensitive)
  SELECT email INTO v_email
  FROM public.profiles
  WHERE lower(full_name) = lower(v_clean)
     OR lower(employee_code) = lower(v_clean)
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  RETURN v_clean;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;
