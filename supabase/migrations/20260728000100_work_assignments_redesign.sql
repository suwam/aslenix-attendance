-- Create Enum for work assignment statuses
CREATE TYPE public.task_assignment_status AS ENUM ('not_started', 'in_progress', 'under_review', 'completed', 'blocked');

-- Modify task_assignees
-- Drop constraints
ALTER TABLE public.task_assignees DROP CONSTRAINT IF EXISTS task_assignees_pkey;

-- Add new columns
ALTER TABLE public.task_assignees
ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
ADD COLUMN responsibility TEXT,
ADD COLUMN status public.task_assignment_status NOT NULL DEFAULT 'not_started',
ADD COLUMN due_date DATE,
ADD COLUMN notes TEXT,
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update existing records to have a default unique responsibility
UPDATE public.task_assignees SET responsibility = 'General Assignment - ' || substr(user_id::text, 1, 8) WHERE responsibility IS NULL;

-- Make responsibility NOT NULL
ALTER TABLE public.task_assignees ALTER COLUMN responsibility SET NOT NULL;

-- Prevent duplicate responsibilities on the same task
ALTER TABLE public.task_assignees ADD CONSTRAINT task_assignees_task_id_responsibility_key UNIQUE (task_id, responsibility);

-- Trigger to calculate parent task progress
CREATE OR REPLACE FUNCTION public.calculate_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_total INT;
    v_completed INT;
BEGIN
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);
    
    SELECT COUNT(*) INTO v_total FROM public.task_assignees WHERE task_id = v_task_id;
    SELECT COUNT(*) INTO v_completed FROM public.task_assignees WHERE task_id = v_task_id AND status = 'completed';
    
    IF v_total > 0 THEN
        UPDATE public.tasks SET progress = (v_completed * 100 / v_total) WHERE id = v_task_id;
    ELSE
        UPDATE public.tasks SET progress = 0 WHERE id = v_task_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_task_assignees_progress
AFTER INSERT OR UPDATE OF status OR DELETE ON public.task_assignees
FOR EACH ROW EXECUTE FUNCTION public.calculate_task_progress();

-- Ensure updated_at updates
CREATE TRIGGER trg_task_assignees_updated
BEFORE UPDATE ON public.task_assignees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
