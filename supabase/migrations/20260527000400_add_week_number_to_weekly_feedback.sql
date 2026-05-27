ALTER TABLE public.weekly_feedback
  ADD COLUMN IF NOT EXISTS week_number integer
  CHECK (week_number >= 1 AND week_number <= 4);

ALTER TABLE public.weekly_feedback
  ADD COLUMN IF NOT EXISTS admin_notes text;

UPDATE public.weekly_feedback
SET week_number = LEAST(
  4,
  GREATEST(
    1,
    2 + ROUND(
      (
        (date_trunc('week', week_start - INTERVAL '2 days') + INTERVAL '2 days')::date
        - (date_trunc('week', CURRENT_DATE - INTERVAL '2 days') + INTERVAL '2 days')::date
      )::numeric / 7
    )::integer
  )
)
WHERE week_number IS NULL;

UPDATE public.weekly_feedback
SET admin_notes = notes
WHERE admin_notes IS NULL AND notes IS NOT NULL;

ALTER TABLE public.weekly_feedback
  ALTER COLUMN week_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_feedback_employee_week_start_unique
  ON public.weekly_feedback(employee_id, week_start);

CREATE INDEX IF NOT EXISTS idx_weekly_feedback_employee_week_number
  ON public.weekly_feedback(employee_id, week_number, week_start DESC);
