
-- Enums
CREATE TYPE public.task_status AS ENUM ('todo','in_progress','review','completed');
CREATE TYPE public.task_priority AS ENUM ('low','medium','high','urgent');

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  deadline timestamptz,
  assigned_to uuid NOT NULL,
  created_by uuid NOT NULL,
  tags text[] DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or assigned tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = assigned_to OR auth.uid() = created_by);
CREATE POLICY "admins view all tasks" ON public.tasks
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "users insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "admins manage tasks" ON public.tasks
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "assignee updates task" ON public.tasks
  FOR UPDATE USING (auth.uid() = assigned_to OR auth.uid() = created_by);
CREATE POLICY "creator deletes task" ON public.tasks
  FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_comments_task ON public.task_comments(task_id);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view comments on accessible tasks" ON public.task_comments
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
  );
CREATE POLICY "insert own comments" ON public.task_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own comments or admin" ON public.task_comments
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Attachments
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_attachments_task ON public.task_attachments(task_id);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view attachments on accessible tasks" ON public.task_attachments
  FOR SELECT USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
    )
  );
CREATE POLICY "insert own attachments" ON public.task_attachments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own attachments or admin" ON public.task_attachments
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Standups
CREATE TABLE public.standups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  yesterday text,
  today text,
  blockers text,
  work_hours numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
CREATE INDEX idx_standups_user_date ON public.standups(user_id, date);
ALTER TABLE public.standups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own standups" ON public.standups
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins view all standups" ON public.standups
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "insert own standups" ON public.standups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own standups" ON public.standups
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admins manage standups" ON public.standups
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER standups_updated BEFORE UPDATE ON public.standups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for task files
INSERT INTO storage.buckets (id, name, public) VALUES ('task-files','task-files', false);

CREATE POLICY "auth read task files" ON storage.objects FOR SELECT
  USING (bucket_id = 'task-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "auth upload task files" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "owner delete task files" ON storage.objects FOR DELETE
  USING (bucket_id = 'task-files' AND auth.uid()::text = (storage.foldername(name))[1]);
