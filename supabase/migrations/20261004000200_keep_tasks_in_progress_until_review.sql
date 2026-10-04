CREATE OR REPLACE FUNCTION public.sync_task_workflow_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.progress := LEAST(100, GREATEST(0, COALESCE(NEW.progress, 0)));

  IF NEW.progress = 0 THEN
    NEW.status := 'todo'::public.task_status;
  ELSIF NEW.progress = 100 THEN
    NEW.status := CASE
      WHEN NEW.status = 'completed'::public.task_status THEN 'completed'::public.task_status
      ELSE 'review'::public.task_status
    END;
  ELSE
    NEW.status := 'in_progress'::public.task_status;
  END IF;

  IF NEW.status = 'completed'::public.task_status THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
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
  ELSIF NEW.progress BETWEEN 1 AND 99 AND NEW.status IS DISTINCT FROM 'in_progress'::public.task_status THEN
    RAISE EXCEPTION 'In Progress tasks must have 1%% to 99%% progress';
  ELSIF NEW.progress = 100 AND NEW.status IS DISTINCT FROM 'review'::public.task_status THEN
    RAISE EXCEPTION '100%% progress tasks must be pending review';
  END IF;

  IF NEW.status = 'completed'::public.task_status AND NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'Completed tasks require a completion timestamp';
  ELSIF NEW.status <> 'completed'::public.task_status AND NEW.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only completed tasks can have a completion timestamp';
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.tasks
SET status = 'in_progress'::public.task_status
WHERE progress BETWEEN 1 AND 99
  AND status IS DISTINCT FROM 'in_progress'::public.task_status;

UPDATE public.work_items
SET status = 'in_progress',
    review_status = NULL
WHERE progress > 0
  AND progress < 100
  AND lower(COALESCE(status, '')) = 'review';

UPDATE public.work_items
SET review_status = 'pending'
WHERE progress = 100
  AND lower(COALESCE(status, '')) = 'review'
  AND review_status IS NULL;
