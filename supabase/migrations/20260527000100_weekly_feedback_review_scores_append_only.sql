ALTER TABLE public.weekly_feedback
  ADD COLUMN IF NOT EXISTS review_score integer NOT NULL DEFAULT 0
  CHECK (review_score >= 0 AND review_score <= 10);

UPDATE public.weekly_feedback
SET review_score = CASE rating
  WHEN 'Excellent' THEN 10
  WHEN 'Good' THEN 8
  WHEN 'Average' THEN 5
  WHEN 'Poor' THEN 2
  ELSE 0
END
WHERE review_score = 0;

ALTER TABLE public.weekly_feedback
  DROP CONSTRAINT IF EXISTS weekly_feedback_employee_id_week_start_key;
