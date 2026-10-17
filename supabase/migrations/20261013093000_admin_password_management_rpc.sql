-- Secure Admin Password Reset RPC
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_target_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_is_admin boolean;
  v_target_email text;
  v_target_name text;
BEGIN
  v_caller_id := auth.uid();
  
  -- 1. Check authentication
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User not authenticated' USING ERRCODE = '42501';
  END IF;

  -- 2. Check admin authorization (strict super_admin or admin check, no employees or HR)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_caller_id
      AND role IN ('super_admin', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: Only administrators can reset user passwords' USING ERRCODE = '42501';
  END IF;

  -- 3. Password validation
  IF p_new_password IS NULL OR length(trim(p_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long' USING ERRCODE = '22023';
  END IF;

  -- 4. Check target user exists
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_target_email, v_target_name
  FROM auth.users
  WHERE id = p_target_user_id;

  IF v_target_email IS NULL THEN
    SELECT email, full_name
    INTO v_target_email, v_target_name
    FROM public.profiles
    WHERE user_id = p_target_user_id;
  END IF;

  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Securely update password using extensions.crypt and extensions.gen_salt
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_target_user_id;

  -- 6. Log audit action in activity_logs (NEVER logging plaintext passwords)
  INSERT INTO public.activity_logs (
    user_id,
    action,
    details
  )
  VALUES (
    v_caller_id,
    'admin_password_reset',
    jsonb_build_object(
      'admin_id', v_caller_id,
      'target_user_id', p_target_user_id,
      'target_email', v_target_email,
      'target_name', v_target_name,
      'timestamp', now(),
      'status', 'success'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password reset successfully for ' || coalesce(v_target_name, v_target_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
