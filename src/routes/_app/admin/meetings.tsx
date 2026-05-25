import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/meetings")({ component: AdminMeetingsPage });

function AdminMeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    agenda: "",
    meeting_time: "",
    location: "",
    meeting_link: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_time", { ascending: false });
    setMeetings(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) return toast.error("Meeting title required");
    if (!form.meeting_time) return toast.error("Meeting time required");

    setSaving(true);
    const { error } = await supabase.from("meetings").insert({
      title: form.title.trim(),
      agenda: form.agenda.trim() || null,
      meeting_time: new Date(form.meeting_time).toISOString(),
      location: form.location.trim() || null,
      meeting_link: form.meeting_link.trim() || null,
      created_by: user.id,
    });

    if (!error) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("approval_status", "approved")
        .eq("is_suspended", false);

      const meetingWhen = format(new Date(form.meeting_time), "MMM d, yyyy HH:mm");
      await supabase.from("notifications").insert(
        (profiles ?? []).map((profile) => ({
          user_id: profile.user_id,
          title: "New meeting scheduled",
          message: `${form.title.trim()} on ${meetingWhen}${form.location ? ` at ${form.location.trim()}` : ""}.`,
          type: "meeting",
        })),
      );
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting created and employees notified");
    setForm({ title: "", agenda: "", meeting_time: "", location: "", meeting_link: "" });
    load();
  };

  return (
    <>
      <PageHeader title="Meetings" subtitle="Schedule meetings and notify employees" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard>
          <form onSubmit={createMeeting} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} />
            </div>
            <div>
              <Label>Meeting time</Label>
              <Input
                type="datetime-local"
                value={form.meeting_time}
                onChange={(e) => update("meeting_time", e.target.value)}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Office meeting room"
              />
            </div>
            <div>
              <Label>Meeting link</Label>
              <Input
                value={form.meeting_link}
                onChange={(e) => update("meeting_link", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Agenda</Label>
              <Textarea
                value={form.agenda}
                onChange={(e) => update("agenda", e.target.value)}
                rows={4}
              />
            </div>
            <Button disabled={saving} className="neon-button w-full rounded-xl">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create meeting
            </Button>
          </form>
        </GlassCard>

        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : meetings.length === 0 ? (
            <GlassCard className="text-center py-16 text-muted-foreground">
              No meetings scheduled.
            </GlassCard>
          ) : (
            meetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)
          )}
        </div>
      </div>
    </>
  );
}

function MeetingCard({ meeting }: { meeting: any }) {
  return (
    <GlassCard className="flex items-start gap-4">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "var(--gradient-brand-soft)" }}
      >
        <CalendarClock size={16} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{meeting.title}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {format(new Date(meeting.meeting_time), "MMM d, yyyy HH:mm")}
          {meeting.location ? ` · ${meeting.location}` : ""}
        </div>
        {meeting.agenda && <div className="text-sm mt-3">{meeting.agenda}</div>}
        {meeting.meeting_link && (
          <a
            href={meeting.meeting_link}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline mt-3 inline-block"
          >
            Open meeting link
          </a>
        )}
      </div>
    </GlassCard>
  );
}
