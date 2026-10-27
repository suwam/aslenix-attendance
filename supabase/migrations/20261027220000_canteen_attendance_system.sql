-- =========================================================
-- CANTEEN ATTENDANCE MANAGEMENT SYSTEM
-- =========================================================

-- 1. Canteen Attendance Periods (2-week sheets)
CREATE TABLE IF NOT EXISTS public.canteen_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  prepared_by TEXT NOT NULL DEFAULT 'Suwam Subedi',
  verified_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Canteen Employees (dynamic roster)
CREATE TABLE IF NOT EXISTS public.canteen_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number INT NOT NULL,
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Canteen Holidays & Weekly Offs per period
CREATE TABLE IF NOT EXISTS public.canteen_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.canteen_periods(id) ON DELETE CASCADE,
  day_index INT NOT NULL, -- 0 to 13 (Week 1 Day 0..6, Week 2 Day 7..13)
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'weekly_off', -- 'holiday' | 'weekly_off'
  label TEXT NOT NULL DEFAULT 'WEEKLY OFF', -- 'HOLIDAY' | 'WEEKLY OFF'
  is_enabled BOOLEAN NOT NULL DEFAULT true, -- when true, merged vertical cell is shown & checkboxes locked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, day_index)
);

-- 4. Canteen Attendance records (daily employee eating checkmarks)
CREATE TABLE IF NOT EXISTS public.canteen_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.canteen_periods(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.canteen_employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  ate BOOLEAN NOT NULL DEFAULT true,
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, employee_id, date)
);

-- Enable RLS
ALTER TABLE public.canteen_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteen_attendance ENABLE ROW LEVEL SECURITY;

-- Triggers for updated_at
CREATE TRIGGER trg_canteen_periods_updated BEFORE UPDATE ON public.canteen_periods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_canteen_employees_updated BEFORE UPDATE ON public.canteen_employees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_canteen_attendance_updated BEFORE UPDATE ON public.canteen_attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS Policies: Periods
CREATE POLICY "canteen_periods_select" ON public.canteen_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "canteen_periods_admin_all" ON public.canteen_periods
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies: Employees
CREATE POLICY "canteen_employees_select" ON public.canteen_employees
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "canteen_employees_admin_all" ON public.canteen_employees
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies: Holidays
CREATE POLICY "canteen_holidays_select" ON public.canteen_holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "canteen_holidays_admin_all" ON public.canteen_holidays
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies: Attendance
CREATE POLICY "canteen_attendance_select" ON public.canteen_attendance
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "canteen_attendance_admin_all" ON public.canteen_attendance
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "canteen_attendance_employee_insert" ON public.canteen_attendance
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR (
        EXISTS (
          SELECT 1 FROM public.canteen_employees ce
          WHERE ce.id = employee_id
            AND (ce.user_id = auth.uid() OR lower(ce.name) = lower((SELECT full_name FROM public.profiles WHERE user_id = auth.uid())))
        )
        AND EXISTS (
          SELECT 1 FROM public.canteen_periods cp
          WHERE cp.id = period_id AND cp.is_locked = false
        )
      )
    )
  );

CREATE POLICY "canteen_attendance_employee_update" ON public.canteen_attendance
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR (
        EXISTS (
          SELECT 1 FROM public.canteen_employees ce
          WHERE ce.id = employee_id
            AND (ce.user_id = auth.uid() OR lower(ce.name) = lower((SELECT full_name FROM public.profiles WHERE user_id = auth.uid())))
        )
        AND EXISTS (
          SELECT 1 FROM public.canteen_periods cp
          WHERE cp.id = period_id AND cp.is_locked = false
        )
      )
    )
  );

CREATE POLICY "canteen_attendance_employee_delete" ON public.canteen_attendance
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR (
        EXISTS (
          SELECT 1 FROM public.canteen_employees ce
          WHERE ce.id = employee_id
            AND (ce.user_id = auth.uid() OR lower(ce.name) = lower((SELECT full_name FROM public.profiles WHERE user_id = auth.uid())))
        )
        AND EXISTS (
          SELECT 1 FROM public.canteen_periods cp
          WHERE cp.id = period_id AND cp.is_locked = false
        )
      )
    )
  );

-- =========================================================
-- INITIAL SEED DATA
-- =========================================================

-- Seed standard employees if none exist
INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 1, 'Aayush Adhikari', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Aayush Adhikari');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 2, 'Aayush Rana Magar', (SELECT user_id FROM public.profiles WHERE full_name ILIKE '%Aayush Rana Magar%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Aayush Rana Magar');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 3, 'Alisha Saud', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Alisha Saud');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 4, 'Anil Acharya', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Anil Acharya');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 5, 'Ayam Khanal', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Ayam Khanal');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 6, 'Safal Bhatta', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Safal Bhatta');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 7, 'Sonica Adhikari', NULL
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Sonica Adhikari');

INSERT INTO public.canteen_employees (serial_number, name, user_id)
SELECT 8, 'Suwam Subedi', (SELECT user_id FROM public.profiles WHERE full_name ILIKE '%Suwam Subedi%' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.canteen_employees WHERE name = 'Suwam Subedi');

-- Link existing user profiles where possible
UPDATE public.canteen_employees ce
SET user_id = p.user_id
FROM public.profiles p
WHERE ce.user_id IS NULL AND lower(ce.name) = lower(p.full_name);

-- Seed initial current 2-week period
DO $$
DECLARE
  v_period_id UUID;
  v_start DATE;
  v_end DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.canteen_periods LIMIT 1) THEN
    -- Start on recent Sunday
    v_start := (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT);
    v_end := v_start + 13; -- 14 days total (2 weeks)

    INSERT INTO public.canteen_periods (title, start_date, end_date, prepared_by, verified_by, is_locked)
    VALUES (
      'Canteen Log Sheet (' || to_char(v_start, 'YYYY/MM/DD') || ' - ' || to_char(v_end, 'YYYY/MM/DD') || ')',
      v_start,
      v_end,
      'Suwam Subedi',
      '',
      false
    )
    RETURNING id INTO v_period_id;

    -- Week 1: Holiday on Wednesday (day_index = 3)
    INSERT INTO public.canteen_holidays (period_id, day_index, date, type, label, is_enabled)
    VALUES (v_period_id, 3, v_start + 3, 'holiday', 'HOLIDAY', true);

    -- Week 1: Weekly Off on Saturday (day_index = 6)
    INSERT INTO public.canteen_holidays (period_id, day_index, date, type, label, is_enabled)
    VALUES (v_period_id, 6, v_start + 6, 'weekly_off', 'WEEKLY OFF', true);

    -- Week 2: Weekly Off on Saturday (day_index = 13)
    INSERT INTO public.canteen_holidays (period_id, day_index, date, type, label, is_enabled)
    VALUES (v_period_id, 13, v_start + 13, 'weekly_off', 'WEEKLY OFF', true);
  END IF;
END $$;
