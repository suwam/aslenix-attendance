-- Migration: Support 2-day weekly off (Sunday & Saturday) controllable by Admin in settings
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS weekly_off_days INTEGER[] NOT NULL DEFAULT '{0, 6}';

COMMENT ON COLUMN public.settings.weekly_off_days IS 'Array of day-of-week numbers that are company weekly off days (0=Sunday, 6=Saturday). Defaults to Sunday & Saturday off.';

-- Update existing settings record to default to Sunday (0) and Saturday (6) if null
UPDATE public.settings
SET weekly_off_days = '{0, 6}'
WHERE weekly_off_days IS NULL;
