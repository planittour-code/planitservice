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
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MaintenanceBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { shortDate } from "@/lib/housefile/format";
import { fitMapView, pointOnMap, tileUrl, visibleTiles, type GeoPoint } from "@/lib/housefile/geo-map";
import { formatLine, geocodeLine } from "@/lib/housefile/geocode";
import { relevantTaskDate, type MaintenanceStatus } from "@/lib/housefile/maintain";
import { standardizeAddress } from "@/lib/housefile/server";
import type { PortfolioHouse, PortfolioUpcoming } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<MaintenanceStatus, string> = {
  overdue: "bg-destructive",
  dueSoon: "bg-primary",
  scheduled: "bg-secondary",
  current: "bg-muted-foreground/50",
};

const PIN_FILL: Record<MaintenanceStatus, string> = {
  overdue: "text-destructive",
  dueSoon: "text-primary",
  scheduled: "text-secondary",
  current: "text-muted-foreground",
};

function houseLine(h: { address_line: string; city: string; state: string; zip: string }) {
  return formatLine(h.address_line, h.city, h.state, h.zip);
}

const GEO_CACHE = "planit.geo.";

function readGeoCache(line: string): GeoPoint | null {
  try {
    const raw = sessionStorage.getItem(GEO_CACHE + line);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoPoint;
    if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeGeoCache(line: string, point: GeoPoint) {
  try {
    sessionStorage.setItem(GEO_CACHE + line, JSON.stringify(point));
  } catch {
    /* ignore */
  }
}

async function locateOne(line: string): Promise<GeoPoint | null> {
  const cached = readGeoCache(line);
  if (cached) return cached;
  const take = (hit: { lat?: number; lng?: number } | null) => {
    if (hit?.lat == null || hit.lng == null) return null;
    const point = { lat: hit.lat, lng: hit.lng };
    writeGeoCache(line, point);
    return point;
  };
  try {
    const direct = take(await geocodeLine(line));
    if (direct) return direct;
  } catch {
    /* Census/Photon from the browser may be blocked; use the server. */
  }
  try {
    return take(await standardizeAddress({ data: line }));
  } catch {
    return null;
  }
}

async function locateLines(lines: string[]): Promise<Record<string, GeoPoint>> {
  const out: Record<string, GeoPoint> = {};
  const pending = lines.filter((line) => {
    const cached = readGeoCache(line);
    if (cached) {
      out[line] = cached;
      return false;
    }
    return true;
  });
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const line = pending[cursor++]!;
      const point = await locateOne(line);
      if (point) out[line] = point;
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => worker()));
  return out;
}

function eventDate(item: PortfolioUpcoming) {
  return relevantTaskDate(item).slice(0, 10);
}

