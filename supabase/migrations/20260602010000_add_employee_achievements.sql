-- Add persisted employee achievements for admin approvals and manual assignments
CREATE TABLE IF NOT EXISTS public.employee_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  badge_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge)
);
ALTER TABLE public.employee_achievements ENABLE ROW LEVEL SECURITY;
