DELETE FROM public.calendar_events
WHERE bs_date IN (
  '2083-02-14',
  '2083-02-17',
  '2083-02-19',
  '2083-02-21',
  '2083-02-22'
);

INSERT INTO public.calendar_events (title, bs_date, ad_date, is_active)
VALUES
  ('गुरु पूर्णिमा', '2083-02-13', '2026-05-27', true),
  ('खीर खाने दिन', '2083-02-15', '2026-05-29', true),
  ('अन्तर्राष्ट्रिय युवा दिवस', '2083-02-27', '2026-06-10', true)
ON CONFLICT (bs_date) DO UPDATE
SET
  title = EXCLUDED.title,
  ad_date = EXCLUDED.ad_date,
  is_active = EXCLUDED.is_active;
