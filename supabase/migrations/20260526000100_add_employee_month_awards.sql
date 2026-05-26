CREATE TABLE IF NOT EXISTS public.employee_month_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  month_start date NOT NULL,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  rating text NOT NULL DEFAULT 'excellent',
  public_message text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_employee_month_awards_employee_month
  ON public.employee_month_awards(employee_id, month_start DESC);

CREATE INDEX IF NOT EXISTS idx_employee_month_awards_month
  ON public.employee_month_awards(month_start DESC, score DESC);

ALTER TABLE public.employee_month_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage employee month awards"
  ON public.employee_month_awards
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "employees view own employee month awards"
  ON public.employee_month_awards
  FOR SELECT
  USING (employee_id = auth.uid());

CREATE TRIGGER employee_month_awards_updated
  BEFORE UPDATE ON public.employee_month_awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
