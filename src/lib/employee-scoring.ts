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

type AttendanceLike = {
  date?: string | null;
  status?: string | null;
};

type StandupLike = {
  date?: string | null;
  yesterday?: string | null;
  today?: string | null;
  blockers?: string | null;
  work_hours?: number | string | null;
};

export function reviewScoreFromRating(rating?: string | null) {
  if (!rating) return 0;
  const normalized = rating.charAt(0).toUpperCase() + rating.slice(1).toLowerCase();
  return REVIEW_SCORE_BY_RATING[normalized as ReviewRating] ?? 0;
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

export function attendanceCreditForStatus(status?: string | null) {
  if (status === "present" || status === "wfh") return 1;
  if (status === "late") return 0.7;
  if (status === "half_day") return 0.5;
  return 0;
}

export function calculateWeightedAttendancePct(rows: AttendanceLike[], elapsedDays: number) {
  const creditByDate = new Map<string, number>();

  rows.forEach((row) => {
    if (!row.date) return;
    const credit = attendanceCreditForStatus(row.status);
    creditByDate.set(row.date, Math.max(creditByDate.get(row.date) || 0, credit));
  });

  const totalCredit = Array.from(creditByDate.values()).reduce((sum, value) => sum + value, 0);
  return Math.min(100, Math.round((totalCredit / Math.max(1, elapsedDays)) * 100));
}

export function calculateStandupScore(rows: StandupLike[], elapsedDays: number) {
  const submittedByDate = new Map<string, StandupLike>();

  rows.forEach((row) => {
    if (!row.date || !isStandupSubmitted(row)) return;
    const existing = submittedByDate.get(row.date);
    if (!existing || standupQualityScore(row) > standupQualityScore(existing)) {
      submittedByDate.set(row.date, row);
    }
  });

  const submittedRows = Array.from(submittedByDate.values());
  const submittedDays = submittedRows.length;
  const submissionRate = Math.min(100, Math.round((submittedDays / Math.max(1, elapsedDays)) * 100));
  const averageQuality = submittedDays
    ? Math.round(submittedRows.reduce((sum, row) => sum + standupQualityScore(row), 0) / submittedDays)
    : 0;
  const blockerCommunication = submittedDays
    ? Math.round(submittedRows.reduce((sum, row) => sum + blockerCommunicationScore(row), 0) / submittedDays)
    : 0;
  const score = Math.round(submissionRate * 0.5 + averageQuality * 0.3 + blockerCommunication * 0.2);

  return {
    score,
    submittedDays,
    submissionRate,
    averageQuality,
    blockerCommunication,
  };
}

export function calculateOverduePenalty(overdueTasks: number) {
  return Math.min(20, overdueTasks * 5);
}

export function calculateFinalEmployeeScore({
  taskProgressContribution,
  completedTaskContribution,
  attendance,
  averageReviewScore,
  standupScore = 0,
  achievementBonus,
  overduePenalty = 0,
}: {
  taskProgressContribution: number;
  completedTaskContribution?: number;
  attendance: number;
  averageReviewScore: number;
  standupScore?: number;
  achievementBonus: number;
  overduePenalty?: number;
}) {
  const normalizedReviewScore = averageReviewScore * 10;
  const hasCompletedTaskContribution = typeof completedTaskContribution === "number";
  const score = hasCompletedTaskContribution
    ? taskProgressContribution * 0.3 +
      Math.min(100, Math.max(0, completedTaskContribution)) * 0.1 +
      attendance * 0.2 +
      normalizedReviewScore * 0.18 +
      standupScore * 0.15 +
      achievementBonus * 0.07 -
      overduePenalty
    : taskProgressContribution * 0.35 +
      attendance * 0.22 +
      normalizedReviewScore * 0.2 +
      standupScore * 0.15 +
      achievementBonus * 0.08 -
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

function isStandupSubmitted(row: StandupLike) {
  return Boolean(row.yesterday?.trim() || row.today?.trim() || row.blockers?.trim());
}

function standupQualityScore(row: StandupLike) {
  if (!isStandupSubmitted(row)) return 0;
  let score = 0;
  if (wordCount(row.yesterday) >= 5) score += 35;
  if (wordCount(row.today) >= 5) score += 35;
  if (Number(row.work_hours || 0) > 0) score += 15;
  score += blockerCommunicationScore(row) >= 100 ? 15 : 8;
  return Math.min(100, score);
}

function blockerCommunicationScore(row: StandupLike) {
  const blockers = row.blockers?.trim() || "";
  if (!blockers) return 100;
  return wordCount(blockers) >= 4 ? 100 : 60;
}

function wordCount(value?: string | null) {
  return String(value || "").trim().split(/\s+/).filter(Boolean).length;
}
