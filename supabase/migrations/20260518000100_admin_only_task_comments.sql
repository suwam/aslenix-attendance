DROP POLICY IF EXISTS "insert own comments" ON public.task_comments;

CREATE POLICY "admins insert task comments" ON public.task_comments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = user_id);
