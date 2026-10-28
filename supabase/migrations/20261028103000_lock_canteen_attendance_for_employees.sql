-- Tighten canteen attendance RLS policies:
-- Employees can ONLY insert/tick their own attendance.
-- Once ticked, ONLY admins can update or delete/uncheck attendance.

DROP POLICY IF EXISTS "canteen_attendance_employee_update" ON public.canteen_attendance;
DROP POLICY IF EXISTS "canteen_attendance_employee_delete" ON public.canteen_attendance;
DROP POLICY IF EXISTS "canteen_attendance_employee_insert" ON public.canteen_attendance;

-- Employees can INSERT (tick) their own attendance on an unlocked period
CREATE POLICY "canteen_attendance_employee_insert" ON public.canteen_attendance
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin(auth.uid())
      OR (
        EXISTS (
          SELECT 1 FROM public.canteen_employees ce
          WHERE ce.id = employee_id
            AND (
              ce.user_id = auth.uid()
              OR trim(lower(ce.name)) = trim(lower((SELECT full_name FROM public.profiles WHERE user_id = auth.uid())))
            )
        )
        AND EXISTS (
          SELECT 1 FROM public.canteen_periods cp
          WHERE cp.id = period_id AND cp.is_locked = false
        )
      )
    )
  );

-- ONLY admins can update attendance records (employees cannot alter marked attendance)
CREATE POLICY "canteen_attendance_employee_update" ON public.canteen_attendance
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND public.is_admin(auth.uid())
  );

-- ONLY admins can delete / uncheck attendance records (employees cannot uncheck marked attendance)
CREATE POLICY "canteen_attendance_employee_delete" ON public.canteen_attendance
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND public.is_admin(auth.uid())
  );

