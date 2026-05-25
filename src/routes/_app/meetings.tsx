import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { GlassCard } from "@/components/GlassCard";
import { CalendarClock, Loader2 } from "lucide-react";
import { format } from "date-fns";

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

  return (
    <>
      <PageHeader title="Meetings" subtitle="Upcoming meetings and notices" />
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : meetings.length === 0 ? (
        <GlassCard className="text-center py-16 text-muted-foreground">
          No upcoming meetings.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {meetings.map((meeting) => (
            <GlassCard key={meeting.id} className="flex items-start gap-4">
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
          ))}
        </div>
      )}
    </>
  );
}
