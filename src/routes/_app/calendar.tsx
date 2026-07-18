import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Edit3,
  Landmark,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { BSDateInput } from "@/components/BSDateInput";
import { NepaliCalendar } from "@/components/NepaliCalendar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/calendar")({ component: CalendarPage });

const EVENT_KEY = "aslenix-nepali-calendar-events";

const DEFAULT_EVENTS: CalendarEvent[] = [
  { id: "event-bakra-eid-2083", bsDate: "2083-02-14", title: "Bakra Eid / Eid al-Adha" },
  { id: "event-republic-day-2083", bsDate: "2083-02-15", title: "Ganatantra Diwas" },
  { id: "event-no-tobacco-2083", bsDate: "2083-02-17", title: "World No Tobacco Day" },
  { id: "event-children-2083", bsDate: "2083-02-19", title: "International Children's Day" },
  { id: "event-victims-2083", bsDate: "2083-02-21", title: "Children Victims of Aggression Day" },
  { id: "event-environment-2083", bsDate: "2083-02-22", title: "World Environment Day" },
];

function CalendarPage() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>(EVENT_KEY, DEFAULT_EVENTS);
  const [form, setForm] = useState({ bsDate: "2083-02-14", title: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedEvents = [...events].sort((a, b) => a.bsDate.localeCompare(b.bsDate));
  const nextEvent = sortedEvents[0];

  const saveEvent = () => {
    const title = form.title.trim();
    if (!title || !isValidBsDate(form.bsDate)) return;

    if (editingId) {
      setEvents((items) =>
        items.map((item) =>
          item.id === editingId ? { ...item, bsDate: form.bsDate, title } : item,
        ),
      );
    } else {
      setEvents((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          bsDate: form.bsDate,
          title,
        },
      ]);
    }

    setForm({ bsDate: form.bsDate, title: "" });
    setEditingId(null);
  };

  const editEvent = (event: CalendarEvent) => {
    setForm({ bsDate: event.bsDate, title: event.title });
    setEditingId(event.id);
  };

  const deleteEvent = (id: string) => {
    setEvents((items) => items.filter((item) => item.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm((current) => ({ ...current, title: "" }));
    }
  };

  return (
    <>
      <PageHeader
        title="ASLENIX Calendar"
        subtitle="Nepali calendar, holidays, weekly offs, and public event tracking"
      />

      <div className="mb-4 grid w-full max-w-7xl grid-cols-1 gap-3 sm:grid-cols-3">
        <CalendarMetric
          icon={CalendarDays}
          label="Tracked Events"
          value={sortedEvents.length}
          detail={nextEvent ? `${nextEvent.bsDate} BS next` : "No event dates"}
          tone="blue"
        />
        <CalendarMetric
          icon={Landmark}
          label="Calendar Scope"
          value="2083 BS"
          detail="Baisakh to Chaitra"
          tone="red"
        />
        <CalendarMetric
          icon={ShieldCheck}
          label="Access"
          value={isAdmin ? "Admin" : "Employee"}
          detail={isAdmin ? "Holiday controls enabled" : "View-only calendar"}
          tone="green"
        />
      </div>

      <div className="grid w-full max-w-7xl grid-cols-1 gap-4 overflow-hidden sm:gap-5 xl:grid-cols-[minmax(560px,1fr)_minmax(360px,440px)]">
        <NepaliCalendar isAdmin={isAdmin} />

        <GlassCard className="min-w-0 overflow-hidden self-start p-4 sm:p-5" glow="red">
          <div className="relative z-10">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <CalendarDays size={14} />
                  Upcoming Days
                </div>
                <h2 className="text-xl font-bold leading-tight">Government calendar events</h2>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Events only. These do not mark holidays on the calendar.
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-pink-500 text-foreground shadow-[0_0_28px_rgba(125,92,255,.35)]">
                <Sparkles size={14} />
              </div>
            </div>

            {sortedEvents.length > 0 ? (
              <div className="grid max-h-none min-w-0 gap-3 overflow-y-visible pr-0 sm:grid-cols-2 xl:max-h-[58vh] xl:grid-cols-1 xl:overflow-y-auto xl:pr-1">
                {sortedEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className="group min-w-0 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-[0_18px_52px_-34px_var(--primary)] sm:p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary shadow-[0_0_18px_-12px_var(--primary)]">
                        <span className="text-[10px] font-bold uppercase leading-none">BS</span>
                        <span className="mt-0.5 text-sm font-black leading-none tabular-nums">
                          {event.bsDate.slice(-2)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {event.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{event.bsDate} BS</span>
                          {index === 0 && (
                            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              Next
                            </span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => editEvent(event)}
                            aria-label={`Edit ${event.title}`}
                          >
                            <Edit3 size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-destructive"
                            onClick={() => deleteEvent(event.id)}
                            aria-label={`Delete ${event.title}`}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No events added yet.
              </div>
            )}

            {isAdmin && (
              <div className="mt-4 space-y-3 rounded-xl border border-accent/15 bg-accent/5 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Plus size={13} className="text-accent" />
                  Admin event controls
                </div>
                <div className="grid gap-2">
                  <div>
                    <Label className="text-[11px]">BS date</Label>
                    <BSDateInput
                      value={form.bsDate}
                      onChange={(value) => setForm((current) => ({ ...current, bsDate: value }))}
                      placeholder="2083-02-14"
                      inputClassName="h-9 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Event name</Label>
                    <Input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Government event name"
                      className="h-9 rounded-xl"
                    />
                  </div>
                  <Button type="button" className="neon-button h-9 rounded-xl" onClick={saveEvent}>
                    <Save size={13} className="mr-2" />
                    {editingId ? "Update event" : "Add event"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function CalendarMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  detail: string;
  tone: "red" | "blue" | "green";
}) {
  const tones = {
    red: "text-primary bg-primary/10 border-primary/20",
    blue: "text-accent bg-accent/10 border-accent/20",
    green: "text-success bg-success/10 border-success/20",
  };

  return (
    <GlassCard className="min-w-0 p-3">
      <div className="flex min-h-16 items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}
        >
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 truncate text-lg font-black leading-none">{value}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
        </div>
      </div>
    </GlassCard>
  );
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function isValidBsDate(value: string) {
  return /^2083-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-2])$/.test(value);
}

type CalendarEvent = {
  id: string;
  bsDate: string;
  title: string;
};
