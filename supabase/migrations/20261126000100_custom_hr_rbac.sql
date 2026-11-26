-- Custom HR RBAC. This migration is additive and must be reviewed/applied through
-- the normal Supabase migration workflow; it is intentionally not executed by the app.

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  module text NOT NULL,
  action text NOT NULL CHECK (action IN ('view', 'create', 'edit', 'delete', 'approve', 'export')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, action),
  CHECK (permission_key = module || '.' || action)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_record_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_permissions_user_id_idx ON public.user_permissions (user_id);
CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx ON public.admin_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_logs_actor_user_id_idx ON public.admin_activity_logs (actor_user_id);

INSERT INTO public.permissions (permission_key, module, action, description) VALUES
  ('employees.view', 'employees', 'view', 'View employee records'),
  ('employees.create', 'employees', 'create', 'Create employee records'),
  ('employees.edit', 'employees', 'edit', 'Edit employee records'),
  ('employees.delete', 'employees', 'delete', 'Delete employee records'),
  ('employees.export', 'employees', 'export', 'Export employee records'),
  ('attendance.view', 'attendance', 'view', 'View attendance'),
  ('attendance.edit', 'attendance', 'edit', 'Correct attendance'),
  ('attendance.approve', 'attendance', 'approve', 'Approve attendance corrections'),
  ('attendance.export', 'attendance', 'export', 'Export attendance'),
  ('leaves.view', 'leaves', 'view', 'View leave requests'),
  ('leaves.edit', 'leaves', 'edit', 'Edit leave requests'),
  ('leaves.approve', 'leaves', 'approve', 'Approve or reject leave requests'),
  ('leaves.export', 'leaves', 'export', 'Export leave requests'),
  ('shifts.view', 'shifts', 'view', 'View shifts'),
  ('shifts.create', 'shifts', 'create', 'Create shifts'),
  ('shifts.edit', 'shifts', 'edit', 'Edit shifts'),
  ('shifts.delete', 'shifts', 'delete', 'Delete shifts'),
  ('reports.view', 'reports', 'view', 'View reports'),
  ('reports.export', 'reports', 'export', 'Export reports'),
  ('meetings.view', 'meetings', 'view', 'View meetings'),
  ('meetings.create', 'meetings', 'create', 'Create meetings'),
  ('meetings.edit', 'meetings', 'edit', 'Edit meetings'),
  ('meetings.delete', 'meetings', 'delete', 'Delete meetings')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;

-- Keep the legacy helper for existing policies, but remove both HR role and title based
-- escalation. Admin and Super Admin retain their established broad access.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.user_permissions up ON up.user_id = ur.user_id
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'hr_manager' AND p.permission_key = _permission_key
  );
$$;

REVOKE ALL ON TABLE public.permissions, public.user_permissions, public.admin_activity_logs FROM anon;
GRANT SELECT ON TABLE public.permissions TO authenticated;
GRANT SELECT ON TABLE public.user_permissions TO authenticated;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users read permission catalog" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "users read their own permission assignments" ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "super admins read activity logs" ON public.admin_activity_logs FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.rbac_set_hr_permissions(p_user_id uuid, p_permission_keys text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Only Super Admin can manage HR permissions' USING ERRCODE = '42501'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Super Admin permissions cannot be edited here' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'hr_manager') THEN
    RAISE EXCEPTION 'Target user is not an HR manager' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.user_permissions WHERE user_id = p_user_id;
  INSERT INTO public.user_permissions (user_id, permission_id, granted_by)
  SELECT p_user_id, id, auth.uid() FROM public.permissions WHERE permission_key = ANY(COALESCE(p_permission_keys, ARRAY[]::text[]));
  INSERT INTO public.admin_activity_logs (actor_user_id, action, module, target_user_id, details)
  VALUES (auth.uid(), 'permissions_updated', 'role_management', p_user_id, jsonb_build_object('permission_keys', COALESCE(p_permission_keys, ARRAY[]::text[])));
