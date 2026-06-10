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
      WHEN NEW.status = 'review'::public.task_status THEN 'review'::public.task_status
      ELSE 'completed'::public.task_status
    END;
  ELSIF NEW.progress >= 98 THEN
    NEW.status := 'review'::public.task_status;
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
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.deadline IS DISTINCT FROM OLD.deadline
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
    OR NEW.tags IS DISTINCT FROM OLD.tags
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
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

CREATE OR REPLACE FUNCTION public.notify_admins_task_review_requested(_task_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_name text;
  v_task_title text;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(NULLIF(p.full_name, ''), 'Employee')
  INTO v_employee_name
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  SELECT COALESCE(NULLIF(t.title, ''), 'a task')
  INTO v_task_title
  FROM public.tasks t
  WHERE t.id = _task_id
    AND (
      t.assigned_to = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.task_assignees ta
        WHERE ta.task_id = t.id
          AND ta.user_id = auth.uid()
      )
    )
  LIMIT 1;

  IF v_task_title IS NULL THEN
    RAISE EXCEPTION 'Task is not assigned to this employee';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT DISTINCT
    ur.user_id,
    'Task review requested',
    COALESCE(v_employee_name, 'Employee') || ' completed ' || v_task_title || ' and requested review.',
    'task'
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'super_admin', 'hr_manager')
    AND ur.user_id <> auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_task_review_requested(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_task_review_requested(uuid) TO authenticated;
