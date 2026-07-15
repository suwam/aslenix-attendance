import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Download, FileBarChart, RefreshCw, Calendar as CalendarIcon, Play } from "lucide-react";
import { toast } from "sonner";
import { formatNepaliDate, bsInputToAdDateString, getNepaliMonthRange } from "@/lib/nepali-calendar";
import { WeeklyReportPdfTemplate } from "@/components/WeeklyReportPdfTemplate";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { captureSanitizedPdfPage } from "@/lib/pdf-utils";
import { BSDateInput } from "@/components/BSDateInput";
import { generateReportsForWeekClient, ReportType } from "@/lib/generate-reports-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/admin/weekly-reports")({ component: AdminReportsPage });

function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Generation Filters State
  const [generateType, setGenerateType] = useState<ReportType>("daily");
  const [generateDate, setGenerateDate] = useState("");
  const [generateEndDate, setGenerateEndDate] = useState("");
  const [generateStatus, setGenerateStatus] = useState("all");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState("");
  
  // Display Filter State
  const [displayType, setDisplayType] = useState<ReportType>("daily");

  const fetchReports = async () => {
    setLoading(true);
    let tableName = "daily_standup_reports";
    let orderColumn = "report_date";
    if (displayType === "weekly") {
      tableName = "weekly_standup_reports";
      orderColumn = "week_start";
    } else if (displayType === "monthly") {
      tableName = "monthly_standup_reports";
      orderColumn = "month_start";
    }

    const { data, error } = await supabase
      .from(tableName)
      .select(`
        *,
        profiles (
          user_id,
          full_name,
          department,
          employee_code
        )
      `)
      .order(orderColumn, { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch reports");
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, [displayType]);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      const q = search.toLowerCase();
      let matchesSearch = true;
      if (q) {
        const name = (r.profiles?.full_name || "").toLowerCase();
        const dept = (r.profiles?.department || "").toLowerCase();
        matchesSearch = name.includes(q) || dept.includes(q);
      }
      
      let matchesStatus = true;
      if (generateStatus !== "all") {
        matchesStatus = (r.status || "").toLowerCase() === generateStatus.toLowerCase();
      }
      
      let matchesDate = true;
      if (generateDate) {
        const adDateStr = bsInputToAdDateString(generateDate);
        if (adDateStr) {
          if (displayType === "daily") {
            matchesDate = r.report_date === adDateStr;
          } else if (displayType === "weekly") {
            matchesDate = r.week_start === adDateStr;
            if (generateEndDate) {
              const adEndStr = bsInputToAdDateString(generateEndDate);
              if (adEndStr) {
                matchesDate = r.week_start === adDateStr && r.week_end === adEndStr;
              }
            }
          } else if (displayType === "monthly") {
            const monthRange = getNepaliMonthRange(0, adDateStr);
            matchesDate = r.month_start === monthRange.startAd;
          }
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reports, search, generateStatus, generateDate, generateEndDate, displayType]);

  const handleExport = async (report: any) => {
    try {
      setExportingId(report.id);
      
      // We pass the start date as week_start to keep the template happy
      let reportForTemplate = { ...report };
      if (displayType === "daily") {
        reportForTemplate.week_start = report.report_date;
        reportForTemplate.week_end = report.report_date;
      }
      if (displayType === "monthly") {
        reportForTemplate.week_start = report.month_start;
        reportForTemplate.week_end = report.month_end;
      }

      setSelectedReport(reportForTemplate);
      
      // Wait for React to render the hidden component and for Recharts to animate/draw
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const pages = document.querySelectorAll('.pdf-page');
      if (!pages || pages.length === 0) throw new Error("No pages found to export");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      
      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const imgData = await captureSanitizedPdfPage(pageEl);
        
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = pdfHeight;
        let position = 0;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= 297; // 297 is A4 height in mm
        
        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= 297;
        }
      }
      
      let dateLabel = report.report_date;
      if (displayType === "weekly") dateLabel = report.week_start;
      if (displayType === "monthly") dateLabel = report.month_start;

      pdf.save(`${displayType}-Report-${report.profiles?.full_name?.replace(/\s+/g, '-')}-${dateLabel}.pdf`);
      toast.success("PDF generated successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to generate PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingId(null);
      setSelectedReport(null);
    }
  };

  const handleGenerateReports = async () => {
    if (!generateDate) {
      toast.error("Please select a date");
      return;
    }
    if (generateType === "weekly" && !generateEndDate) {
      toast.error("Please select an end date");
      return;
    }
    
    try {
      setIsGenerating(true);
      setGenerateProgress("Initializing...");
      
      const adDateStr = bsInputToAdDateString(generateDate);
      if (!adDateStr) throw new Error("Invalid start date");

      let adEndDateStr = undefined;
      if (generateType === "weekly" && generateEndDate) {
        adEndDateStr = bsInputToAdDateString(generateEndDate);
        if (!adEndDateStr) throw new Error("Invalid end date");
      }
      
      const result = await generateReportsForWeekClient(adDateStr, generateType, (msg) => setGenerateProgress(msg), adEndDateStr);
      
      if (result.success) {
        toast.success(`Successfully generated ${result.count} ${generateType} reports!`);
        setDisplayType(generateType); // Switch view to what we just generated
        fetchReports(); // Refresh the list
      } else {
        toast.error(`Generation failed: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate reports");
    } finally {
      setIsGenerating(false);
      setGenerateProgress("");
    }
  };

  return (
    <div className="relative overflow-hidden min-h-screen">
      <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-28 top-52 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <PageHeader
        title="Standup & Performance Reports"
        subtitle="Comprehensive AI-powered performance reports generated for all employees."
        actions={
          <Button onClick={fetchReports} variant="outline" className="gap-2 border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-400">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="mt-5 space-y-6">
        
        {/* Inline Filter Generation Bar */}
        <div className="bg-slate-50/50 backdrop-blur-xl border border-slate-200/60 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Report type</label>
            <Select value={generateType} onValueChange={(val: any) => setGenerateType(val)}>
              <SelectTrigger className="bg-white/80 border-slate-200">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily report</SelectItem>
                <SelectItem value="weekly">Weekly report</SelectItem>
                <SelectItem value="monthly">Monthly report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {generateType === "weekly" ? (
            <div className="flex-[2] flex gap-4 w-full">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date (BS)</label>
                <BSDateInput 
                  value={generateDate} 
                  onChange={setGenerateDate} 
                  disabled={isGenerating}
                  className="bg-white/80 border-slate-200 h-10"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date (BS)</label>
                <BSDateInput 
                  value={generateEndDate} 
                  onChange={setGenerateEndDate} 
                  disabled={isGenerating}
                  className="bg-white/80 border-slate-200 h-10"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date (BS)</label>
              <BSDateInput 
                value={generateDate} 
                onChange={setGenerateDate} 
                disabled={isGenerating}
                className="bg-white/80 border-slate-200 h-10"
              />
            </div>
          )}

          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
            <Select value={generateStatus} onValueChange={setGenerateStatus}>
              <SelectTrigger className="bg-white/80 border-slate-200">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="finalized">Finalized</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleGenerateReports} 
            disabled={isGenerating || !generateDate}
            className="w-full md:w-auto h-10 px-8 bg-gradient-to-r from-indigo-200 to-purple-200 hover:from-indigo-300 hover:to-purple-300 text-indigo-900 font-semibold border-0 shadow-sm transition-all"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Running...
              </span>
            ) : (
              "Run report"
            )}
          </Button>
        </div>
        
        {isGenerating && (
          <div className="text-xs text-center text-muted-foreground font-mono bg-cyan-500/5 p-2 rounded-lg border border-cyan-500/10">
            {generateProgress || "Processing data..."}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
          <GlassCard className="border border-cyan-300/15 bg-card shadow-[0_0_40px_rgba(34,211,238,0.08)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <FileBarChart className="text-cyan-400" size={20} />
                    Report Directory
                  </h2>
                  <div className="bg-slate-100 rounded-md p-1 flex">
                    <button onClick={() => setDisplayType('daily')} className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${displayType === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Daily</button>
                    <button onClick={() => setDisplayType('weekly')} className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${displayType === 'weekly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Weekly</button>
                    <button onClick={() => setDisplayType('monthly')} className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${displayType === 'monthly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Monthly</button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Showing {filtered.length} generated {displayType} reports</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-background/50 border-cyan-300/20 focus-visible:border-cyan-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs uppercase bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    <th className="px-4 py-3 font-semibold">Period</th>
                    <th className="px-4 py-3 font-semibold text-center">Score</th>
                    <th className="px-4 py-3 font-semibold text-center">Attendance</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        Loading reports...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        No {displayType} reports found. Select a date and click "Run report" to generate them.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((report) => (
                      <tr key={report.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{report.profiles?.full_name}</div>
                          <div className="text-xs text-muted-foreground">{report.profiles?.department || "N/A"}</div>
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {displayType === "daily" && formatNepaliDate(report.report_date, "MMM DD, YYYY")}
                          {displayType === "weekly" && `${formatNepaliDate(report.week_start, "MMM DD")} - ${formatNepaliDate(report.week_end, "MMM DD")}`}
                          {displayType === "monthly" && formatNepaliDate(report.month_start, "MMMM YYYY")}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-cyan-500/10 text-cyan-500 font-bold border border-cyan-500/20">
                            {report.analytics_data?.avgScore || 0}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-foreground font-medium">
                          {report.analytics_data?.attendancePercentage || 0}%
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                            {report.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={exportingId === report.id}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleExport(report); }}
                            className="gap-1.5 bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 transition-all shadow-[0_0_12px_rgba(217,70,239,0.15)]"
                          >
                            {exportingId === report.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="border border-fuchsia-300/15 bg-card/80 backdrop-blur-xl sticky top-24">
            <h3 className="text-lg font-bold text-foreground mb-4">About Reports</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Performance reports are automatically generated compiling data from standups and attendance.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              They include AI-driven insights on productivity, blocker trends, and attendance signals. Reports are locked once generated.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <Play size={18} className="text-cyan-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">On-Demand Generation</h4>
                  <p className="text-xs text-muted-foreground">Run for any specific date range</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Hidden container for PDF rendering */}
      {selectedReport && (
        <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none -z-50">
          <div ref={pdfContainerRef}>
            <WeeklyReportPdfTemplate
              report={selectedReport}
              profile={selectedReport.profiles || { full_name: "Unknown" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
