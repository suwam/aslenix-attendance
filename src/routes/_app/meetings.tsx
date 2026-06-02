import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  NotebookText,
  Sparkles,
  Video,
} from "lucide-react";
import { differenceInMinutes, format, isToday } from "date-fns";

export const Route = createFileRoute("/_app/meetings")({ component: MeetingsPage });

function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("meetings")
      .select("*")
      .gte("meeting_time", new Date().toISOString())
      .order("meeting_time", { ascending: true })
      .then(({ data }) => {
        setMeetings(data ?? []);
        setLoading(false);
      });
  }, []);

  const nextMeeting = meetings[0];
  const todayMeetings = meetings.filter((meeting) => isToday(new Date(meeting.meeting_time))).length;

  return (
    <>
      <PageHeader title="Meetings" subtitle="Upcoming meetings, links, and agenda notes" />
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MeetingMetric label="Upcoming" value={meetings.length} icon={CalendarClock} />
            <MeetingMetric label="Today" value={todayMeetings} icon={Clock} />
            <MeetingMetric
              label="Next"
              value={nextMeeting ? format(new Date(nextMeeting.meeting_time), "MMM d") : "None"}
              icon={Video}
            />
          </div>

          {meetings.length === 0 ? (
            <MeetingEmptyState />
          ) : nextMeeting && (
            <GlassCard className="overflow-hidden border-primary/20 bg-white/[0.03]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-3 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <CalendarClock size={12} />
                    Next meeting
                  </div>
                  <h2 className="text-2xl font-bold text-white">{nextMeeting.title}</h2>
                  <MeetingMeta meeting={nextMeeting} />
                  {nextMeeting.agenda && (
                    <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {nextMeeting.agenda}
                    </p>
                  )}
                </div>
                {nextMeeting.meeting_link && (
                  <Button asChild className="neon-button h-11 shrink-0 rounded-xl">
                    <a href={nextMeeting.meeting_link} target="_blank" rel="noreferrer">
                      <ExternalLink size={15} className="mr-2" />
                      Join meeting
                    </a>
                  </Button>
                )}
              </div>
            </GlassCard>
          )}

          {meetings.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {meetings.map((meeting) => (
                <EmployeeMeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function MeetingEmptyState() {
  return (
    <GlassCard className="overflow-hidden border-white/10 bg-white/[0.025]">
      <div className="relative grid min-h-[260px] gap-6 p-2 md:grid-cols-[1fr_320px] md:items-center">
        <div className="min-w-0">
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles size={12} />
            Schedule clear
          </div>
          <h2 className="text-3xl font-bold text-white">No upcoming meetings right now</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            When admin schedules or postpones a meeting, it will appear here with the updated date, link, location, and agenda.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <EmptyHint icon={CalendarClock} label="Next sync" value="Waiting" />
            <EmptyHint icon={Video} label="Meeting link" value="Not posted" />
            <EmptyHint icon={NotebookText} label="Agenda" value="Clear" />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Today</div>
              <div className="mt-1 text-xl font-bold text-white">{format(new Date(), "MMM d")}</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <CalendarDays size={20} />
            </div>
          </div>
          <div className="space-y-3">
            {["Focus work", "Task updates", "Standup notes"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyHint({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <Icon size={16} className="mb-3 text-primary" />
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-white">{value}</div>
    </div>
  );
}

function EmployeeMeetingCard({ meeting }: { meeting: any }) {
  return (
    <GlassCard className="group flex flex-col gap-4 border-white/10 bg-white/[0.025] transition hover:border-primary/25 hover:bg-white/[0.04] sm:flex-row sm:items-start">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <CalendarClock size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-white">{meeting.title}</h2>
            <MeetingMeta meeting={meeting} />
          </div>
          <MeetingCountdown time={meeting.meeting_time} />
        </div>
        {meeting.agenda && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <NotebookText size={13} />
              Agenda
            </div>
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
      </div>
    </GlassCard>
  );
}

function MeetingMetric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof CalendarClock }) {
  return (
    <GlassCard className="border-white/10 bg-white/[0.025]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-white">{value}</div>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon size={19} />
        </div>
      </div>
    </GlassCard>
  );
}

function MeetingMeta({ meeting }: { meeting: any }) {
  return (
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
  );
}

function MeetingCountdown({ time }: { time: string }) {
  const minutes = differenceInMinutes(new Date(time), new Date());
  const label =
    minutes <= 0
      ? "Starting now"
      : minutes < 60
        ? `${minutes}m left`
        : minutes < 1440
          ? `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
          : `${Math.floor(minutes / 1440)}d left`;

  return (
    <span className="w-fit shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
      {label}
    </span>
  );
}
