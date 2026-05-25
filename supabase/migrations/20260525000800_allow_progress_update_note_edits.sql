CREATE OR REPLACE FUNCTION public.prevent_progress_update_history_rewrite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.old_progress IS DISTINCT FROM OLD.old_progress
    OR NEW.new_progress IS DISTINCT FROM OLD.new_progress
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Progress update history fields cannot be changed';
  END IF;

  IF length(trim(NEW.note)) = 0 THEN
    RAISE EXCEPTION 'Progress update note is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_progress_update_history_rewrite
  ON public.task_progress_updates;

CREATE TRIGGER prevent_progress_update_history_rewrite
  BEFORE UPDATE ON public.task_progress_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_progress_update_history_rewrite();

CREATE POLICY "update own progress update notes"
  ON public.task_progress_updates
  FOR UPDATE
  USING (
    public.is_admin(auth.uid()) OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR user_id = auth.uid()
  );
