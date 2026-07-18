import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval } from "date-fns";
import {
  getPreviousReportingWeek,
  calculateAiScores,
  generateWeeklyAiSummary,
} from "@/lib/weekly-report-utils";
import { getNepaliMonthRange } from "@/lib/nepali-calendar";

export type ReportType = "daily" | "weekly" | "monthly";

export async function generateReportsForWeekClient(
  referenceDate: Date | string = new Date(),
  reportType: ReportType = "weekly",
  onProgress?: (msg: string) => void,
  customEndDate?: Date | string,
) {
  try {
    let startAd: string;
    let endAd: string;

    if (reportType === "weekly") {
      if (customEndDate) {
        startAd =
          typeof referenceDate === "string" ? referenceDate : format(referenceDate, "yyyy-MM-dd");
        endAd =
          typeof customEndDate === "string" ? customEndDate : format(customEndDate, "yyyy-MM-dd");
      } else {
        const weekRange = getPreviousReportingWeek(referenceDate);
        startAd = weekRange.startAd;
        endAd = weekRange.endAd;
      }
    } else if (reportType === "monthly") {
      const monthRange = getNepaliMonthRange(0, referenceDate);
      startAd = monthRange.startAd;
      endAd = monthRange.endAd;
    } else {
      // daily
      const d =
        typeof referenceDate === "string" ? referenceDate : format(referenceDate, "yyyy-MM-dd");
      startAd = d;
      endAd = d;
    }

    if (onProgress) onProgress(`Fetching data for ${reportType} report: ${startAd} to ${endAd}...`);

    // Fetch all profiles
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, full_name, department, employee_code")
      .eq("approval_status", "approved");
    if (profileErr) throw profileErr;

    if (onProgress)
      onProgress(`Found ${profiles?.length || 0} approved employees. Processing data...`);

    // Fetch all standups for the date range
    const { data: standups, error: standupErr } = await supabase
      .from("standups")
      .select("*")
      .gte("date", startAd)
      .lte("date", endAd);
    if (standupErr) throw standupErr;

    // Fetch all attendance for the date range
    const { data: attendances, error: attErr } = await supabase
      .from("attendance")
      .select("*")
      .gte("date", startAd)
      .lte("date", endAd);
    if (attErr) throw attErr;

    const daysInInterval = eachDayOfInterval({ start: new Date(startAd), end: new Date(endAd) });
    const totalWorkingDays = daysInInterval.filter((d) => d.getDay() !== 6).length; // Exclude Saturdays

    let successCount = 0;

    for (const profile of profiles || []) {
      const userStandups = standups?.filter((s) => s.user_id === profile.user_id) || [];
      const userAttendance = attendances?.filter((a) => a.user_id === profile.user_id) || [];

      let totalScore = 0;
      let totalFocus = 0;
      let totalMood = 0;
      let totalHours = 0;
      let totalBlockers = 0;

      const timeline = daysInInterval.map((dayObj) => {
        const dStr = format(dayObj, "yyyy-MM-dd");
        const isSaturday = dayObj.getDay() === 6;
        const s = userStandups.find((s) => s.date === dStr);
        const a = userAttendance.find((a) => a.date === dStr);

        let status = "Missing";
        if (s) status = "Submitted";
        else if (a) status = "Present, No Standup";
        else if (isSaturday) status = "Weekend";

        const hasBlocker = !!(
          s?.blockers &&
          s.blockers.length > 5 &&
          s.blockers.toLowerCase() !== "none"
        );
        const hasPlan = !!(s?.today && s.today.length > 10);
        const hasUpdate = !!(s?.yesterday && s.yesterday.length > 10);
        const hours = s?.work_hours
          ? Number(s.work_hours)
          : a?.work_hours
            ? Number(a.work_hours)
            : 0;

        if (hasBlocker) totalBlockers++;
        totalHours += hours;

        let dailyScore = 0,
          dailyFocus = 0,
          dailyMood = 0;
        if (s) {
          const ai = calculateAiScores(hours, hasBlocker, hasPlan, hasUpdate);
          dailyScore = ai.score;
          dailyFocus = ai.focus;
          dailyMood = ai.mood;
          totalScore += dailyScore;
          totalFocus += dailyFocus;
          totalMood += dailyMood;
        }

        return {
          date: dStr,
          status,
          hours,
          blockers: hasBlocker ? "Yes" : "No",
          score: dailyScore,
          today: s?.today || "",
          yesterday: s?.yesterday || "",
          blockers_text: s?.blockers || "",
        };
      });

      const totalStandupsSubmitted = userStandups.length;
      const missingStandups = Math.max(0, totalWorkingDays - totalStandupsSubmitted);
      const avgScore =
        totalStandupsSubmitted > 0 ? Math.round(totalScore / totalStandupsSubmitted) : 0;
      const avgFocus =
        totalStandupsSubmitted > 0 ? Math.round(totalFocus / totalStandupsSubmitted) : 0;
      const avgMood =
        totalStandupsSubmitted > 0 ? Math.round(totalMood / totalStandupsSubmitted) : 0;
      const avgHours =
        totalStandupsSubmitted > 0 ? Number((totalHours / totalStandupsSubmitted).toFixed(1)) : 0;
      const attendancePercentage =
        totalWorkingDays > 0 ? Math.round((userAttendance.length / totalWorkingDays) * 100) : 0;

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
        timeline,
      };

      const ai_summary = generateWeeklyAiSummary(userStandups, totalHours, totalBlockers, avgScore);

      const table =
        reportType === "daily"
          ? "daily_standup_reports"
          : reportType === "monthly"
            ? "monthly_standup_reports"
            : "weekly_standup_reports";

      // Upsert logic for each report type
      if (reportType === "daily") {
        const { data: existing } = await supabase
          .from("daily_standup_reports")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("report_date", startAd)
          .single();
        if (existing) {
          const { error: updateErr } = await supabase
            .from("daily_standup_reports")
            .update({ status: "finalized", analytics_data, ai_summary })
            .eq("id", existing.id);
          if (!updateErr) successCount++;
        } else {
          const { error: insertErr } = await supabase.from("daily_standup_reports").insert({
            user_id: profile.user_id,
            report_date: startAd,
            status: "finalized",
            analytics_data,
            ai_summary,
          });
          if (!insertErr) successCount++;
        }
      } else if (reportType === "monthly") {
        const { data: existing } = await supabase
          .from("monthly_standup_reports")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("month_start", startAd)
          .single();
        if (existing) {
          const { error: updateErr } = await supabase
            .from("monthly_standup_reports")
            .update({ month_end: endAd, status: "finalized", analytics_data, ai_summary })
            .eq("id", existing.id);
          if (!updateErr) successCount++;
        } else {
          const { error: insertErr } = await supabase.from("monthly_standup_reports").insert({
            user_id: profile.user_id,
            month_start: startAd,
            month_end: endAd,
            status: "finalized",
            analytics_data,
            ai_summary,
          });
          if (!insertErr) successCount++;
        }
      } else {
        const { data: existing } = await supabase
          .from("weekly_standup_reports")
          .select("id")
          .eq("user_id", profile.user_id)
          .eq("week_start", startAd)
          .single();
        if (existing) {
          const { error: updateErr } = await supabase
            .from("weekly_standup_reports")
            .update({ week_end: endAd, status: "finalized", analytics_data, ai_summary })
            .eq("id", existing.id);
          if (!updateErr) successCount++;
        } else {
          const { error: insertErr } = await supabase.from("weekly_standup_reports").insert({
            user_id: profile.user_id,
            week_start: startAd,
            week_end: endAd,
            status: "finalized",
            analytics_data,
            ai_summary,
          });
          if (!insertErr) successCount++;
        }
      }
    }

    if (onProgress) onProgress(`Successfully generated ${successCount} reports!`);
    return { success: true, count: successCount, startAd, endAd };
  } catch (error: any) {
    console.error(`Manual ${reportType} report generation error:`, error);
    return { success: false, error: error.message };
  }
}
