import React, { forwardRef } from "react";
import { format } from "date-fns";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Activity, BrainCircuit, CalendarCheck2, Clock, ShieldAlert, Users, Target, Zap, ChevronRight } from "lucide-react";

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
      className="relative flex flex-col bg-white text-slate-900 mx-auto overflow-hidden shadow-sm"
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

function KpiCard({ title, value, label }: { title: string; value: string | number; label: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-widest text-slate-500 mb-2">{title}</h3>
      <div className="text-3xl font-black text-slate-900 mb-1">{value}</div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
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
        {/* PAGE 1: COVER & EXECUTIVE SUMMARY */}
        <PdfPage pageNumber={1} totalPages={3}>
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">ASLENIX</h1>
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase mt-1">Enterprise Analytics</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-slate-900">Weekly Standup Report</h2>
              <p className="text-sm font-semibold text-slate-500 mt-1">
                {formatNepaliDate(report.week_start, "MMM DD, YYYY")} — {formatNepaliDate(report.week_end, "MMM DD, YYYY")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Employee Profile</h3>
              <p className="text-2xl font-black text-slate-900">{profile.full_name}</p>
              <p className="text-base font-semibold text-slate-600 mt-1">{profile.department || "Team Member"}</p>
              <p className="text-sm font-medium text-slate-500 mt-1">ID: {profile.employee_code || "N/A"}</p>
            </div>
            <div className="text-right">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Report Details</h3>
              <p className="text-base font-bold text-slate-800">Generated: {format(new Date(), "MMM dd, yyyy")}</p>
              <p className="text-sm font-semibold text-slate-600 mt-1">Overall Score: <span className="text-slate-900 font-black">{data.avgScore}/100</span></p>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-4 border-b border-slate-200 pb-2">Executive Performance Summary</h3>
            <p className="text-base leading-relaxed text-slate-700 font-medium">
              {ai.performance}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-10">
            <KpiCard title="Productivity" value={`${data.avgScore}`} label="AI Confidence Score" />
            <KpiCard title="Focus Time" value={`${data.avgFocus}`} label="Sustained Momentum" />
            <KpiCard title="Team Mood" value={`${data.avgMood}`} label="Wellness Indicator" />
            <KpiCard title="Work Hours" value={`${data.totalHours}h`} label="Total Logged Time" />
            <KpiCard title="Attendance" value={`${data.attendancePercentage}%`} label="Presence Rate" />
            <KpiCard title="Standups" value={`${data.totalStandupsSubmitted}/${data.totalWorkingDays}`} label="Submission Rate" />
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-4 border-b border-slate-200 pb-2">AI Insights & Coaching</h3>
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Target size={14} className="text-emerald-500"/> Achievements</p>
                <p className="text-sm font-medium text-slate-800">{ai.achievements}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ShieldAlert size={14} className="text-amber-500"/> Challenges</p>
                <p className="text-sm font-medium text-slate-800">{ai.challenges}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Zap size={14} className="text-indigo-500"/> Recommendations</p>
                <p className="text-sm font-medium text-slate-800">{ai.recommendations}</p>
              </div>
            </div>
          </div>
        </PdfPage>

        {/* PAGE 2: TIMELINE */}
        <PdfPage pageNumber={2} totalPages={3}>
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Daily Execution Timeline</h2>
            <p className="text-sm font-medium text-slate-500">Breakdown of daily standup submissions, hours, and productivity signals.</p>
          </div>

          <div className="space-y-4">
            {timeline.map((day: any) => (
              <div key={day.date} className="flex border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 w-32 shrink-0 p-4 border-r border-slate-200 flex flex-col justify-center items-center text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{format(new Date(day.date), "EEEE")}</div>
                  <div className="text-lg font-black text-slate-800 mt-1">{format(new Date(day.date), "MMM dd")}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-2">{formatNepaliDate(day.date, "MMM DD, BS")}</div>
                </div>
                <div className="flex-1 p-5 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${day.status === "Submitted" ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">{day.status}</span>
                    </div>
                    {day.blockers === "Yes" && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded-md border border-amber-200">BLOCKER REPORTED</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hours</p>
                      <p className="text-xl font-black text-slate-900">{day.hours > 0 ? `${day.hours}h` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Productivity</p>
                      <p className="text-xl font-black text-slate-900">{day.score > 0 ? day.score : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Focus</p>
                      <p className="text-xl font-black text-slate-900">{day.score > 0 ? Math.round(day.score * 0.95) : "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PdfPage>

        {/* PAGE 3: CHARTS */}
        <PdfPage pageNumber={3} totalPages={3}>
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-2">Trend Analysis</h2>
            <p className="text-sm font-medium text-slate-500">Visualizing productivity, effort, and execution momentum over the reporting period.</p>
          </div>

          <div className="space-y-8">
            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2"><Activity size={16} /> Productivity & Focus Trend</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "EEE")} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Area type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2"><Clock size={16} /> Working Hours Distribution</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), "EEE")} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </PdfPage>
      </div>
    );
  }
);
