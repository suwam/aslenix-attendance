ALTER TABLE public.holidays
ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'public';

INSERT INTO public.holidays (name, date, is_active, scope)
VALUES
  ('Company Examination Day', DATE '2026-08-02', true, 'company'),
  ('Company Examination Day', DATE '2026-08-09', true, 'company')
ON CONFLICT (date) DO UPDATE
SET
  name = EXCLUDED.name,
  is_active = true,
  scope = EXCLUDED.scope,
  updated_at = now();
