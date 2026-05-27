UPDATE public.profiles
SET is_eom_eligible = false
WHERE lower(coalesce(department, '')) = 'hr'
  OR lower(coalesce(department, '')) LIKE '%human resources%'
  OR lower(coalesce(position, '')) = 'hr'
  OR lower(coalesce(position, '')) LIKE 'hr %'
  OR lower(coalesce(position, '')) LIKE '%human resources%'
  OR lower(coalesce(position, '')) LIKE '%supervisor%';
