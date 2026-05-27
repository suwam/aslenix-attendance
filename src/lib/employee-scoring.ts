export type ReviewRating = "Excellent" | "Good" | "Average" | "Poor";

export const REVIEW_SCORE_BY_RATING: Record<ReviewRating, number> = {
  Excellent: 10,
  Good: 8,
  Average: 5,
  Poor: 2,
};

type ReviewLike = {
  rating?: string | null;
  review_score?: number | null;
};

type TaskProgressLike = {
  progress?: number | null;
  status?: string | null;
};

export function reviewScoreFromRating(rating?: string | null) {
  return REVIEW_SCORE_BY_RATING[rating as ReviewRating] ?? 0;
}

export function resolvedReviewScore(review: ReviewLike) {
  const storedScore = Number(review.review_score || 0);
  return storedScore > 0 ? storedScore : reviewScoreFromRating(review.rating);
}

export function calculateReviewAverage(reviews: ReviewLike[]) {
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + resolvedReviewScore(review), 0);
  return Number((total / reviews.length).toFixed(1));
}

export function calculateTaskProgressMetrics(tasks: TaskProgressLike[]) {
  const totalTasks = tasks.length;
  const totalTaskProgress = tasks.reduce(
    (sum, task) => sum + Math.min(100, Math.max(0, Number(task.progress || 0))),
    0,
  );
  const averageProgress = totalTasks ? Number((totalTaskProgress / totalTasks).toFixed(1)) : 0;
  const completedTasks = tasks.filter(
    (task) => task.status === "completed" || Number(task.progress || 0) >= 100,
  ).length;
  const activeTasks = tasks.filter(
    (task) => task.status !== "completed" && Number(task.progress || 0) < 100,
  ).length;
  const completionTrend = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    activeTasks,
    completedTasks,
    totalTaskProgress,
    averageProgress,
    productivityContribution: averageProgress,
    completionTrend,
  };
}

export function calculateOverduePenalty(overdueTasks: number) {
  return Math.min(20, overdueTasks * 5);
}

export function calculateFinalEmployeeScore({
  taskProgressContribution,
  attendance,
  averageReviewScore,
  achievementBonus,
  overduePenalty = 0,
}: {
  taskProgressContribution: number;
  attendance: number;
  averageReviewScore: number;
  achievementBonus: number;
  overduePenalty?: number;
}) {
  const normalizedReviewScore = averageReviewScore * 10;
  const score =
    taskProgressContribution * 0.4 +
      attendance * 0.25 +
      normalizedReviewScore * 0.25 +
      achievementBonus * 0.1 -
      overduePenalty;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function ratingLabelFromAverage(score: number) {
  if (score >= 9) return "Excellent";
  if (score >= 6.5) return "Good";
  if (score >= 3.5) return "Average";
  if (score > 0) return "Poor";
  return "No reviews";
}
