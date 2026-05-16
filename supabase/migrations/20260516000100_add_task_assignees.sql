CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON public.task_assignees(task_id);

INSERT INTO public.task_assignees (task_id, user_id)
SELECT id, assigned_to
FROM public.tasks
ON CONFLICT DO NOTHING;

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage task assignees" ON public.task_assignees
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "users view own task assignments" ON public.task_assignees
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "view assigned tasks via task_assignees" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = id AND ta.user_id = auth.uid()
    )
  );

CREATE POLICY "assigned users update tasks via task_assignees" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = id AND ta.user_id = auth.uid()
    )
    OR auth.uid() = created_by
  );

CREATE POLICY "view comments on multi-assigned tasks" ON public.task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_comments.task_id AND ta.user_id = auth.uid()
    )
  );

CREATE POLICY "view attachments on multi-assigned tasks" ON public.task_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = task_attachments.task_id AND ta.user_id = auth.uid()
    )
  );
