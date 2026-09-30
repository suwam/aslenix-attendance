
CREATE TABLE IF NOT EXISTS public.work_item_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_item_id uuid REFERENCES public.work_items(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    old_progress numeric,
    new_progress numeric,
    old_status text,
    new_status text,
    update_text text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS blocker_reason text;

ALTER TABLE public.work_item_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON public.work_item_logs USING (true);
