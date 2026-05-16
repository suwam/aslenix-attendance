import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setS(data));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({
        company_name: s.company_name,
        office_start_time: s.office_start_time,
        office_end_time: s.office_end_time,
        late_after_time: s.late_after_time,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
  };

  if (!s)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <>
      <PageHeader title="Settings" subtitle="Company configuration and attendance rules" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
        <GlassCard>
          <h3 className="font-semibold mb-4">Company</h3>
          <div className="space-y-4">
            <div>
              <Label>Company name</Label>
              <Input
                value={s.company_name}
                onChange={(e) => setS({ ...s, company_name: e.target.value })}
              />
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <h3 className="font-semibold mb-4">Working hours</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Office start</Label>
              <Input
                type="time"
                value={s.office_start_time?.slice(0, 5)}
                onChange={(e) => setS({ ...s, office_start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Office end</Label>
              <Input
                type="time"
                value={s.office_end_time?.slice(0, 5)}
                onChange={(e) => setS({ ...s, office_end_time: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Late after</Label>
              <Input
                type="time"
                value={s.late_after_time?.slice(0, 5)}
                onChange={(e) => setS({ ...s, late_after_time: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Check-ins after this time are flagged as late.
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
      <div className="mt-6">
        <Button onClick={save} disabled={saving} className="neon-button rounded-xl">
          <Save size={14} className="mr-2" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </>
  );
}
