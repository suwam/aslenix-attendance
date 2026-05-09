
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','hr_manager','employee','viewer');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.attendance_status AS ENUM ('present','late','absent','leave','half_day','wfh');
CREATE TYPE public.leave_type AS ENUM ('sick','casual','vacation','emergency','wfh');
CREATE TYPE public.leave_status AS ENUM ('pending','approved','rejected','cancelled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  department TEXT,
  position TEXT,
  address TEXT,
  avatar_url TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  joining_date DATE,
  salary NUMERIC,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin','hr_manager'));
$$;

-- ============ ATTENDANCE ============
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status public.attendance_status NOT NULL DEFAULT 'present',
  work_hours NUMERIC DEFAULT 0,
  is_late BOOLEAN NOT NULL DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ============ LEAVE REQUESTS ============
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type public.leave_type NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status public.leave_status NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'ASLENIX',
  company_logo TEXT,
  office_start_time TIME NOT NULL DEFAULT '09:00',
  office_end_time TIME NOT NULL DEFAULT '18:00',
  late_after_time TIME NOT NULL DEFAULT '09:15',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.settings (company_name) VALUES ('ASLENIX');

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leaves_updated BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Auto profile + role on signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_count INT;
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

  -- First user becomes super_admin & auto-approved
  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    UPDATE public.profiles SET approval_status='approved' WHERE user_id = NEW.id;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE USING (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view roles" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin'));

-- attendance
CREATE POLICY "view own attendance" ON public.attendance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own attendance" ON public.attendance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own attendance" ON public.attendance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins view all attendance" ON public.attendance FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage attendance" ON public.attendance FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- leave_requests
CREATE POLICY "view own leaves" ON public.leave_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own leaves" ON public.leave_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own pending leaves" ON public.leave_requests FOR UPDATE USING (auth.uid() = user_id AND status='pending');
CREATE POLICY "admins view all leaves" ON public.leave_requests FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admins manage leaves" ON public.leave_requests FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- notifications
CREATE POLICY "view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "system insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- settings
CREATE POLICY "everyone read settings" ON public.settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admins update settings" ON public.settings FOR UPDATE USING (public.is_admin(auth.uid()));

-- activity_logs
CREATE POLICY "admins view logs" ON public.activity_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "system insert logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============ STORAGE: avatars bucket ============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars','avatars', true) ON CONFLICT DO NOTHING;
CREATE POLICY "avatars public read" ON storage.objects FOR SELECT USING (bucket_id='avatars');
CREATE POLICY "avatars users upload own" ON storage.objects FOR INSERT WITH CHECK (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars users update own" ON storage.objects FOR UPDATE USING (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "avatars users delete own" ON storage.objects FOR DELETE USING (bucket_id='avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
