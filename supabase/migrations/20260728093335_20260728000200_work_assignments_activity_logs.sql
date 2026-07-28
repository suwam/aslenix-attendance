CREATE OR REPLACE FUNCTION log_task_assignee_activity()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_task_id uuid;
  v_action text;
  v_new_value jsonb;
BEGIN
  v_user_id := auth.uid();
  IF TG_OP = 'DELETE' THEN
    v_task_id := OLD.task_id;
    v_action := 'assignment_removed';
    v_new_value := jsonb_build_object('responsibility', OLD.responsibility, 'user_id', OLD.user_id);
  ELSIF TG_OP = 'INSERT' THEN
    v_task_id := NEW.task_id;
    v_action := 'assignment_added';
    v_new_value := jsonb_build_object('responsibility', NEW.responsibility, 'user_id', NEW.user_id, 'status', NEW.status);
  ELSIF TG_OP = 'UPDATE' THEN
    v_task_id := NEW.task_id;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'assignment_status_changed';
      v_new_value := jsonb_build_object('responsibility', NEW.responsibility, 'user_id', NEW.user_id, 'status', NEW.status, 'old_status', OLD.status);
    ELSIF OLD.responsibility IS DISTINCT FROM NEW.responsibility THEN
      v_action := 'assignment_updated';
      v_new_value := jsonb_build_object('responsibility', NEW.responsibility, 'user_id', NEW.user_id, 'old_responsibility', OLD.responsibility);
    ELSE
      -- Ignore minor changes like notes
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO task_activity_logs (task_id, user_id, action, new_value)
  VALUES (v_task_id, v_user_id, v_action, v_new_value);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_assignees_activity ON task_assignees;
CREATE TRIGGER trg_task_assignees_activity
  AFTER INSERT OR UPDATE OR DELETE ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION log_task_assignee_activity();
