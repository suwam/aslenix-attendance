-- Migration to add half-day leave support

ALTER TABLE public.leave_requests
ADD COLUMN is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN half_day_session TEXT CHECK (half_day_session IN ('morning', 'afternoon'));
