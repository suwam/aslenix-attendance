ALTER TABLE public.weekly_feedback DROP CONSTRAINT IF EXISTS weekly_feedback_week_number_check;
ALTER TABLE public.weekly_feedback ADD CONSTRAINT weekly_feedback_week_number_check CHECK (week_number >= 1 AND week_number <= 6);
