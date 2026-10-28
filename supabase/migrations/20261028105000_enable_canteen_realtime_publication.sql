-- Enable realtime publication for all canteen tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_periods;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_employees;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_holidays;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.canteen_attendance;
  EXCEPTION WHEN duplicate_object THEN
    -- already in publication
  END;
END;
$$;