END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_set_hr_access(p_user_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Only Super Admin can manage HR access' USING ERRCODE = '42501'; END IF;
  IF p_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Super Admin accounts cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Administrator accounts cannot be converted to HR accounts' USING ERRCODE = '42501';
  END IF;
  IF p_enabled THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, 'hr_manager') ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET is_suspended = false, approval_status = 'approved' WHERE user_id = p_user_id;
  ELSE
    DELETE FROM public.user_permissions WHERE user_id = p_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_user_id AND role = 'hr_manager';
  END IF;
  INSERT INTO public.admin_activity_logs (actor_user_id, action, module, target_user_id, details)
  VALUES (auth.uid(), CASE WHEN p_enabled THEN 'hr_access_granted' ELSE 'hr_access_revoked' END, 'role_management', p_user_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_set_hr_suspension(p_user_id uuid, p_suspended boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Only Super Admin can suspend HR access' USING ERRCODE = '42501'; END IF;
  IF p_user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Super Admin accounts cannot be modified' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Administrator accounts cannot be suspended as HR accounts' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'hr_manager') THEN
    RAISE EXCEPTION 'Target user is not an HR manager' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles SET is_suspended = p_suspended, approval_status = CASE WHEN p_suspended THEN 'suspended'::public.approval_status ELSE 'approved'::public.approval_status END WHERE user_id = p_user_id;
  INSERT INTO public.admin_activity_logs (actor_user_id, action, module, target_user_id, details)
  VALUES (auth.uid(), CASE WHEN p_suspended THEN 'hr_access_suspended' ELSE 'hr_access_activated' END, 'role_management', p_user_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_list_hr_accounts()
RETURNS TABLE(user_id uuid, full_name text, email text, department text, approval_status public.approval_status, is_suspended boolean, permission_count bigint, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.email, p.department, p.approval_status, p.is_suspended,
    COUNT(up.id), MIN(ur.created_at)
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'hr_manager'
  LEFT JOIN public.user_permissions up ON up.user_id = p.user_id
  WHERE public.is_super_admin()
  GROUP BY p.user_id, p.full_name, p.email, p.department, p.approval_status, p.is_suspended;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_set_hr_permissions(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_set_hr_access(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_set_hr_suspension(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_list_hr_accounts() TO authenticated;

-- Explicit HR policies. Existing is_admin()-based policies now remain Admin/Super Admin only.
CREATE POLICY "hr view employee profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_permission('employees.view'));
CREATE POLICY "hr edit employee profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_permission('employees.edit')) WITH CHECK (public.has_permission('employees.edit'));
CREATE POLICY "hr view attendance" ON public.attendance FOR SELECT TO authenticated USING (public.has_permission('attendance.view'));
CREATE POLICY "hr edit attendance" ON public.attendance FOR UPDATE TO authenticated USING (public.has_permission('attendance.edit')) WITH CHECK (public.has_permission('attendance.edit'));
CREATE POLICY "hr view leave requests" ON public.leave_requests FOR SELECT TO authenticated USING (public.has_permission('leaves.view'));
CREATE POLICY "hr edit leave requests" ON public.leave_requests FOR UPDATE TO authenticated USING (public.has_permission('leaves.edit') OR public.has_permission('leaves.approve')) WITH CHECK (public.has_permission('leaves.edit') OR public.has_permission('leaves.approve'));
CREATE POLICY "hr view shifts" ON public.shifts FOR SELECT TO authenticated USING (public.has_permission('shifts.view'));
CREATE POLICY "hr create shifts" ON public.shifts FOR INSERT TO authenticated WITH CHECK (public.has_permission('shifts.create'));
CREATE POLICY "hr edit shifts" ON public.shifts FOR UPDATE TO authenticated USING (public.has_permission('shifts.edit')) WITH CHECK (public.has_permission('shifts.edit'));
CREATE POLICY "hr delete shifts" ON public.shifts FOR DELETE TO authenticated USING (public.has_permission('shifts.delete'));

CREATE OR REPLACE FUNCTION public.rbac_log_hr_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row_data jsonb; record_id uuid; target_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'hr_manager') THEN RETURN COALESCE(NEW, OLD); END IF;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  record_id := NULLIF(row_data->>'id', '')::uuid;
  target_id := NULLIF(row_data->>'user_id', '')::uuid;
  INSERT INTO public.admin_activity_logs(actor_user_id, action, module, target_user_id, target_record_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_ARGV[0], target_id, record_id, jsonb_build_object('table', TG_TABLE_NAME));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER rbac_audit_attendance AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.rbac_log_hr_activity('attendance');
CREATE TRIGGER rbac_audit_leave_requests AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.rbac_log_hr_activity('leaves');
CREATE TRIGGER rbac_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.rbac_log_hr_activity('employees');
