CREATE TABLE IF NOT EXISTS public.work_item_assignees (
    work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, user_id)
);

ALTER TABLE public.work_item_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage work item assignees"
    ON public.work_item_assignees
    FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users view own work item assignments"
    ON public.work_item_assignees
    FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
