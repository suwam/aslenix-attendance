-- Modify task progress calculation to use average progress of assignments created in current week
CREATE OR REPLACE FUNCTION public.calculate_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_total INT;
    v_total_progress INT;
BEGIN
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);
    
    SELECT COUNT(*), COALESCE(SUM(progress), 0)
    INTO v_total, v_total_progress 
    FROM public.task_assignees 
    WHERE task_id = v_task_id
      AND date_trunc('week', assigned_at) = date_trunc('week', now());
    
    IF v_total > 0 THEN
        UPDATE public.tasks SET progress = (v_total_progress / v_total) WHERE id = v_task_id;
    ELSE
        UPDATE public.tasks SET progress = 0 WHERE id = v_task_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to fire on progress and assigned_at changes as well
DROP TRIGGER IF EXISTS trg_task_assignees_progress ON public.task_assignees;
CREATE TRIGGER trg_task_assignees_progress
AFTER INSERT OR UPDATE OF status, progress, assigned_at OR DELETE ON public.task_assignees
FOR EACH ROW EXECUTE FUNCTION public.calculate_task_progress();
