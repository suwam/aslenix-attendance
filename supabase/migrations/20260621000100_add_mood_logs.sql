CREATE TABLE IF NOT EXISTS public.mood_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood TEXT NOT NULL CHECK (mood IN ('excellent', 'good', 'neutral', 'tired', 'stressed')),
  note TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees view own mood logs"
ON public.mood_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "employees insert own mood logs"
ON public.mood_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "employees update own mood logs"
ON public.mood_logs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins view all mood logs"
ON public.mood_logs
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS mood_logs_user_date_idx
ON public.mood_logs (user_id, log_date DESC);

CREATE OR REPLACE FUNCTION public.touch_mood_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_mood_logs_updated_at ON public.mood_logs;
CREATE TRIGGER touch_mood_logs_updated_at
BEFORE UPDATE ON public.mood_logs
FOR EACH ROW
EXECUTE FUNCTION public.touch_mood_logs_updated_at();
