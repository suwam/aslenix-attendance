import { format, subDays } from "date-fns";
import NepaliDate from "nepali-date-converter";

function toLocalDate(date: Date | string) {
  if (date instanceof Date) return date;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(date);
}

/**
 * Weekly reporting cycle: Wednesday (Budhabar) to Tuesday (Mangalbar).
 * This function returns the start (Wed) and end (Tue) dates of the most recently COMPLETED reporting week relative to the provided date.
 */
export function getPreviousReportingWeek(relativeToDate: Date | string = new Date()) {
  const adDate = toLocalDate(relativeToDate);
  const bsDate = new NepaliDate(adDate);

  // getDay(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  const dayOfWeek = bsDate.getDay();

  // Days since last Tuesday
  // If today is Tuesday (2), the last Tuesday was 7 days ago.
  // If today is Wednesday (3), the last Tuesday was 1 day ago.
  // If today is Sunday (0), the last Tuesday was 5 days ago.
  let daysSinceLastTuesday = dayOfWeek - 2;
  if (daysSinceLastTuesday <= 0) {
    daysSinceLastTuesday += 7;
  }

  const endAdDate = subDays(adDate, daysSinceLastTuesday);
  const startAdDate = subDays(endAdDate, 6);

  return {
    startAd: format(startAdDate, "yyyy-MM-dd"),
    endAd: format(endAdDate, "yyyy-MM-dd"),
    label: `${new NepaliDate(startAdDate).format("MMM DD")} - ${new NepaliDate(endAdDate).format("MMM DD, YYYY")}`,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function calculateAiScores(
  hours: number,
  hasBlocker: boolean,
  hasPlan: boolean,
  hasUpdate: boolean,
) {
  const score = clamp(
    Math.round(
      58 + Math.min(hours, 9) * 4 + (hasPlan ? 8 : 0) + (hasUpdate ? 8 : 0) - (hasBlocker ? 14 : 0),
    ),
    35,
    98,
  );
  const consistency = clamp(Math.round(score - (hasBlocker ? 7 : 0) + (hasPlan ? 4 : -4)), 30, 98);
  const focus = clamp(
    Math.round(52 + Math.min(hours, 8.5) * 5 - (hours > 9.5 ? 8 : 0) - (hasBlocker ? 5 : 0)),
    30,
    96,
  );
  const mood = clamp(Math.round((score + consistency + focus) / 3 + (hasBlocker ? -8 : 4)), 25, 98);

  let status = "On Track";
  if (hasBlocker) status = "Blocked";
  else if (score < 72) status = "Needs Attention";

  let badge = "⚡ Fast Responder";
  if (score >= 88) badge = "🔥 Most Productive";
  else if (consistency >= 84) badge = "🎯 Consistent Performer";
  else if (hasPlan) badge = "🤖 AI Optimized";

  return { score, consistency, focus, mood, status, badge };
}

export function generateWeeklyAiSummary(
  standups: any[],
  totalHours: number,
  totalBlockers: number,
  avgScore: number,
) {
  if (standups.length === 0) {
    return {
      performance: "No standups submitted for the week.",
      achievements: "N/A",
      challenges: "N/A",
      productivity: "N/A",
      attendance: "N/A",
      recommendations: "Submit daily standups to activate AI insights.",
    };
  }

  const hasHighBlockers = totalBlockers > 2;
  const isHighPerformer = avgScore >= 85;
  const isLowPerformer = avgScore < 65;

  let performance = "Employee maintained a steady cadence throughout the week.";
  if (isHighPerformer)
    performance = "Outstanding weekly performance with high focus and execution momentum.";
  if (isLowPerformer)
    performance = "Performance trend indicates potential execution risks or reduced focus.";

  let achievements = "Consistent daily updates submitted.";
  if (totalHours > 40) achievements = "High volume of work hours logged with sustained effort.";
  if (avgScore >= 80) achievements = "Strong execution quality and task delivery observed.";

  let challenges = "No significant blockers reported.";
  if (totalBlockers > 0)
    challenges = `Reported ${totalBlockers} blockers requiring context switching or assistance.`;
  if (hasHighBlockers)
    challenges = "High number of blocking issues impacted overall execution flow.";

  let productivity = "Average productivity levels sustained.";
  if (isHighPerformer) productivity = "Highly focused execution periods with minimal distractions.";
  if (isLowPerformer)
    productivity = "Productivity impacted possibly by blockers or inconsistent updates.";

  let recommendations = "Maintain current rhythm and focus blocks.";
  if (hasHighBlockers)
    recommendations = "Escalate blocking issues earlier in the week to maintain momentum.";
  if (isLowPerformer)
    recommendations =
      "Break down tasks into smaller, manageable pieces to improve daily completion rates.";
  if (totalHours > 45)
    recommendations = "Monitor workload to prevent burnout. Ensure adequate rest periods.";

  return {
    performance,
    achievements,
    challenges,
    productivity,
    attendance: "Attendance patterns tracked normally.",
    recommendations,
  };
}
