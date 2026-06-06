import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Download,
  Printer,
  RefreshCw,
  Ban,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { EmployeeQRCard, QRProfile } from "@/components/EmployeeQRCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/qr-ids")({ component: QRIdsPage });

const DEPARTMENTS = ["All", "Development", "UI/UX", "AI/ML", "HR", "Marketing", "Management"];
const STATUSES = ["All", "active", "inactive", "revoked"];

function QRIdsPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<QRProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<QRProfile | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "user_id,full_name,email,department,position,employee_code,qr_token,qr_status,approval_status,avatar_url,is_suspended",
        )
        .order("full_name"),
      supabase.from("user_roles").select("user_id, role").in("role", ["admin", "super_admin", "hr_manager"]),
    ]);
    const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
    setUsers((data ?? []).filter((user) => !adminUserIds.has(user.user_id)) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (!isAdmin) return <Navigate to="/dashboard" />;

  const filtered = users.filter(
    (u) =>
      (dept === "All" || u.department === dept) &&
      (status === "All" || u.qr_status === status) &&
      (!search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.employee_code?.toLowerCase().includes(search.toLowerCase())),
  );

  const regenerate = async (u: QRProfile) => {
    const token = crypto.getRandomValues(new Uint8Array(24));
    const hex = Array.from(token)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await supabase
      .from("profiles")
      .update({ qr_token: hex, qr_generated_at: new Date().toISOString(), qr_status: "active" })
      .eq("user_id", u.user_id);
    if (error) return toast.error(error.message);
    toast.success("QR regenerated");
    load();
    setSelected(null);
  };

  const setQrStatus = async (u: QRProfile, newStatus: "active" | "inactive" | "revoked") => {
    const { error } = await supabase
      .from("profiles")
      .update({ qr_status: newStatus })
      .eq("user_id", u.user_id);
    if (error) return toast.error(error.message);
    toast.success(`QR ${newStatus}`);
    load();
    setSelected((s) => (s ? { ...s, qr_status: newStatus } : s));
  };

  const downloadPNG = () => {
    if (!cardRef.current) return;
    const canvas = cardRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${selected?.employee_code || "employee"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadPDF = async () => {
    if (!selected || !cardRef.current) return;
    const canvas = cardRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: [90, 130] });
    pdf.setFillColor(15, 20, 35);
    pdf.rect(0, 0, 90, 130, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(14);
    pdf.text("ASLENIX", 45, 12, { align: "center" });
    pdf.setFontSize(8);
    pdf.setTextColor(180, 180, 200);
    pdf.text("DIGITAL EMPLOYEE ID", 45, 17, { align: "center" });
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.text(selected.full_name, 45, 28, { align: "center" });
    pdf.setFontSize(9);
    pdf.setTextColor(200, 200, 220);
    pdf.text(selected.position || "—", 45, 34, { align: "center" });
    pdf.text(selected.department || "—", 45, 39, { align: "center" });
    const dataUrl = canvas.toDataURL("image/png");
    pdf.addImage(dataUrl, "PNG", 20, 45, 50, 50);
    pdf.setFontSize(10);
    pdf.text(`ID: ${selected.employee_code || "—"}`, 45, 105, { align: "center" });
    pdf.setFontSize(8);
    pdf.text(selected.email, 45, 112, { align: "center" });
    pdf.setTextColor(150, 150, 170);
    pdf.setFontSize(7);
    pdf.text(`Status: ${selected.qr_status.toUpperCase()}`, 45, 120, { align: "center" });
    pdf.save(`${selected.employee_code || "employee"}-id.pdf`);
  };

  const printCard = () => {
    if (!cardRef.current) return;
    const canvas = cardRef.current.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !selected) return;
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Print ${selected.employee_code}</title>
      <style>body{font-family:system-ui;background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
      .card{background:linear-gradient(140deg,#1a1f3a,#0a0e1f);padding:24px;border-radius:16px;width:340px;border:1px solid #ff2a5a55;}
      h1{font-size:18px;margin:0 0 4px;text-align:center;color:#ff2a5a;}
      .sub{font-size:10px;text-align:center;color:#aab;letter-spacing:2px;margin-bottom:16px;}
      .name{font-size:16px;text-align:center;font-weight:bold;}
      .pos{font-size:11px;color:#aab;text-align:center;margin-bottom:12px;}
      .qr{background:#fff;padding:8px;border-radius:8px;display:flex;justify-content:center;}
      .id{font-family:monospace;text-align:center;margin-top:12px;font-size:13px;}
      .email{text-align:center;font-size:10px;color:#aab;}</style></head>
      <body><div class="card"><h1>ASLENIX</h1><div class="sub">DIGITAL EMPLOYEE ID</div>
      <div class="name">${selected.full_name}</div>
      <div class="pos">${selected.position || "—"} • ${selected.department || "—"}</div>
      <div class="qr"><img src="${dataUrl}" width="220" height="220"/></div>
      <div class="id">${selected.employee_code || ""}</div>
      <div class="email">${selected.email}</div></div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script></body></html>
    `);
    w.document.close();
  };

  return (
    <>
      <PageHeader
        title="Digital QR IDs"
        subtitle={`${filtered.length} employee ${filtered.length === 1 ? "card" : "cards"}`}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, ID…"
            className="pl-9"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          <QrCode className="mx-auto mb-3 opacity-50" /> No QR cards found.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((u) => (
            <button
              key={u.user_id}
              onClick={() => setSelected(u)}
              className="text-left transition-transform hover:scale-[1.015]"
            >
              <EmployeeQRCard profile={u} size={110} />
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Employee QR ID</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="flex flex-col items-center gap-5">
              <EmployeeQRCard ref={cardRef} profile={selected} size={180} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                <Button onClick={downloadPNG} variant="secondary" size="sm">
                  <Download size={14} className="mr-1" /> PNG
                </Button>
                <Button onClick={downloadPDF} variant="secondary" size="sm">
                  <Download size={14} className="mr-1" /> PDF
                </Button>
                <Button onClick={printCard} variant="secondary" size="sm">
                  <Printer size={14} className="mr-1" /> Print
                </Button>
                <Button onClick={() => regenerate(selected)} variant="secondary" size="sm">
                  <RefreshCw size={14} className="mr-1" /> Regen
                </Button>
              </div>
              <div className="flex gap-2 w-full">
                {selected.qr_status !== "active" ? (
                  <Button
                    onClick={() => setQrStatus(selected, "active")}
                    className="flex-1"
                    size="sm"
                  >
                    <CheckCircle2 size={14} className="mr-1" /> Activate
                  </Button>
                ) : (
                  <Button
                    onClick={() => setQrStatus(selected, "inactive")}
                    variant="outline"
                    className="flex-1"
                    size="sm"
                  >
                    Deactivate
                  </Button>
                )}
                <Button
                  onClick={() => setQrStatus(selected, "revoked")}
                  variant="destructive"
                  className="flex-1"
                  size="sm"
                >
                  <Ban size={14} className="mr-1" /> Revoke
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
