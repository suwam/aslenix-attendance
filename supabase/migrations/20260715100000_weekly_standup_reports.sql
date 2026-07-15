-- Migration to add weekly_standup_reports table

CREATE TABLE IF NOT EXISTS public.weekly_standup_reports (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    analytics_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT weekly_standup_reports_pkey PRIMARY KEY (id),
    CONSTRAINT weekly_standup_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS weekly_standup_reports_user_id_idx ON public.weekly_standup_reports(user_id);
CREATE INDEX IF NOT EXISTS weekly_standup_reports_week_start_idx ON public.weekly_standup_reports(week_start);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_weekly_standup_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_weekly_standup_reports_modtime
BEFORE UPDATE ON public.weekly_standup_reports
FOR EACH ROW EXECUTE PROCEDURE update_weekly_standup_reports_updated_at();

-- RLS Policies
ALTER TABLE public.weekly_standup_reports ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
CREATE POLICY "Admins have full access to weekly_standup_reports"
ON public.weekly_standup_reports
AS PERMISSIVE FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Employees can view their own reports
CREATE POLICY "Employees can view their own weekly_standup_reports"
ON public.weekly_standup_reports
AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
