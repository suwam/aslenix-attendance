DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'weekly_feedback' AND column_name = 'week_number') THEN
    ALTER TABLE public.weekly_feedback ADD COLUMN week_number integer;
  END IF;
END $$;

ALTER TABLE public.weekly_feedback DROP CONSTRAINT IF EXISTS weekly_feedback_week_number_check;
ALTER TABLE public.weekly_feedback ADD CONSTRAINT weekly_feedback_week_number_check CHECK (week_number >= 1 AND week_number <= 6);
