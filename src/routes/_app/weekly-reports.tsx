import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileBarChart, Trophy, FileText, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { WeeklyReportPdfTemplate } from "@/components/WeeklyReportPdfTemplate";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_app/weekly-reports")({ component: WeeklyReportsPage });

function WeeklyReportsPage() {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchReports = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("weekly_standup_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false });

      if (error) {
        toast.error("Failed to fetch your reports");
      } else {
        setReports(data || []);
      }
      setLoading(false);
    };

    fetchReports();
  }, [user]);

  const handleExport = async (report: any) => {
    try {
      setExportingId(report.id);
      setSelectedReport(report);
      
      // Wait for React to render the hidden component and for Recharts to animate/draw
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const pages = document.querySelectorAll('.pdf-page');
      if (!pages || pages.length === 0) throw new Error("No pages found to export");

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297);
      }
      
      pdf.save(`My-Weekly-Report-${report.week_start}.pdf`);
      toast.success("PDF generated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to generate PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingId(null);
      setSelectedReport(null);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-screen">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 top-52 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <PageHeader
        title="My Weekly Reports"
        subtitle="Review your AI-generated weekly performance summaries and download official PDF reports."
      />

      <div className="mt-5 grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-4">
          {loading ? (
            <GlassCard className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-cyan-500" size={32} />
            </GlassCard>
          ) : reports.length === 0 ? (
            <GlassCard className="text-center py-20 border border-dashed border-cyan-300/30">
              <FileBarChart className="mx-auto text-muted-foreground mb-4" size={40} />
              <h3 className="text-xl font-bold text-foreground">No reports generated yet</h3>
              <p className="text-muted-foreground mt-2">
                Your first weekly report will be available on the next reporting cycle (Wednesday).
              </p>
            </GlassCard>
          ) : (
            reports.map((report, idx) => (
              <GlassCard key={report.id} className="border border-cyan-300/15 bg-card/60 hover:bg-card/90 transition-all shadow-lg p-0 overflow-hidden relative group">
                {idx === 0 && (
                   <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[0.65rem] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg shadow-sm">
                     Latest Report
                   </div>
                )}
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 mb-5">
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-1">
                        Week of {formatNepaliDate(report.week_start, "MMMM DD")}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formatNepaliDate(report.week_start, "MMM DD, YYYY")} — {formatNepaliDate(report.week_end, "MMM DD, YYYY")}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleExport(report)}
                      disabled={exportingId === report.id}
                      className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                    >
                      {exportingId === report.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      Download Official PDF
                    </Button>
                  </div>
                  
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-muted/30 rounded-xl p-4 border border-border">
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Productivity Score</p>
                      <p className="text-3xl font-black text-foreground">{report.analytics_data?.avgScore || 0}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border">
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Total Hours Logged</p>
                      <p className="text-3xl font-black text-foreground">{report.analytics_data?.totalHours || 0}h</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4 border border-border">
                      <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Standups Submitted</p>
                      <p className="text-3xl font-black text-foreground">{report.analytics_data?.totalStandupsSubmitted || 0}/{report.analytics_data?.totalWorkingDays || 0}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2">
                      <Zap size={16} /> Executive AI Summary
                    </h4>
                    <p className="text-muted-foreground leading-relaxed text-sm">
                      {report.ai_summary?.performance}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))
          )}
        </div>
        
        <div className="space-y-6 hidden lg:block">
          <GlassCard className="border border-fuchsia-300/15 bg-card shadow-[0_0_30px_rgba(217,70,239,0.06)] p-5 text-sm">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              Maximize Your Score
            </h3>
            <ul className="space-y-3 mt-4 text-muted-foreground">
              <li className="flex gap-2 items-start"><span className="text-emerald-400">•</span> Submit your standup every day consistently.</li>
              <li className="flex gap-2 items-start"><span className="text-emerald-400">•</span> Clearly articulate your plan for tomorrow.</li>
              <li className="flex gap-2 items-start"><span className="text-emerald-400">•</span> Report blockers early so they don't drag down your execution score.</li>
              <li className="flex gap-2 items-start"><span className="text-emerald-400">•</span> Maintain stable working hours to avoid burnout flags.</li>
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Hidden container for PDF rendering */}
      {selectedReport && (
        <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none -z-50">
          <div ref={pdfContainerRef}>
            <WeeklyReportPdfTemplate
              report={selectedReport}
              profile={profile || { full_name: "Unknown" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
