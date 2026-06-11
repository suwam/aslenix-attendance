DO $$
BEGIN
  CREATE TYPE public.task_complexity AS ENUM ('small', 'medium', 'large', 'epic');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS task_complexity public.task_complexity NOT NULL DEFAULT 'medium';

COMMENT ON COLUMN public.tasks.task_complexity IS
  'Effort estimate for fair Employee of the Month scoring: small=2, medium=5, large=13, epic=34 points.';
