import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Mail, Phone, Briefcase, Loader2, Pencil, Check, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  DEPARTMENTS as DEPARTMENTS_LIST,
  DEPARTMENT_POSITIONS,
  ADMIN_DEPARTMENT_FILTERS,
} from "@/lib/departments";

export const Route = createFileRoute("/_app/admin/employees")({ component: EmployeesPage });

const FILTER_DEPARTMENTS = ADMIN_DEPARTMENT_FILTERS;

function EmployeesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");

  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editDept, setEditDept] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [isCustomDept, setIsCustomDept] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("approval_status", "approved").order("full_name"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "super_admin", "hr_manager"]),
      ]);
      const adminUserIds = new Set((roleRows ?? []).map((row) => row.user_id));
      setUsers((data ?? []).filter((user) => !adminUserIds.has(user.user_id)));
      setLoading(false);
    })();
  }, []);

  const openEditModal = (u: any) => {
    setEditingUser(u);
    const d = u.department || "";
    setEditDept(d);
    setEditPosition(u.position || "");

    const isKnownDept = DEPARTMENTS_LIST.includes(d as any);
    setIsCustomDept(!isKnownDept && Boolean(d));

    const positions = DEPARTMENT_POSITIONS[d] || [];
    if (u.position && positions.length > 0 && !positions.includes(u.position)) {
      setIsCustomPosition(true);
    } else {
      setIsCustomPosition(false);
    }
  };

  const handleDeptChange = (newDept: string) => {
    if (newDept === "other") {
      setIsCustomDept(true);
      setIsCustomPosition(true);
      setEditDept("");
      setEditPosition("");
      return;
    }
    setIsCustomDept(false);
    setIsCustomPosition(false);
    setEditDept(newDept);
    const positions = DEPARTMENT_POSITIONS[newDept] || [];
    if (!positions.includes(editPosition)) {
      setEditPosition(positions[0] || "");
    }
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        department: editDept,
        position: editPosition,
      })
      .eq("id", editingUser.id);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Employee department and position updated");
    setUsers((prev) =>
      prev.map((item) =>
        item.id === editingUser.id
          ? { ...item, department: editDept, position: editPosition }
          : item,
      ),
    );
    setEditingUser(null);
  };

  const editAvailablePositions = editDept ? DEPARTMENT_POSITIONS[editDept] || [] : [];

  const filtered = users.filter(
    (u) =>
      (dept === "All" || u.department === dept) &&
      (!search ||
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle={`${filtered.length} active ${filtered.length === 1 ? "employee" : "employees"}`}
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
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
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
          No employees found.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((u) => (
            <GlassCard
              key={u.id}
              className="flex flex-col justify-between hover:scale-[1.01] transition-transform"
            >
              <div>
                <div className="flex flex-col items-center text-center">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/40"
                    />
                  ) : (
                    <div
                      className="h-20 w-20 rounded-full flex items-center justify-center text-foreground text-xl font-bold"
                      style={{
                        background: "var(--gradient-brand)",
                        boxShadow: "var(--shadow-neon-red)",
                      }}
                    >
                      {u.full_name
                        ?.split(" ")
                        .map((s: string) => s[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="mt-3 font-semibold text-foreground">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Briefcase size={12} className="text-primary" />
                    <span>{u.position || "—"}</span>
                  </div>
                  <div
                    className="text-xs px-2.5 py-1 rounded-full mt-2 font-medium"
                    style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}
                  >
                    {u.department || "Unassigned"}
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail size={12} />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} />
                      {u.phone}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[11px] font-mono text-muted-foreground">
                  {u.employee_code || "No code"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg text-xs gap-1.5 hover:border-primary/40 hover:text-primary transition"
                  onClick={() => openEditModal(u)}
                >
                  <Pencil size={12} />
                  Edit Role
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Edit Employee Department & Position Modal */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Sparkles size={18} className="text-primary" />
              Edit Employee Department & Position
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Update workplace assignment for <span className="font-semibold text-foreground">{editingUser?.full_name}</span>.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase size={14} className="text-primary" />
                  Department
                </Label>
                {isCustomDept && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDept(false);
                      handleDeptChange(DEPARTMENTS_LIST[0]);
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Choose from list
                  </button>
                )}
              </div>

              {!isCustomDept ? (
                <Select
                  value={
                    DEPARTMENTS_LIST.includes(editDept as any)
                      ? editDept
                      : editDept
                        ? "custom"
                        : ""
                  }
                  onValueChange={(val) => {
                    if (val === "other") {
                      setIsCustomDept(true);
                      setIsCustomPosition(true);
                      setEditDept("");
                      setEditPosition("");
                    } else if (val !== "custom") {
                      handleDeptChange(val);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS_LIST.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                    {editDept && !DEPARTMENTS_LIST.includes(editDept as any) && (
                      <SelectItem value="custom">
                        {editDept} (Current)
                      </SelectItem>
                    )}
                    <SelectItem value="other">Other (Type custom department...)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    placeholder="e.g. Operations, Quality Assurance"
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <span>Standard:</span>
                    {DEPARTMENTS_LIST.slice(0, 4).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleDeptChange(d)}
                        className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary cursor-pointer transition"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Briefcase size={14} className="text-primary" />
                  Position
                </Label>
                {editAvailablePositions.length > 0 && isCustomPosition && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomPosition(false);
                      setEditPosition(editAvailablePositions[0] || "");
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Choose from list
                  </button>
                )}
              </div>

              {editAvailablePositions.length > 0 && !isCustomPosition ? (
                <Select
                  value={
                    editAvailablePositions.includes(editPosition)
                      ? editPosition
                      : editPosition
                        ? "other"
                        : ""
                  }
                  onValueChange={(val) => {
                    if (val === "other") {
                      setIsCustomPosition(true);
                    } else {
                      setEditPosition(val);
                    }
                  }}
                >
                  <SelectTrigger className="rounded-xl border-border bg-card">
                    <SelectValue
                      placeholder={
                        editDept === "Frontend"
                          ? "Select position (e.g. UI/UX Designer)"
                          : "Select position"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {editAvailablePositions.map((pos) => (
                      <SelectItem key={pos} value={pos}>
                        {pos}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (Type custom position...)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    placeholder={
                      editDept === "Frontend"
                        ? "e.g. UI/UX Designer, Frontend Developer"
                        : editDept === "Backend"
                          ? "e.g. Backend Developer, API Engineer"
                          : "e.g. Software Engineer, Specialist"
                    }
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                  />
                  {editAvailablePositions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                      <span>Common for {editDept}:</span>
                      {editAvailablePositions.slice(0, 4).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setEditPosition(p);
                            setIsCustomPosition(false);
                          }}
                          className="rounded-full bg-secondary/80 px-2 py-0.5 text-xs font-medium text-secondary-foreground hover:bg-secondary cursor-pointer transition"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setEditingUser(null)}
              disabled={savingEdit}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={savingEdit}
              className="neon-button rounded-xl"
            >
              {savingEdit ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} className="mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
