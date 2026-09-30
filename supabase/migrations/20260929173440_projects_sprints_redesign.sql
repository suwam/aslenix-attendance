-- Redesigning Sprint and Tasks Management

CREATE TABLE IF NOT EXISTS public.weekly_sprints (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    week_number integer,
    start_date date,
    end_date date,
    target_date date,
    sprint_goal text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprint_teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sprint_id uuid REFERENCES public.weekly_sprints(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprint_team_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id uuid REFERENCES public.sprint_teams(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.modules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprint_modules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sprint_id uuid REFERENCES public.weekly_sprints(id) ON DELETE CASCADE,
    module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.sprint_teams(id) ON DELETE CASCADE,
    priority text DEFAULT 'medium',
    target_date date,
    weight numeric DEFAULT 10,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sprint_module_id uuid REFERENCES public.sprint_modules(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role text NOT NULL,
    weight numeric DEFAULT 50,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.work_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    module_assignment_id uuid REFERENCES public.module_assignments(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium',
    status text DEFAULT 'Waiting',
    progress numeric DEFAULT 0,
    weight numeric DEFAULT 10,
    due_date date,
    notes text,
    review_status text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.weekly_targets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sprint_id uuid REFERENCES public.weekly_sprints(id) ON DELETE CASCADE,
    name text NOT NULL,
    target_date date,
    status text DEFAULT 'Not Started',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.target_requirements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    target_id uuid REFERENCES public.weekly_targets(id) ON DELETE CASCADE,
    module_assignment_id uuid REFERENCES public.module_assignments(id) ON DELETE CASCADE,
    completion_condition text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS and add basic policies
ALTER TABLE public.weekly_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to everyone" ON public.weekly_sprints FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.weekly_sprints USING (true);

CREATE POLICY "Allow read access to everyone" ON public.sprint_teams FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.sprint_teams USING (true);

CREATE POLICY "Allow read access to everyone" ON public.sprint_team_members FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.sprint_team_members USING (true);

CREATE POLICY "Allow read access to everyone" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.modules USING (true);

CREATE POLICY "Allow read access to everyone" ON public.sprint_modules FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.sprint_modules USING (true);

CREATE POLICY "Allow read access to everyone" ON public.module_assignments FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.module_assignments USING (true);

CREATE POLICY "Allow read access to everyone" ON public.work_items FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.work_items USING (true);

CREATE POLICY "Allow read access to everyone" ON public.weekly_targets FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.weekly_targets USING (true);

CREATE POLICY "Allow read access to everyone" ON public.target_requirements FOR SELECT USING (true);
CREATE POLICY "Allow all for admins" ON public.target_requirements USING (true);
