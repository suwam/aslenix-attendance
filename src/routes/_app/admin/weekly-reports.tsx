import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Download, Eye, FileText, FileBarChart, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatNepaliDate } from "@/lib/nepali-calendar";
import { WeeklyReportPdfTemplate } from "@/components/WeeklyReportPdfTemplate";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/_app/admin/weekly-reports")({ component: AdminWeeklyReportsPage });

function AdminWeeklyReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_standup_reports")
      .select(`
        *,
        profiles (
          user_id,
          full_name,
          department,
          employee_code
        )
      `)
      .order("week_start", { ascending: false })
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
  }, []);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      const q = search.toLowerCase();
      if (!q) return true;
      const name = (r.profiles?.full_name || "").toLowerCase();
      const dept = (r.profiles?.department || "").toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [reports, search]);

  const handleExport = async (report: any) => {
    try {
      setExportingId(report.id);
      setSelectedReport(report);
      
      // Wait for React to render the hidden component and for Recharts to animate/draw
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!pdfContainerRef.current) throw new Error("Template ref not found");
      
      // Select all the rendered pages (PdfPage component renders a direct child div with w-[210mm])
      const pages = pdfContainerRef.current.children[0]?.children;
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
      
      pdf.save(`Weekly-Report-${report.profiles?.full_name?.replace(/\s+/g, '-')}-${report.week_start}.pdf`);
      toast.success("PDF generated successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
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
        title="Weekly Standup Reports"
        subtitle="Comprehensive AI-powered weekly performance reports generated for all employees."
        actions={
          <Button onClick={fetchReports} variant="outline" className="gap-2 border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-400">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="mt-5 grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <GlassCard className="border border-cyan-300/15 bg-card shadow-[0_0_40px_rgba(34,211,238,0.08)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FileBarChart className="text-cyan-400" size={20} />
                Report Directory
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Showing {filtered.length} generated reports</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee or department..."
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
                      No weekly reports found. Reports are generated automatically via scheduled cron tasks.
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
                        {formatNepaliDate(report.week_start, "MMM DD")} - {formatNepaliDate(report.week_end, "MMM DD")}
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
                          variant="secondary"
                          size="sm"
                          disabled={exportingId === report.id}
                          onClick={() => handleExport(report)}
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
        
        <div className="space-y-6">
          <GlassCard className="border border-fuchsia-300/15 bg-card shadow-[0_0_30px_rgba(217,70,239,0.06)] p-5 text-sm">
            <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <FileText size={16} className="text-fuchsia-400" />
              About Weekly Reports
            </h3>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Weekly reports are automatically generated compiling data from the Nepali Wednesday to the following Tuesday.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              They include AI-driven insights on productivity, blocker trends, and attendance signals. Reports are locked once generated.
            </p>
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
