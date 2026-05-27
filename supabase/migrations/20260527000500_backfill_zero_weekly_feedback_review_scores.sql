UPDATE public.weekly_feedback
SET review_score = CASE rating
  WHEN 'Excellent' THEN 10
  WHEN 'Good' THEN 8
  WHEN 'Average' THEN 5
  WHEN 'Poor' THEN 2
  ELSE review_score
END
WHERE review_score = 0;
