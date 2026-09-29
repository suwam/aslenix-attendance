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
    if (onProgress) onProgress(`Report generation feature has been removed.`);
    return { success: true, count: 0, startAd: "", endAd: "" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function buildHistoricalReportProfiles(profiles: any[], attendances: any[], standups: any[]) {
  const historyUserIds = new Set(
    [...attendances, ...standups].map((row) => row.user_id).filter(Boolean),
  );
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const rows = profiles.filter(
    (profile) => profile.approval_status === "approved" || historyUserIds.has(profile.user_id),
  );

  historyUserIds.forEach((userId) => {
    if (profilesByUser.has(userId)) return;
    rows.push({
      user_id: userId,
      full_name: "Former employee",
      department: null,
      employee_code: null,
      approval_status: "removed",
    });
  });

  return rows.sort((a, b) =>
    String(a.full_name || "").localeCompare(String(b.full_name || ""), undefined, {
      sensitivity: "base",
    }),
  );
}
