-- Add new statuses to the enum
ALTER TYPE public.task_assignment_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.task_assignment_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add complexity to task_assignees
ALTER TABLE public.task_assignees 
ADD COLUMN IF NOT EXISTS complexity public.task_complexity NOT NULL DEFAULT 'medium';

-- Update the progress calculation trigger
CREATE OR REPLACE FUNCTION public.calculate_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_total_weight INT;
    v_completed_weight NUMERIC;
BEGIN
    v_task_id := COALESCE(NEW.task_id, OLD.task_id);
    
    -- Weight mapping: small=1, medium=2, large=3, epic=5
    -- Calculate total weight and approved completed weight for the current week
    SELECT 
      COALESCE(SUM(
        CASE complexity
          WHEN 'small' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'large' THEN 3
          WHEN 'epic' THEN 5
          ELSE 2
        END
      ), 0),
      COALESCE(SUM(
        CASE WHEN status = 'approved' THEN 
          (progress::NUMERIC / 100.0) * 
          CASE complexity
            WHEN 'small' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'large' THEN 3
            WHEN 'epic' THEN 5
            ELSE 2
          END
        ELSE 0 END
      ), 0)
    INTO v_total_weight, v_completed_weight
    FROM public.task_assignees 
    WHERE task_id = v_task_id
      AND date_trunc('week', assigned_at) = date_trunc('week', now());
    
    IF v_total_weight > 0 THEN
        UPDATE public.tasks 
        SET progress = ROUND((v_completed_weight / v_total_weight) * 100) 
        WHERE id = v_task_id;
    ELSE
        UPDATE public.tasks 
        SET progress = 0 
        WHERE id = v_task_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
