import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shortDate } from "@/lib/housefile/format";
import { addDaysIso, sundayOfWeek } from "@/lib/housefile/maintain";
import { scheduleSoldEstimate } from "@/lib/housefile/server";
import type { ShopScheduleItem } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export function ShopScheduleBoard({ items }: { items: ShopScheduleItem[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, ShopScheduleItem[]>();
    for (const item of items) {
      const day = item.scheduled_on.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [items]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selected = pickedDay ? (byDay.get(pickedDay) ?? []) : [];
  const upcoming = useMemo(
    () => [...items].sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on)),
    [items],
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-medium">Sold week calendar</h2>
        <p className="text-sm text-muted-foreground">
          Accepted work lands on Sunday of the week it sold. Move the date if weather or the crew
          needs the following week.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          Sold estimates appear here on Sunday of that week.
        </p>
      ) : (
        <>
          <CalendarPane
            cursor={cursor}
            onPrev={() => setCursor((d) => startOfMonth(addMonths(d, -1)))}
            onNext={() => setCursor((d) => startOfMonth(addMonths(d, 1)))}
            onToday={() => {
              const now = startOfMonth(new Date());
              setCursor(now);
              setPickedDay(format(new Date(), "yyyy-MM-dd"));
            }}
            days={monthDays}
            byDay={byDay}
            pickedDay={pickedDay}
            onPickDay={(iso) => setPickedDay((cur) => (cur === iso ? null : iso))}
          />
          <DayJobs
            heading={
              pickedDay
                ? format(new Date(`${pickedDay}T12:00:00`), "EEEE, MMMM d")
                : "Sold jobs"
            }
            items={pickedDay ? selected : upcoming}
            empty={pickedDay ? "Nothing on this Sunday yet." : "No sold jobs on the calendar."}
          />
        </>
      )}
    </section>
  );
}

function CalendarPane({
  cursor,
  onPrev,
  onNext,
  onToday,
  days,
  byDay,
  pickedDay,
  onPickDay,
}: {
  cursor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  days: Date[];
  byDay: Map<string, ShopScheduleItem[]>;
  pickedDay: string | null;
  onPickDay: (iso: string) => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <div className="flex flex-col rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <p className="font-display text-lg font-medium tracking-tight">{format(cursor, "MMMM yyyy")}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-9" onClick={onPrev} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="size-9" onClick={onNext} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border">
        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const count = byDay.get(iso)?.length ?? 0;
          const inMonth = isSameMonth(day, cursor);
          const on = pickedDay === iso;
          const sunday = day.getDay() === 0;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(iso)}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 bg-card px-0.5 py-1.5 text-sm sm:min-h-16",
                !inMonth && "bg-muted/40 text-muted-foreground",
                sunday && inMonth && "bg-muted/20",
                on && "bg-secondary text-secondary-foreground",
                iso === today && !on && "font-semibold text-secondary",
              )}
            >
              <span className={cn("tabular-nums", iso === today && !on && "underline underline-offset-4")}>
                {format(day, "d")}
              </span>
              {count > 0 ? (
                <span className={cn("size-1.5 rounded-full", on ? "bg-secondary-foreground" : "bg-primary")} />
              ) : (
                <span className="h-1.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayJobs({
  heading,
  items,
  empty,
}: {
  heading: string;
  items: ShopScheduleItem[];
  empty: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="font-medium">{heading}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <Link
                to="/app/proposals/$id"
                params={{ id: item.id }}
                className="flex min-h-7 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.homeowner_name} · {item.address_line}
                    {item.city ? `, ${item.city}` : ""}
                    {` · sold ${shortDate(item.accepted_at)}`}
                  </p>
                </div>
                <StatusBadge status="accepted" />
              </Link>
              <SoldDateMover item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SoldDateMover({
  item,
  onSaved,
}: {
  item: Pick<ShopScheduleItem, "id" | "scheduled_on" | "scheduled_note">;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(item.scheduled_on);
  const [note, setNote] = useState(item.scheduled_note ?? "");
  useEffect(() => {
    setDate(item.scheduled_on);
    setNote(item.scheduled_note ?? "");
  }, [item.scheduled_on, item.scheduled_note]);
  const save = useMutation({
    mutationFn: (next: { scheduledOn: string; scheduledNote?: string }) =>
      scheduleSoldEstimate({
        data: { proposalId: item.id, scheduledOn: next.scheduledOn, scheduledNote: next.scheduledNote },
      }),
    onSuccess: (_result, next) => {
      setDate(next.scheduledOn);
      toast.success(`Hold moved to ${shortDate(next.scheduledOn)}`);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["proposal", item.id] });
      onSaved?.();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not move the date"),
  });

  function commit(nextDate: string, nextNote = note) {
    if (!nextDate) return;
    save.mutate({ scheduledOn: nextDate, scheduledNote: nextNote });
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        commit(date, note);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={`hold-${item.id}`}>Service hold</Label>
        <Input
          id={`hold-${item.id}`}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full sm:w-44"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={`hold-note-${item.id}`}>Note</Label>
        <Input
          id={`hold-note-${item.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Weather, crew, or next week"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={save.isPending || !date}>
          {save.isPending ? "Saving…" : "Update date"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={save.isPending}
          onClick={() => {
            const next = sundayOfWeek(addDaysIso(date || item.scheduled_on, 7));
            setDate(next);
            commit(next, note || "Moved to the following week");
          }}
        >
          Next Sunday
        </Button>
      </div>
    </form>
  );
}
