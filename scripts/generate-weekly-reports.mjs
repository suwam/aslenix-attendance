import { createClient } from "@supabase/supabase-js";
import { format, subDays, eachDayOfInterval } from "date-fns";
import NepaliDateMod from "nepali-date-converter";
const NepaliDate = NepaliDateMod.default || NepaliDateMod;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY environment variable.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function getPreviousReportingWeek() {
  const adDate = new Date();
  const bsDate = new NepaliDate(adDate);
  const dayOfWeek = bsDate.getDay();
  
  let daysSinceLastTuesday = dayOfWeek - 2;
  if (daysSinceLastTuesday <= 0) {
    daysSinceLastTuesday += 7;
  }
  
  const endAdDate = subDays(adDate, daysSinceLastTuesday);
  const startAdDate = subDays(endAdDate, 6);
  
  return {
    startAd: format(startAdDate, "yyyy-MM-dd"),
    endAd: format(endAdDate, "yyyy-MM-dd"),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function calculateAiScores(hours, hasBlocker, hasPlan, hasUpdate) {
  const score = clamp(Math.round(58 + Math.min(hours, 9) * 4 + (hasPlan ? 8 : 0) + (hasUpdate ? 8 : 0) - (hasBlocker ? 14 : 0)), 35, 98);
  const consistency = clamp(Math.round(score - (hasBlocker ? 7 : 0) + (hasPlan ? 4 : -4)), 30, 98);
  const focus = clamp(Math.round(52 + Math.min(hours, 8.5) * 5 - (hours > 9.5 ? 8 : 0) - (hasBlocker ? 5 : 0)), 30, 96);
  const mood = clamp(Math.round((score + consistency + focus) / 3 + (hasBlocker ? -8 : 4)), 25, 98);
  return { score, consistency, focus, mood };
}

function generateWeeklyAiSummary(standups, totalHours, totalBlockers, avgScore) {
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
  if (isHighPerformer) performance = "Outstanding weekly performance with high focus and execution momentum.";
  if (isLowPerformer) performance = "Performance trend indicates potential execution risks or reduced focus.";

  let achievements = "Consistent daily updates submitted.";
  if (totalHours > 40) achievements = "High volume of work hours logged with sustained effort.";
  if (avgScore >= 80) achievements = "Strong execution quality and task delivery observed.";

  let challenges = "No significant blockers reported.";
  if (totalBlockers > 0) challenges = `Reported ${totalBlockers} blockers requiring context switching or assistance.`;
  if (hasHighBlockers) challenges = "High number of blocking issues impacted overall execution flow.";

  let productivity = "Average productivity levels sustained.";
  if (isHighPerformer) productivity = "Highly focused execution periods with minimal distractions.";
  if (isLowPerformer) productivity = "Productivity impacted possibly by blockers or inconsistent updates.";

  let recommendations = "Maintain current rhythm and focus blocks.";
  if (hasHighBlockers) recommendations = "Escalate blocking issues earlier in the week to maintain momentum.";
  if (isLowPerformer) recommendations = "Break down tasks into smaller, manageable pieces to improve daily completion rates.";
  if (totalHours > 45) recommendations = "Monitor workload to prevent burnout. Ensure adequate rest periods.";

  return { performance, achievements, challenges, productivity, attendance: "Attendance patterns tracked normally.", recommendations };
}

async function run() {
  const { startAd, endAd } = getPreviousReportingWeek();
  console.log(`Generating reports for week: ${startAd} to ${endAd}`);

  // Fetch all profiles
  const { data: profiles, error: profileErr } = await supabase.from("profiles").select("user_id").eq("approval_status", "approved");
  if (profileErr) throw profileErr;

  // Fetch all standups for the week
  const { data: standups, error: standupErr } = await supabase
    .from("standups")
    .select("*")
    .gte("date", startAd)
    .lte("date", endAd);
  if (standupErr) throw standupErr;

  // Fetch attendance to calculate leave/late metrics
  const { data: attendance, error: attErr } = await supabase
    .from("attendance")
    .select("*")
    .gte("date", startAd)
    .lte("date", endAd);
  if (attErr) throw attErr;

  const allDates = eachDayOfInterval({ start: new Date(startAd), end: new Date(endAd) }).map(d => format(d, "yyyy-MM-dd"));

  for (const profile of profiles) {
    const userStandups = standups.filter(s => s.user_id === profile.user_id);
    const userAttendance = attendance.filter(a => a.user_id === profile.user_id);
    
    let totalWorkingDays = allDates.length;
    let totalStandupsSubmitted = userStandups.length;
    let missingStandups = totalWorkingDays - totalStandupsSubmitted;
    
    let totalHours = 0;
    let totalBlockers = 0;
    let totalScore = 0;
    let totalFocus = 0;
    let totalMood = 0;

    const timeline = allDates.map(date => {
        const s = userStandups.find(s => s.date === date);
        const a = userAttendance.find(a => a.date === date);
        
        let hasBlocker = Boolean(s?.blockers?.trim());
        let hasPlan = Boolean(s?.today?.trim());
        let hasUpdate = Boolean(s?.yesterday?.trim());
        let hours = Number(s?.work_hours || 0);
        
        if (s) {
            totalHours += hours;
            if (hasBlocker) totalBlockers += 1;
            
            const scores = calculateAiScores(hours, hasBlocker, hasPlan, hasUpdate);
            totalScore += scores.score;
            totalFocus += scores.focus;
            totalMood += scores.mood;
            
            return { date, status: "Submitted", hours, score: scores.score, blockers: hasBlocker ? "Yes" : "No" };
        }
        return { date, status: "No Standup", hours: 0, score: 0, blockers: "No" };
    });

    const avgScore = totalStandupsSubmitted > 0 ? Math.round(totalScore / totalStandupsSubmitted) : 0;
    const avgFocus = totalStandupsSubmitted > 0 ? Math.round(totalFocus / totalStandupsSubmitted) : 0;
    const avgMood = totalStandupsSubmitted > 0 ? Math.round(totalMood / totalStandupsSubmitted) : 0;
    const avgHours = totalStandupsSubmitted > 0 ? Number((totalHours / totalStandupsSubmitted).toFixed(1)) : 0;
    const attendancePercentage = Math.round((userAttendance.length / totalWorkingDays) * 100);

    const analytics_data = {
      totalWorkingDays,
      totalStandupsSubmitted,
      missingStandups,
      totalHours,
      avgHours,
      totalBlockers,
      avgScore,
      avgFocus,
      avgMood,
      attendancePercentage,
      timeline
    };

    const ai_summary = generateWeeklyAiSummary(userStandups, totalHours, totalBlockers, avgScore);

    // Check if it exists
    const { data: existing } = await supabase
      .from("weekly_standup_reports")
      .select("id")
      .eq("user_id", profile.user_id)
      .eq("week_start", startAd)
      .single();

    if (existing) {
      const { error: updateErr } = await supabase
        .from("weekly_standup_reports")
        .update({
          week_end: endAd,
          status: "finalized",
          analytics_data,
          ai_summary
        })
        .eq("id", existing.id);
      if (updateErr) console.error(`Failed to update for user ${profile.user_id}:`, updateErr);
    } else {
      const { error: insertErr } = await supabase
        .from("weekly_standup_reports")
        .insert({
          user_id: profile.user_id,
          week_start: startAd,
          week_end: endAd,
          status: "finalized",
          analytics_data,
          ai_summary
        });
      if (insertErr) console.error(`Failed to insert for user ${profile.user_id}:`, insertErr);
    }
  }

  console.log(`Generated reports for ${profiles.length} employees.`);
}

run().catch(err => {
  console.error("Failed to generate weekly reports:", err);
  process.exit(1);
});
