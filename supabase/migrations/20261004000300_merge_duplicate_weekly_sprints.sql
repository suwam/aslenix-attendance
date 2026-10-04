-- One project can only have one record for a given week number. Earlier data
-- may contain duplicates, so first move every related record to the oldest
-- week, then remove the redundant week records.
DO $$
DECLARE
  duplicate_week RECORD;
  canonical_sprint_id uuid;
  duplicate_sprint_id uuid;
BEGIN
  FOR duplicate_week IN
    SELECT project_id, week_number
    FROM public.weekly_sprints
    WHERE week_number IS NOT NULL
    GROUP BY project_id, week_number
    HAVING COUNT(*) > 1
  LOOP
    SELECT id
    INTO canonical_sprint_id
    FROM public.weekly_sprints
    WHERE project_id = duplicate_week.project_id
      AND week_number = duplicate_week.week_number
    ORDER BY created_at NULLS LAST, id
    LIMIT 1;

    FOR duplicate_sprint_id IN
      SELECT id
      FROM public.weekly_sprints
      WHERE project_id = duplicate_week.project_id
        AND week_number = duplicate_week.week_number
        AND id <> canonical_sprint_id
    LOOP
      -- Keep the existing team/module/task relationships intact while placing
      -- them under the one canonical week.
      UPDATE public.sprint_teams
      SET sprint_id = canonical_sprint_id
      WHERE sprint_id = duplicate_sprint_id;

      UPDATE public.sprint_modules
      SET sprint_id = canonical_sprint_id
      WHERE sprint_id = duplicate_sprint_id;

      UPDATE public.weekly_targets
      SET sprint_id = canonical_sprint_id
      WHERE sprint_id = duplicate_sprint_id;

      DELETE FROM public.weekly_sprints
      WHERE id = duplicate_sprint_id;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS weekly_sprints_project_week_number_unique
  ON public.weekly_sprints (project_id, week_number)
  WHERE week_number IS NOT NULL;
