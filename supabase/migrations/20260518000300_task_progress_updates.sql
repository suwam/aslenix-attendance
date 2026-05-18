CREATE TABLE IF NOT EXISTS public.task_progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  old_progress int NOT NULL CHECK (old_progress >= 0 AND old_progress <= 100),
  new_progress int NOT NULL CHECK (new_progress >= 0 AND new_progress <= 100),
  note text NOT NULL CHECK (length(trim(note)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_progress_increased CHECK (new_progress > old_progress)
);

CREATE INDEX IF NOT EXISTS idx_task_progress_updates_task_created
  ON public.task_progress_updates(task_id, created_at DESC);

ALTER TABLE public.task_progress_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view progress updates on accessible tasks"
  ON public.task_progress_updates
  FOR SELECT
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    ) OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = task_progress_updates.task_id
        AND ta.user_id = auth.uid()
    )
  );

CREATE POLICY "insert own progress updates on accessible tasks"
  ON public.task_progress_updates
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      public.is_admin(auth.uid()) OR EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE t.id = task_id
          AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
      ) OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = task_progress_updates.task_id
          AND ta.user_id = auth.uid()
      )
    )
  );
