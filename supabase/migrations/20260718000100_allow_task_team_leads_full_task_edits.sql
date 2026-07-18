CREATE OR REPLACE FUNCTION public.is_task_team_lead(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.task_team_leads ttl
    WHERE ttl.task_id = _task_id
      AND ttl.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_employee_task_field_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) OR public.is_task_team_lead(OLD.id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.deadline IS DISTINCT FROM OLD.deadline
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.tags IS DISTINCT FROM OLD.tags
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.task_complexity IS DISTINCT FROM OLD.task_complexity
  THEN
    RAISE EXCEPTION 'Employees can only update task progress';
  END IF;

  IF NEW.progress = 0 AND NEW.status IS DISTINCT FROM 'todo'::public.task_status THEN
    RAISE EXCEPTION 'To Do tasks must have 0%% progress';
  ELSIF NEW.progress BETWEEN 1 AND 97 AND NEW.status IS DISTINCT FROM 'in_progress'::public.task_status THEN
    RAISE EXCEPTION 'In Progress tasks must have 1%% to 97%% progress';
  ELSIF NEW.progress BETWEEN 98 AND 99 AND NEW.status IS DISTINCT FROM 'review'::public.task_status THEN
    RAISE EXCEPTION 'Review tasks must have 98%% to 99%% progress';
  ELSIF NEW.progress = 100 AND NEW.status NOT IN ('review'::public.task_status, 'completed'::public.task_status) THEN
    RAISE EXCEPTION '100%% progress tasks must be completed or pending review';
  END IF;

  IF NEW.status = 'completed'::public.task_status AND NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'Completed tasks require a completion timestamp';
  ELSIF NEW.status <> 'completed'::public.task_status AND NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only completed tasks can have a completion timestamp';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "task team leads update managed tasks" ON public.tasks;
CREATE POLICY "task team leads update managed tasks"
  ON public.tasks
  FOR UPDATE
  USING (public.is_task_team_lead(id, auth.uid()))
  WITH CHECK (public.is_task_team_lead(id, auth.uid()));

DROP POLICY IF EXISTS "task team leads view managed tasks" ON public.tasks;
CREATE POLICY "task team leads view managed tasks"
  ON public.tasks
  FOR SELECT
  USING (public.is_task_team_lead(id, auth.uid()));

DROP POLICY IF EXISTS "task team leads manage task assignees" ON public.task_assignees;
CREATE POLICY "task team leads manage task assignees"
  ON public.task_assignees
  FOR ALL
  USING (public.is_task_team_lead(task_id, auth.uid()))
  WITH CHECK (public.is_task_team_lead(task_id, auth.uid()));

DROP POLICY IF EXISTS "task team leads view task comments" ON public.task_comments;
CREATE POLICY "task team leads view task comments"
  ON public.task_comments
  FOR SELECT
  USING (public.is_task_team_lead(task_id, auth.uid()));

DROP POLICY IF EXISTS "task team leads view task attachments" ON public.task_attachments;
CREATE POLICY "task team leads view task attachments"
  ON public.task_attachments
  FOR SELECT
  USING (public.is_task_team_lead(task_id, auth.uid()));

REVOKE ALL ON FUNCTION public.is_task_team_lead(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_task_team_lead(uuid, uuid) TO authenticated;
