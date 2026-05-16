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
  const { profile, user, refresh } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);
  if (!form) return null;

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", form.id);
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    setForm({ ...form, avatar_url: publicUrl });
    toast.success("Profile photo updated");
    refresh();
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        department: form.department,
        position: form.position,
        address: form.address,
        blood_group: form.blood_group,
        emergency_contact: form.emergency_contact,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refresh();
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle="Manage your personal information" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 max-w-5xl">
        <GlassCard className="lg:col-span-1 text-center">
          <div className="relative h-28 w-28 mx-auto group">
            {form.avatar_url ? (
              <img
                src={form.avatar_url}
                alt="Avatar"
                className="h-28 w-28 rounded-full object-cover ring-2 ring-primary/40"
              />
            ) : (
              <div
                className="h-28 w-28 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-neon-red)" }}
              >
                {form.full_name
                  ?.split(" ")
                  .map((s: string) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <label
              className="absolute bottom-0 right-0 h-9 w-9 rounded-full flex items-center justify-center cursor-pointer ring-2 ring-background hover:scale-105 transition"
              style={{ background: "var(--gradient-brand)" }}
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={uploadAvatar}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="mt-4 font-semibold text-lg">{form.full_name}</div>
          <div className="text-sm text-muted-foreground">{form.email}</div>
          <div
            className="mt-3 inline-block px-3 py-1 rounded-full text-xs"
            style={{ background: "var(--gradient-brand-soft)", color: "var(--primary)" }}
          >
            {form.department || "Unassigned"}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <h3 className="font-semibold mb-4">Personal information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={form.full_name || ""}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={form.department || ""}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <div>
              <Label>Position</Label>
              <Input
                value={form.position || ""}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Blood group</Label>
              <Input
                value={form.blood_group || ""}
                onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
              />
            </div>
            <div>
              <Label>Emergency contact</Label>
              <Input
                value={form.emergency_contact || ""}
                onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-5">
            <Button onClick={save} disabled={saving} className="neon-button rounded-xl">
              <Save size={14} className="mr-2" />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