export function PortfolioWorkBoard({
  houses,
  upcoming,
}: {
  houses: PortfolioHouse[];
  upcoming: PortfolioUpcoming[];
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [pickedHouse, setPickedHouse] = useState<string | null>(null);
  const [coords, setCoords] = useState<Record<string, GeoPoint>>({});

  const lines = useMemo(
    () => [...new Set(houses.map(houseLine).filter((s) => s.replace(/[,—\s]/g, "").length > 4))],
    [houses],
  );

  useEffect(() => {
    if (!lines.length) return;
    let cancelled = false;
    void locateLines(lines).then((res) => {
      if (!cancelled) setCoords(res);
    });
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const calendarItems = useMemo(() => {
    const seen = new Set(upcoming.map((item) => item.id));
    const extra: PortfolioUpcoming[] = [];
    for (const house of houses) {
      const next = house.nextTask;
      if (!next || seen.has(next.id)) continue;
      extra.push({
        id: next.id,
        property_id: house.id,
        title: next.title,
        system_name: "",
        due_on: next.due_on,
        scheduled_on: next.scheduled_on,
        scheduled_note: null,
        status: next.status,
        address_line: house.address_line,
        city: house.city,
        state: house.state,
        zip: house.zip,
        homeowner_name: house.homeowner_name,
        kind: next.kind ?? "maintenance",
        share_token: null,
      });
    }
    return [...upcoming, ...extra];
  }, [upcoming, houses]);

  const byDay = useMemo(() => {
    const map = new Map<string, PortfolioUpcoming[]>();
    for (const item of calendarItems) {
      const day = eventDate(item);
      const list = map.get(day) ?? [];
      list.push(item);
      map.set(day, list);
    }
    return map;
  }, [calendarItems]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedItems = pickedDay ? (byDay.get(pickedDay) ?? []) : [];
  const selectedHouse = houses.find((h) => h.id === pickedHouse) ?? null;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-stretch">
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
          onPickDay={(iso) => {
            setPickedDay((cur) => (cur === iso ? null : iso));
            setPickedHouse(null);
          }}
        />
        <MapPane
          houses={houses}
          coords={coords}
          pickedHouse={pickedHouse}
          onPickHouse={(id) => {
            setPickedHouse((cur) => (cur === id ? null : id));
            const house = houses.find((h) => h.id === id);
            const next = house?.nextTask;
            if (next) setPickedDay(relevantTaskDate(next).slice(0, 10));
          }}
        />
      </div>
      <StatusKey />
      {selectedHouse ? (
        <DayList
          heading={selectedHouse.address_line}
          items={calendarItems.filter((item) => item.property_id === selectedHouse.id)}
          empty="No open dates on this house in the upcoming window."
        />
      ) : pickedDay ? (
        <DayList
          heading={format(new Date(`${pickedDay}T12:00:00`), "EEEE, MMMM d")}
          items={selectedItems}
          empty="Nothing on this date."
        />
      ) : null}
    </div>
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
  byDay: Map<string, PortfolioUpcoming[]>;
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
          const items = byDay.get(iso) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const statuses = [...new Set(items.map((i) => i.status))];
          const on = pickedDay === iso;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(iso)}
              className={cn(
                "flex min-h-14 flex-col items-center gap-1 bg-card px-0.5 py-1.5 text-sm sm:min-h-16",
                !inMonth && "bg-muted/40 text-muted-foreground",
                on && "bg-secondary text-secondary-foreground",
                iso === today && !on && "font-semibold text-secondary",
              )}
            >
              <span className={cn("tabular-nums", iso === today && !on && "underline underline-offset-4")}>
                {format(day, "d")}
              </span>
              {items.length > 0 ? (
                <span className="flex items-center justify-center gap-0.5">
                  {statuses.slice(0, 3).map((status) => (
                    <span
                      key={status}
                      className={cn(
                        "size-1.5 rounded-full",
                        on ? "bg-secondary-foreground" : STATUS_DOT[status],
                      )}
                    />
                  ))}
                </span>
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

function MapPane({
  houses,
  coords,
  pickedHouse,
  onPickHouse,
}: {
  houses: PortfolioHouse[];
  coords: Record<string, GeoPoint>;
  pickedHouse: string | null;
  onPickHouse: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 420 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(240, Math.round(r.width)), h: Math.max(280, Math.round(r.height)) });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pins = useMemo(() => {
    const placed: { house: PortfolioHouse; point: GeoPoint }[] = [];
    const used = new Map<string, number>();
    for (const house of houses) {
      const point = coords[houseLine(house)];
      if (!point) continue;
      const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
      const n = used.get(key) ?? 0;
      used.set(key, n + 1);
      const jitter = n * 0.00018;
      placed.push({
        house,
        point: { lat: point.lat + jitter, lng: point.lng + jitter * 0.7 },
      });
    }
    return placed;
  }, [houses, coords]);

  const view = useMemo(
    () => fitMapView(pins.map((p) => p.point), size.w, size.h),
    [pins, size.w, size.h],
  );
  const tiles = useMemo(
    () => visibleTiles(view.center, view.zoom, size.w, size.h),
    [view, size.w, size.h],
  );
  const missing = houses.length - pins.length;

  return (
    <div className="flex min-h-80 flex-col overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="flex items-baseline justify-between gap-2 px-4 py-3">
        <p className="font-display text-lg font-medium tracking-tight">Houses</p>
        <p className="text-xs text-muted-foreground">
          {pins.length} pinned
          {missing > 0 ? ` · ${missing} locating` : ""}
        </p>
      </div>
      <div ref={wrap} className="relative min-h-72 flex-1 bg-muted sm:min-h-96">
        <div className="absolute inset-0 overflow-hidden">
          {tiles.map((t) => (
            <img
              key={`${t.z}-${t.x}-${t.y}`}
              src={tileUrl(t.z, t.x, t.y)}
              alt=""
              className="pointer-events-none absolute max-w-none outline-none"
              style={{ left: t.left, top: t.top, width: 256, height: 256 }}
              draggable={false}
            />
          ))}
          {pins.map(({ house, point }) => {
            const pos = pointOnMap(point, view.center, view.zoom, size.w, size.h);
            const on = pickedHouse === house.id;
            return (
              <button
                key={house.id}
                type="button"
                onClick={() => onPickHouse(house.id)}
                className="absolute -translate-x-1/2 -translate-y-full"
                style={{ left: pos.left, top: pos.top }}
                aria-label={house.address_line}
              >
                <MapPin
                  className={cn(
                    "size-7 drop-shadow-sm transition-transform duration-150",
                    PIN_FILL[house.status],
                    on && "scale-125",
                  )}
                  fill="currentColor"
                  stroke="white"
                  strokeWidth={1.4}
                />
              </button>
            );
          })}
        </div>
        {houses.length > 0 && pins.length === 0 ? (
          <p className="absolute inset-x-4 bottom-4 rounded-md bg-card/95 px-3 py-2 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
            Locating addresses on the map…
          </p>
        ) : null}
        <p className="absolute right-2 bottom-2 text-[10px] text-muted-foreground/80">
          © OpenStreetMap © CARTO
        </p>
      </div>
    </div>
  );
}

function StatusKey() {
  const items: { status: MaintenanceStatus; label: string }[] = [
    { status: "overdue", label: "Overdue" },
    { status: "dueSoon", label: "Due soon" },
    { status: "scheduled", label: "Scheduled" },
    { status: "current", label: "Current" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.status} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", STATUS_DOT[item.status])} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function DayList({
  heading,
  items,
  empty,
}: {
  heading: string;
  items: PortfolioUpcoming[];
  empty: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="font-medium">{heading}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to="/manage/$id"
                params={{ id: item.property_id }}
                className="flex min-h-12 flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.address_line}
                    {item.scheduled_on
                      ? ` · scheduled ${shortDate(item.scheduled_on)}`
                      : ` · due ${shortDate(item.due_on)}`}
                  </p>
                </div>
                <MaintenanceBadge status={item.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
