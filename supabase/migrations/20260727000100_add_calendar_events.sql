CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  bs_date TEXT NOT NULL UNIQUE,
  ad_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view all calendar events" ON public.calendar_events;
CREATE POLICY "view all calendar events"
  ON public.calendar_events
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admins manage calendar events" ON public.calendar_events;
CREATE POLICY "admins manage calendar events"
  ON public.calendar_events
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_calendar_events_updated ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.calendar_events (title, bs_date, ad_date, is_active)
VALUES
  ('Bakra Eid / Eid al-Adha', '2083-02-14', '2026-05-28', true),
  ('Ganatantra Diwas', '2083-02-15', '2026-05-29', true),
  ('World No Tobacco Day', '2083-02-17', '2026-05-31', true),
  ('International Children''s Day', '2083-02-19', '2026-06-02', true),
  ('Children Victims of Aggression Day', '2083-02-21', '2026-06-04', true),
  ('World Environment Day', '2083-02-22', '2026-06-05', true)
ON CONFLICT (bs_date) DO UPDATE
SET
  title = EXCLUDED.title,
  ad_date = EXCLUDED.ad_date,
  is_active = EXCLUDED.is_active;
