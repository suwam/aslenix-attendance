import React, { forwardRef } from "react";
import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { ShieldAlert } from "lucide-react";

type ReportProfile = {
  full_name: string;
  department?: string | null;
  employee_code?: string | null;
};

type WeeklyReportPdfTemplateProps = {
  report: any;
  profile: ReportProfile;
};

const A4_WIDTH = "210mm";
const A4_HEIGHT = "297mm";

// A single A4 page container
function PdfPage({ children, pageNumber, totalPages }: { children: React.ReactNode; pageNumber: number; totalPages: number }) {
  return (
    <div
      className="pdf-page relative flex flex-col bg-white text-slate-900 mx-auto overflow-hidden shadow-sm"
      style={{
        width: A4_WIDTH,
        height: A4_HEIGHT,
        padding: "20mm 20mm",
        boxSizing: "border-box",
        pageBreakAfter: "always",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div className="flex-1 min-h-0">
        {children}
      </div>
      
      {/* Footer */}
      <div className="mt-auto pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
        <div>ASLENIX DIGITAL ATTENDANCE SYSTEM</div>
        <div>
          PAGE {pageNumber} OF {totalPages}
        </div>
      </div>
    </div>
  );
}



export const WeeklyReportPdfTemplate = forwardRef<HTMLDivElement, WeeklyReportPdfTemplateProps>(
  ({ report, profile }, ref) => {
    if (!report) return null;

    const data = report.analytics_data;
    const ai = report.ai_summary;
    const timeline = data.timeline || [];

    return (
      <div ref={ref} className="bg-slate-100 flex flex-col items-center py-10 gap-10">
        <PdfPage pageNumber={1} totalPages={1}>
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">ASLENIX</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase mt-1">Standup Report</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-900">{report.report_date ? "Daily Report" : "Summary Report"}</h2>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                {report.report_date ? formatNepaliDate(report.report_date, "MMM DD, YYYY") : `${formatNepaliDate(report.week_start || report.month_start, "MMM DD, YYYY")} — ${formatNepaliDate(report.week_end || report.month_end, "MMM DD, YYYY")}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Employee Profile</h3>
              <p className="text-2xl font-black text-slate-900">{profile.full_name}</p>
              <p className="text-base font-semibold text-slate-600 mt-1">{profile.department || "Team Member"}</p>
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Report Details</h3>
              <p className="text-base font-bold text-slate-800">Generated: {format(new Date(), "MMM dd, yyyy")}</p>
              <p className="text-sm font-semibold text-slate-600 mt-1">ID: {profile.employee_code || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-6">
            {timeline.filter((d: any) => d.status === "Submitted").map((day: any, idx: number) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">{formatNepaliDate(day.date, "MMM DD, YYYY")}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{format(new Date(day.date), "EEEE")}</span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Today I Worked On</h4>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{day.today || "No update provided."}</p>
                  </div>
                  {(day.blockers_text && day.blockers_text.toLowerCase() !== "none") && (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1"><ShieldAlert size={14}/> Blockers</h4>
                      <p className="text-sm text-amber-900 whitespace-pre-wrap">{day.blockers_text}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {timeline.filter((d: any) => d.status === "Submitted").length === 0 && (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500 font-medium">No standup submissions found for this period.</p>
              </div>
            )}
          </div>
        </PdfPage>
      </div>
    );
  }
);
