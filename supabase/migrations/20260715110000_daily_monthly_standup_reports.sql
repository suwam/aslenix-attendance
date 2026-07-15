-- Migration to add daily_standup_reports and monthly_standup_reports tables

CREATE TABLE IF NOT EXISTS public.daily_standup_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    report_date date NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    analytics_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT daily_standup_reports_pkey PRIMARY KEY (id),
    CONSTRAINT daily_standup_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT daily_standup_reports_unique_user_date UNIQUE (user_id, report_date)
);

CREATE INDEX IF NOT EXISTS daily_standup_reports_user_id_idx ON public.daily_standup_reports(user_id);
CREATE INDEX IF NOT EXISTS daily_standup_reports_date_idx ON public.daily_standup_reports(report_date);

CREATE OR REPLACE FUNCTION update_daily_standup_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_standup_reports_modtime
BEFORE UPDATE ON public.daily_standup_reports
FOR EACH ROW EXECUTE PROCEDURE update_daily_standup_reports_updated_at();

ALTER TABLE public.daily_standup_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to daily_standup_reports"
ON public.daily_standup_reports
AS PERMISSIVE FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their own daily_standup_reports"
ON public.daily_standup_reports
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- MONTHLY REPORTS

CREATE TABLE IF NOT EXISTS public.monthly_standup_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    month_start date NOT NULL,
    month_end date NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    analytics_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT monthly_standup_reports_pkey PRIMARY KEY (id),
    CONSTRAINT monthly_standup_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    CONSTRAINT monthly_standup_reports_unique_user_month UNIQUE (user_id, month_start)
);

CREATE INDEX IF NOT EXISTS monthly_standup_reports_user_id_idx ON public.monthly_standup_reports(user_id);
CREATE INDEX IF NOT EXISTS monthly_standup_reports_month_start_idx ON public.monthly_standup_reports(month_start);

CREATE OR REPLACE FUNCTION update_monthly_standup_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_standup_reports_modtime
BEFORE UPDATE ON public.monthly_standup_reports
FOR EACH ROW EXECUTE PROCEDURE update_monthly_standup_reports_updated_at();

ALTER TABLE public.monthly_standup_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to monthly_standup_reports"
ON public.monthly_standup_reports
AS PERMISSIVE FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Employees can view their own monthly_standup_reports"
ON public.monthly_standup_reports
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
