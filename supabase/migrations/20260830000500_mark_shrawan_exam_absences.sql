DELETE FROM public.holidays
WHERE date IN (DATE '2026-08-02', DATE '2026-08-09');

WITH target_dates(attendance_date) AS (
  VALUES
    (DATE '2026-08-02'),
    (DATE '2026-08-09')
),
target_employees AS (
  SELECT user_id, full_name
  FROM public.profiles
  WHERE
    lower(full_name) LIKE 'anil%'
    OR lower(full_name) LIKE '%shafal%'
    OR lower(full_name) LIKE '%safal%'
    OR lower(full_name) LIKE 'alisha%'
    OR lower(full_name) LIKE 'aayush%'
    OR lower(full_name) LIKE 'smriti%'
    OR lower(full_name) LIKE 'sonica%'
),
office_location AS (
  SELECT
    COALESCE(office_latitude, 27.6875625) AS latitude,
    COALESCE(office_longitude, 85.3304375) AS longitude
  FROM public.settings
  ORDER BY updated_at DESC
  LIMIT 1
)
INSERT INTO public.attendance (
  user_id,
  date,
  status,
  check_in_time,
  check_out_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy_meters,
  work_hours,
  is_late,
  is_early_checkout,
  work_location,
  remarks,
  is_edited,
  deleted_at
)
SELECT
  employee.user_id,
  target_dates.attendance_date,
  'absent'::public.attendance_status,
  NULL,
  NULL,
  office_location.latitude,
  office_location.longitude,
  0,
  0,
  false,
  false,
  'Office',
  'Absent due to examination',
  true,
  NULL
FROM target_employees employee
CROSS JOIN target_dates
CROSS JOIN office_location
ON CONFLICT (user_id, date) WHERE (deleted_at IS NULL)
DO UPDATE SET
  status = EXCLUDED.status,
  check_in_time = NULL,
  check_out_time = NULL,
  check_in_latitude = EXCLUDED.check_in_latitude,
  check_in_longitude = EXCLUDED.check_in_longitude,
  check_in_accuracy_meters = EXCLUDED.check_in_accuracy_meters,
  work_hours = 0,
  is_late = false,
  is_early_checkout = false,
  work_location = 'Office',
  remarks = EXCLUDED.remarks,
  is_edited = true,
  updated_at = now();
