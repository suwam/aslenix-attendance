import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BellDot,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Inbox,
  Link as LinkIcon,
  Loader2,
  MapPin,
  NotebookText,
  Plus,
  Send,
  Users,
  Video,
} from "lucide-react";
import { addDays, format, isFuture, isPast, isToday } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/meetings")({ component: AdminMeetingsPage });

type MeetingForm = {
  title: string;
  agenda: string;
  meeting_time: string;
  location: string;
  meeting_link: string;
};

const emptyMeetingForm: MeetingForm = {
  title: "",
  agenda: "",
  meeting_time: "",
  location: "",
  meeting_link: "",
};

function AdminMeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<MeetingForm>(emptyMeetingForm);
  const [updating, setUpdating] = useState(false);
  const [form, setForm] = useState<MeetingForm>(emptyMeetingForm);

  const load = async () => {
    setLoading(true);
    const [{ data }, { count }] = await Promise.all([
      supabase.from("meetings").select("*").order("meeting_time", { ascending: false }),
      supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("approval_status", "approved")
        .eq("is_suspended", false),
    ]);
    setMeetings(data ?? []);
    setEmployeeCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateEdit = (key: keyof MeetingForm, value: string) =>
    setEditForm((current) => ({ ...current, [key]: value }));

  const notifyEmployees = async (title: string, message: string) => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("approval_status", "approved")
      .eq("is_suspended", false);
    const { data: existingNotifications } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("type", "meeting")
      .eq("title", title)
      .eq("message", message);
    const notifiedUserIds = new Set((existingNotifications ?? []).map((row) => row.user_id));
    const notifications = (profiles ?? [])
      .filter((profile) => !notifiedUserIds.has(profile.user_id))
      .map((profile) => ({
        user_id: profile.user_id,
        title,
        message,
        type: "meeting",
      }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  };

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) return toast.error("Meeting title required");
    if (!form.meeting_time) return toast.error("Meeting time required");

    setSaving(true);
    const title = form.title.trim();
    const agenda = form.agenda.trim();
    const location = form.location.trim();
    const meetingLink = form.meeting_link.trim();
    const meetingTime = new Date(form.meeting_time);
    const { data: meeting, error } = await supabase.from("meetings").insert({
      title,
      agenda: agenda || null,
      meeting_time: meetingTime.toISOString(),
      location: location || null,
      meeting_link: meetingLink || null,
      created_by: user.id,
    }).select("*").maybeSingle();

    if (!error && meeting) {
      const meetingWhen = format(meetingTime, "MMM d, yyyy HH:mm");
      const notificationTitle = "New meeting scheduled";
      const notificationMessage = `${title} on ${meetingWhen}${location ? ` at ${location}` : ""}.`;
      await notifyEmployees(notificationTitle, notificationMessage);
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Meeting created and employees notified");
    setForm(emptyMeetingForm);
    load();
  };

  const openEditMeeting = (meeting: any) => {
    setEditingMeeting(meeting);
    setEditForm({
      title: meeting.title || "",
      agenda: meeting.agenda || "",
      meeting_time: toLocalDateTimeInput(meeting.meeting_time),
      location: meeting.location || "",
      meeting_link: meeting.meeting_link || "",
    });
  };

  const saveMeetingChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    if (!editForm.title.trim()) return toast.error("Meeting title required");
    if (!editForm.meeting_time) return toast.error("Meeting time required");

    setUpdating(true);
    const meetingTime = new Date(editForm.meeting_time);
    const payload = {
      title: editForm.title.trim(),
      agenda: editForm.agenda.trim() || null,
      meeting_time: meetingTime.toISOString(),
      location: editForm.location.trim() || null,
      meeting_link: editForm.meeting_link.trim() || null,
    };
    const oldTime = new Date(editingMeeting.meeting_time).getTime();
    const newTime = meetingTime.getTime();
    const { data, error } = await supabase
      .from("meetings")
      .update(payload)
      .eq("id", editingMeeting.id)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      const status = newTime > oldTime ? "Meeting postponed" : "Meeting updated";
      const message = `${payload.title} is now on ${format(meetingTime, "MMM d, yyyy HH:mm")}${
        payload.location ? ` at ${payload.location}` : ""
      }.`;
      await notifyEmployees(status, message);
    }

    setUpdating(false);
    if (error) return toast.error(error.message);
    toast.success(newTime > oldTime ? "Meeting postponed and employees notified" : "Meeting updated and employees notified");
    setEditingMeeting(null);
    load();
  };

  const postponeMeeting = async (meeting: any, days: number) => {
    const nextTime = addDays(new Date(meeting.meeting_time), days);
    const { error } = await supabase
      .from("meetings")
      .update({ meeting_time: nextTime.toISOString() })
      .eq("id", meeting.id);

    if (error) return toast.error(error.message);
    await notifyEmployees(
      "Meeting postponed",
      `${meeting.title} is now on ${format(nextTime, "MMM d, yyyy HH:mm")}${meeting.location ? ` at ${meeting.location}` : ""}.`,
    );
    toast.success(`Postponed ${days === 1 ? "to tomorrow" : `by ${days} days`}`);
    load();
  };

  const upcomingMeetings = meetings.filter((meeting) => isFuture(new Date(meeting.meeting_time)));
  const todayMeetings = meetings.filter((meeting) => isToday(new Date(meeting.meeting_time))).length;
  const completedMeetings = meetings.filter((meeting) => isPast(new Date(meeting.meeting_time))).length;

  return (
    <>
      <PageHeader
        title="Meetings"
        subtitle="Schedule meetings and notify employees once"
        actions={
          <div className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {employeeCount} employees
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <MeetingMetric label="Upcoming" value={upcomingMeetings.length} icon={CalendarClock} tone="red" />
        <MeetingMetric label="Today" value={todayMeetings} icon={Clock} tone="blue" />
        <MeetingMetric label="Past" value={completedMeetings} icon={CheckCircle2} tone="green" />
        <MeetingMetric label="Notify" value={employeeCount} icon={BellDot} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <GlassCard className="border-white/10 bg-white/[0.025]">
          <form onSubmit={createMeeting} className="space-y-4">
            <div className="mb-2">
              <h2 className="text-lg font-semibold text-white">Schedule meeting</h2>
              <p className="text-sm text-muted-foreground">Employees receive one notification for each schedule.</p>
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Video size={14} className="text-primary" />
                Title
              </Label>
              <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Weekly planning sync" />
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarClock size={14} className="text-primary" />
                Meeting time
              </Label>
              <Input
                type="datetime-local"
                value={form.meeting_time}
                onChange={(e) => update("meeting_time", e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <MapPin size={14} className="text-primary" />
                Location
              </Label>
              <Input
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Office meeting room"
              />
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <LinkIcon size={14} className="text-primary" />
                Meeting link
              </Label>
              <Input
                value={form.meeting_link}
                onChange={(e) => update("meeting_link", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <NotebookText size={14} className="text-primary" />
                Agenda
              </Label>
              <Textarea
                value={form.agenda}
                onChange={(e) => update("agenda", e.target.value)}
                rows={4}
              />
            </div>
            <Button disabled={saving} className="neon-button h-11 w-full rounded-xl">
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Plus size={16} className="mr-2" />}
              Create meeting
            </Button>
          </form>
        </GlassCard>

        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Meeting timeline</h2>
              <p className="text-sm text-muted-foreground">Newest scheduled meetings first</p>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : meetings.length === 0 ? (
            <GlassCard className="border-white/10 bg-white/[0.025] py-16 text-center text-muted-foreground">
              <Inbox size={28} className="mx-auto mb-3 text-primary" />
              No meetings scheduled.
            </GlassCard>
          ) : (
            meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onEdit={() => openEditMeeting(meeting)}
                onPostpone={(days) => postponeMeeting(meeting, days)}
              />
            ))
          )}
        </div>
      </div>

      <Dialog open={Boolean(editingMeeting)} onOpenChange={(open) => !open && setEditingMeeting(null)}>
        <DialogContent className="glass max-w-2xl border-border">
          <DialogHeader>
            <DialogTitle>Edit meeting schedule</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveMeetingChanges} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Video size={14} className="text-primary" />
                  Title
                </Label>
                <Input value={editForm.title} onChange={(e) => updateEdit("title", e.target.value)} />
              </div>
              <div>
                <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <CalendarClock size={14} className="text-primary" />
                  Meeting time
                </Label>
                <Input
                  type="datetime-local"
                  value={editForm.meeting_time}
                  onChange={(e) => updateEdit("meeting_time", e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <MapPin size={14} className="text-primary" />
                  Location
                </Label>
                <Input value={editForm.location} onChange={(e) => updateEdit("location", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <LinkIcon size={14} className="text-primary" />
                  Meeting link
                </Label>
                <Input value={editForm.meeting_link} onChange={(e) => updateEdit("meeting_link", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <NotebookText size={14} className="text-primary" />
                  Agenda
                </Label>
                <Textarea value={editForm.agenda} onChange={(e) => updateEdit("agenda", e.target.value)} rows={4} />
              </div>
            </div>
            <Button disabled={updating} className="neon-button h-11 w-full rounded-xl">
              {updating ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
              Save changes and notify employees
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MeetingCard({
  meeting,
  onEdit,
  onPostpone,
}: {
  meeting: any;
  onEdit: () => void;
  onPostpone: (days: number) => void;
}) {
  const past = isPast(new Date(meeting.meeting_time));
  return (
    <GlassCard className={`flex flex-col gap-4 border-white/10 bg-white/[0.025] sm:flex-row sm:items-start ${past ? "opacity-75" : ""}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <CalendarClock size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-white">{meeting.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {format(new Date(meeting.meeting_time), "MMM d, yyyy HH:mm")}
              </span>
              {meeting.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {meeting.location}
                </span>
              )}
            </div>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${past ? "border-white/10 bg-white/[0.04] text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}>
            {past ? "Past" : "Upcoming"}
          </span>
        </div>
        {meeting.agenda && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-muted-foreground">
            {meeting.agenda}
          </div>
        )}
        {meeting.meeting_link && (
          <Button asChild variant="outline" className="mt-4 h-10 rounded-xl">
            <a href={meeting.meeting_link} target="_blank" rel="noreferrer">
              <ExternalLink size={14} className="mr-2" />
              Open meeting link
            </a>
          </Button>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onEdit}>
            <Edit3 size={14} className="mr-2" />
            Edit date
          </Button>
          {!past && (
            <>
              <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => onPostpone(1)}>
                <CalendarClock size={14} className="mr-2" />
                Tomorrow
              </Button>
              <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => onPostpone(7)}>
                <CalendarClock size={14} className="mr-2" />
                +7 days
              </Button>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function MeetingMetric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof CalendarClock;
  tone: "red" | "blue" | "green" | "amber";
}) {
  const colors = {
    red: "border-primary/20 bg-primary/10 text-primary",
    blue: "border-blue-400/20 bg-blue-500/10 text-blue-300",
    green: "border-success/20 bg-success/10 text-success",
    amber: "border-warning/20 bg-warning/10 text-warning",
  };

  return (
    <GlassCard className="border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${colors[tone]}`}>
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
