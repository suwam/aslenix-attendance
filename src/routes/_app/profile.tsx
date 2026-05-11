import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile, refresh } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (profile) setForm(profile); }, [profile]);
  if (!form) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, phone: form.phone, department: form.department,
      position: form.position, address: form.address, blood_group: form.blood_group,
      emergency_contact: form.emergency_contact,
    }).eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); refresh();
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Manage your personal information" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
        <GlassCard className="lg:col-span-1 text-center">
          {form.avatar_url ? <img src={form.avatar_url} className="h-28 w-28 mx-auto rounded-full object-cover ring-2 ring-primary/40" /> :
            <div className="h-28 w-28 mx-auto rounded-full flex items-center justify-center text-3xl font-bold text-white" style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }}>
              {form.full_name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase()}
            </div>}
          <div className="mt-4 font-semibold text-lg">{form.full_name}</div>
          <div className="text-sm text-muted-foreground">{form.email}</div>
          <div className="mt-3 inline-block px-3 py-1 rounded-full text-xs" style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}>{form.department || "Unassigned"}</div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Personal information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Full name</Label><Input value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Department</Label><Input value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div><Label>Position</Label><Input value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Blood group</Label><Input value={form.blood_group || ""} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} /></div>
            <div><Label>Emergency contact</Label><Input value={form.emergency_contact || ""} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
          </div>
          <div className="mt-5">
            <Button onClick={save} disabled={saving} className="neon-button rounded-xl"><Save size={14} className="mr-2" />{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
