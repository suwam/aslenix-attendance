-- Add team_lead to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'team_lead';

-- Create task_team_leads pivot table
CREATE TABLE IF NOT EXISTS public.task_team_leads (
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_team_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_team_leads
CREATE POLICY "Admins can manage task team leads" ON public.task_team_leads
    FOR ALL
    USING (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()) OR public.has_role('hr_manager', auth.uid()));

CREATE POLICY "Users can view task team leads" ON public.task_team_leads
    FOR SELECT
    USING (true);

-- Alter task_comments for discussion features
ALTER TABLE public.task_comments
    ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS attachment JSONB,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Update task_comments RLS
CREATE POLICY "Users can update their own task comments" ON public.task_comments
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task comments" ON public.task_comments
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create comment_mentions table
CREATE TABLE IF NOT EXISTS public.comment_mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID REFERENCES public.task_comments(id) ON DELETE CASCADE,
    mentioned_user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comment mentions" ON public.comment_mentions
    FOR SELECT
    USING (true);

CREATE POLICY "Users can insert comment mentions if they own the comment" ON public.comment_mentions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.task_comments
            WHERE id = comment_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert any comment mentions" ON public.comment_mentions
    FOR INSERT
    WITH CHECK (public.has_role('admin', auth.uid()) OR public.has_role('super_admin', auth.uid()) OR public.has_role('hr_manager', auth.uid()));

-- Create task_activity_logs table
CREATE TABLE IF NOT EXISTS public.task_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task activity logs" ON public.task_activity_logs
    FOR SELECT
    USING (true);

CREATE POLICY "Admins and Team Leads can insert task activity logs" ON public.task_activity_logs
    FOR INSERT
    WITH CHECK (
        public.has_role('admin', auth.uid()) OR 
        public.has_role('super_admin', auth.uid()) OR 
        public.has_role('hr_manager', auth.uid()) OR
        public.has_role('team_lead', auth.uid()) OR
        -- Allow employees to log progress updates
        (action = 'progress_updated' OR action = 'status_changed')
    );

-- Alter notifications table
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Grant permissions to authenticated users
GRANT ALL ON TABLE public.task_team_leads TO authenticated;
GRANT ALL ON TABLE public.comment_mentions TO authenticated;
GRANT ALL ON TABLE public.task_activity_logs TO authenticated;
