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
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.tags IS DISTINCT FROM OLD.tags
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
  THEN
    RAISE EXCEPTION 'Employees can only update task progress';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_employee_task_field_edits ON public.tasks;
CREATE TRIGGER prevent_employee_task_field_edits
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_task_field_edits();

CREATE OR REPLACE FUNCTION public.prevent_employee_task_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can delete tasks';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_employee_task_delete ON public.tasks;
CREATE TRIGGER prevent_employee_task_delete
  BEFORE DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_task_delete();
