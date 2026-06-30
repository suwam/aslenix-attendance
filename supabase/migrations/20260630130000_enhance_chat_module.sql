-- Enhance public.is_admin SQL function to support department-based matching
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin','hr_manager')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id=_user_id AND (
      position ILIKE '%HR%' OR position ILIKE '%Human Resources%'
      OR department ILIKE '%HR%' OR department ILIKE '%Human Resources%'
    )
  );
$$;

-- Grant EXECUTE permissions to standard authenticated and anonymous roles
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;

-- Add reactions JSONB column to public.chat_messages
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Create policy for updating chat message reactions
DROP POLICY IF EXISTS "chat participants update reactions" ON public.chat_messages;
CREATE POLICY "chat participants update reactions"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (public.is_admin(auth.uid()) OR c.employee_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (public.is_admin(auth.uid()) OR c.employee_id = auth.uid())
    )
  );
