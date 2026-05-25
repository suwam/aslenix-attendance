ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS is_early_checkout BOOLEAN NOT NULL DEFAULT false;
