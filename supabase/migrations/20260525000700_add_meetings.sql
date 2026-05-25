CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  agenda TEXT,
  meeting_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  meeting_link TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved users view meetings"
ON public.meetings
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.approval_status = 'approved'
      AND profiles.is_suspended = false
  )
);

CREATE POLICY "admins manage meetings"
ON public.meetings
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_meetings_meeting_time
ON public.meetings(meeting_time);
