export type ReviewRating = "Excellent" | "Good" | "Average" | "Poor";

export const REVIEW_SCORE_BY_RATING: Record<ReviewRating, number> = {
  Excellent: 10,
  Good: 8,
  Average: 5,
  Poor: 2,
};

export type TaskComplexity = "small" | "medium" | "large" | "epic";

export const TASK_COMPLEXITY_POINTS: Record<TaskComplexity, number> = {
  small: 2,
  medium: 5,
  large: 13,
  epic: 34,
};

export const TASK_COMPLEXITY_LABELS: Record<TaskComplexity, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  epic: "Epic",
};

export const TASK_COMPLEXITY_DESCRIPTIONS: Record<TaskComplexity, string> = {
  small: "Quick, low-risk work that can usually finish in a few hours, such as a small fix, caption, asset resize, or simple QA pass.",
  medium: "A normal deliverable that takes focused work, such as a feature slice, blog post, email campaign, SEO update, or test plan.",
  large: "Multi-step work with planning or coordination, such as a landing page, ad campaign setup, full QA cycle, or HR policy rollout.",
  epic: "Long-term, high-impact work across days or weeks, such as a product launch, major campaign, architecture change, or full SEO strategy.",
};

type ReviewLike = {
  rating?: string | null;
  review_score?: number | null;
};

type TaskProgressLike = {
  progress?: number | null;
  status?: string | null;
  task_complexity?: string | null;
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
  const totalEffortPoints = tasks.reduce((sum, task) => sum + effortPointsForTask(task), 0);
  const completedEffortPoints = tasks
    .filter((task) => task.status === "completed" || Number(task.progress || 0) >= 100)
    .reduce((sum, task) => sum + effortPointsForTask(task), 0);
  const earnedEffortPoints = tasks.reduce(
    (sum, task) =>
      sum + effortPointsForTask(task) * (Math.min(100, Math.max(0, Number(task.progress || 0))) / 100),
    0,
  );
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
  const effortProgress = totalEffortPoints
    ? Number(((earnedEffortPoints / totalEffortPoints) * 100).toFixed(1))
    : 0;
  const effortCompletion = totalEffortPoints
    ? Number(((completedEffortPoints / totalEffortPoints) * 100).toFixed(1))
    : 0;

  return {
    totalTasks,
    activeTasks,
    completedTasks,
    totalTaskProgress,
    averageProgress,
    totalEffortPoints,
    earnedEffortPoints: Number(earnedEffortPoints.toFixed(1)),
    completedEffortPoints,
    effortProgress,
    effortCompletion,
    productivityContribution: effortProgress,
    completionTrend,
  };
}

export function normalizedTaskComplexity(value?: string | null): TaskComplexity {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "small" || normalized === "medium" || normalized === "large" || normalized === "epic") {
    return normalized;
  }
  return "medium";
}

export function effortPointsForTask(task: TaskProgressLike) {
  return TASK_COMPLEXITY_POINTS[normalizedTaskComplexity(task.task_complexity)];
}

export function calculateOverduePenalty(overdueTasks: number) {
  return Math.min(20, overdueTasks * 5);
}

export function calculateFinalEmployeeScore({
  taskProgressContribution,
  completedTaskContribution,
  attendance,
  averageReviewScore,
  achievementBonus,
  overduePenalty = 0,
}: {
  taskProgressContribution: number;
  completedTaskContribution?: number;
  attendance: number;
  averageReviewScore: number;
  achievementBonus: number;
  overduePenalty?: number;
}) {
  const normalizedReviewScore = averageReviewScore * 10;
  const hasCompletedTaskContribution = typeof completedTaskContribution === "number";
  const score = hasCompletedTaskContribution
    ? taskProgressContribution * 0.35 +
      Math.min(100, Math.max(0, completedTaskContribution)) * 0.12 +
      attendance * 0.22 +
      normalizedReviewScore * 0.2 +
      achievementBonus * 0.11 -
      overduePenalty
    : taskProgressContribution * 0.4 +
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
