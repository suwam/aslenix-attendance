
-- Set search_path on helper trigger functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, phone, department, position, address, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'department',
    NEW.raw_user_meta_data->>'position',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    UPDATE public.profiles SET approval_status='approved' WHERE user_id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $$;

-- Restrict EXECUTE on helper functions to authenticated only (used inside RLS only — runs as definer regardless)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Avatars bucket: prevent listing entire bucket; users can read individual file paths via public URL
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars authenticated read" ON storage.objects FOR SELECT USING (bucket_id='avatars' AND auth.uid() IS NOT NULL);
