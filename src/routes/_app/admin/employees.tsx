import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Search, Mail, Phone, Briefcase, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/admin/employees")({ component: EmployeesPage });

const DEPARTMENTS = ["All", "Development", "UI/UX", "AI/ML", "HR", "Marketing", "Management"];

function EmployeesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("All");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("approval_status", "approved")
        .order("full_name");
      setUsers(data ?? []);
      setLoading(false);
    })();
  }, []);

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
            {DEPARTMENTS.map((d) => (
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
              className="hover:scale-[1.02] transition-transform cursor-default"
            >
              <div className="flex flex-col items-center text-center">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/40"
                  />
                ) : (
                  <div
                    className="h-20 w-20 rounded-full flex items-center justify-center text-white text-xl font-bold"
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
                <div className="mt-3 font-semibold">{u.full_name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Briefcase size={11} />
                  {u.position || "—"}
                </div>
                <div
                  className="text-xs px-2.5 py-1 rounded-full mt-2"
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
            </GlassCard>
          ))}
        </div>
      )}
    </>
  );
}
