-- Fix employee_achievements RLS policies so admins can manage approvals and employees can still view their own achievements.
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage employee achievements" ON public.employee_achievements;
DROP POLICY IF EXISTS "employees view own employee achievements" ON public.employee_achievements;
DROP POLICY IF EXISTS "employees manage own employee achievements" ON public.employee_achievements;

CREATE POLICY "employees view own employee achievements" ON public.employee_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins manage employee achievements" ON public.employee_achievements
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "employees manage own employee achievements" ON public.employee_achievements
  FOR UPDATE, DELETE
  USING (auth.uid() = user_id);
