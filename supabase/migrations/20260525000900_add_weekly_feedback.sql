CREATE TABLE IF NOT EXISTS public.weekly_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  week_start date NOT NULL,
  rating text NOT NULL CHECK (rating IN ('Excellent', 'Good', 'Average', 'Poor')),
  strengths text,
  improvements text,
  notes text,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_feedback_employee_week
  ON public.weekly_feedback(employee_id, week_start DESC);

ALTER TABLE public.weekly_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage weekly feedback"
  ON public.weekly_feedback
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "employees view own weekly feedback"
  ON public.weekly_feedback
  FOR SELECT
  USING (employee_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER weekly_feedback_updated
  BEFORE UPDATE ON public.weekly_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
