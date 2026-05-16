import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Calendar, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/_app/standup")({ component: StandupPage });

function StandupPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [yesterday, setYesterday] = useState("");
  const [today, setToday] = useState("");
  const [blockers, setBlockers] = useState("");
  const [hours, setHours] = useState<number>(0);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("standups")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();
    setYesterday(data?.yesterday || "");
    setToday(data?.today || "");
    setBlockers(data?.blockers || "");
    setHours(Number(data?.work_hours || 0));
    const { data: hist } = await supabase
      .from("standups")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(7);
    setHistory(hist || []);
  };
  useEffect(() => {
    load();
  }, [user, date]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("standups").upsert(
      {
        user_id: user.id,
        date,
        yesterday,
        today,
        blockers,
        work_hours: hours,
      },
      { onConflict: "user_id,date" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Standup saved");
    load();
  };

  return (
    <>
      <PageHeader
        title="Daily Standup"
        subtitle="Share what you did, what you'll do, and what's blocking you"
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Standups (7d)" value={history.length} icon={Calendar} accent="blue" />
        <StatCard
          label="Avg hours"
          value={`${(history.reduce((a, h) => a + Number(h.work_hours || 0), 0) / Math.max(1, history.length)).toFixed(1)}h`}
          icon={Clock}
          accent="green"
        />
        <StatCard
          label="With blockers"
          value={history.filter((h) => h.blockers && h.blockers.trim()).length}
          icon={AlertTriangle}
          accent="amber"
        />
        <StatCard
          label="Today logged"
          value={today || yesterday ? "Yes" : "No"}
          icon={CheckCircle2}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 space-y-4">
          <div>
            <Label>Yesterday I worked on</Label>
            <Textarea
              rows={4}
              value={yesterday}
              onChange={(e) => setYesterday(e.target.value)}
              placeholder="Wrapped up auth flow, fixed UI bugs…"
            />
          </div>
          <div>
            <Label>Today I plan to</Label>
            <Textarea
              rows={4}
              value={today}
              onChange={(e) => setToday(e.target.value)}
              placeholder="Build dashboard widgets, review PRs…"
            />
          </div>
          <div>
            <Label>Blockers</Label>
            <Textarea
              rows={3}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Waiting on design specs…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Work hours</Label>
              <Input
                type="number"
                min={0}
                max={24}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={save} disabled={busy} className="neon-button w-full rounded-xl">
                <Save size={14} className="mr-1.5" />
                Save standup
              </Button>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="font-semibold mb-3">Recent standups</h3>
          <ul className="space-y-3 max-h-[420px] overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-sm border-l-2 border-primary/40 pl-3">
                <div className="text-xs text-muted-foreground">
                  {format(new Date(h.date), "EEE, MMM d")}
                </div>
                <div className="line-clamp-2 mt-1">
                  {h.today || h.yesterday || (
                    <span className="text-muted-foreground">No notes</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {Number(h.work_hours || 0).toFixed(1)}h logged
                </div>
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-sm text-muted-foreground">No standups yet</li>
            )}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
