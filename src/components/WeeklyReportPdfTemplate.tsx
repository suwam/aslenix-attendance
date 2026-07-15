import React, { forwardRef } from "react";
import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
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
      className="pdf-page relative flex flex-col bg-white text-slate-900 mx-auto shadow-sm"
      style={{
        width: A4_WIDTH,
        minHeight: A4_HEIGHT,
        padding: "20mm 20mm",
        boxSizing: "border-box",
        pageBreakAfter: "always",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div className="flex-1">
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
      <div ref={ref} className="bg-white text-black flex flex-col items-center py-10">
        <PdfPage pageNumber={1} totalPages={1}>
          <div className="mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-wider mb-6">Daily Standup Report</h1>
            <div className="text-base leading-relaxed">
              <div><span className="font-bold">Employee:</span> {profile.full_name}</div>
              <div><span className="font-bold">Department:</span> {profile.department || "Team Member"}</div>
              <div><span className="font-bold">Date:</span> {report.report_date ? `${formatNepaliDate(report.report_date, "YYYY-MM-DD")} (BS)` : `${formatNepaliDate(report.week_start || report.month_start, "YYYY-MM-DD")} to ${formatNepaliDate(report.week_end || report.month_end, "YYYY-MM-DD")} (BS)`}</div>
            </div>
          </div>

          <div className="space-y-10">
            {timeline.filter((d: any) => d.status === "Submitted").map((day: any, idx: number) => {
              const works = day.today ? day.today.split('\n').filter((l: string) => l.trim().length > 0) : [];
              const blockers = (day.blockers_text && day.blockers_text.toLowerCase() !== "none") 
                ? day.blockers_text.split('\n').filter((l: string) => l.trim().length > 0)
                : [];

              return (
                <div key={idx} className="space-y-6">
                  {!report.report_date && (
                    <h2 className="text-lg font-bold border-b border-black pb-1">{formatNepaliDate(day.date, "YYYY-MM-DD")} (BS)</h2>
                  )}
                  
                  <div>
                    <h2 className="text-lg font-bold mb-2">Today's Work</h2>
                    {works.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {works.map((w: string, i: number) => (
                          <li key={i} className="text-base">{w.replace(/^- /, '')}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-base italic">No work updates submitted.</p>
                    )}
                  </div>

                  <div>
                    <h2 className="text-lg font-bold mb-2">Blockers</h2>
                    {blockers.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {blockers.map((b: string, i: number) => (
                          <li key={i} className="text-base">{b.replace(/^- /, '')}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-base italic">No blockers reported.</p>
                    )}
                  </div>
                </div>
              );
            })}

            {timeline.filter((d: any) => d.status === "Submitted").length === 0 && (
              <p className="text-base italic">No standup submissions found for this period.</p>
            )}
          </div>
        </PdfPage>
      </div>
    );
  }
);
