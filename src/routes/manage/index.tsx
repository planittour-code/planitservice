import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RecordSection } from "@/components/house-panels";
import { MaintenanceBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import { shortDate } from "@/lib/housefile/format";
import { getPortfolio } from "@/lib/housefile/server";
import { relevantTaskDate, taskStatus, type MaintenanceStatus } from "@/lib/housefile/maintain";
import type { PortfolioHouse, PortfolioUpcoming } from "@/lib/housefile/types";
import { PortfolioLookup } from "@/components/portfolio-lookup";
import { PortfolioWorkBoard } from "@/components/portfolio-work-board";
import { cn } from "@/lib/utils";

const HOUSE_PREVIEW = 4;

export const Route = createFileRoute("/manage/")({ component: ManageDashboard });

type Filter = "all" | MaintenanceStatus;

function ManageDashboard() {
  const [filter, setFilter] = useState<Filter>("all");
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => getPortfolio() });

  const houses = useMemo(() => {
    const list = portfolio.data?.houses ?? [];
    return list.filter((h) => filter === "all" || h.status === filter);
  }, [portfolio.data?.houses, filter]);

  const upcoming = useMemo(() => {
    const list = portfolio.data?.upcoming ?? [];
    return list.filter((item) => filter === "all" || item.status === filter);
  }, [portfolio.data?.upcoming, filter]);

  const schedule = useMemo(() => {
    const list = portfolio.data?.houses ?? [];
    const byId = new Map(list.map((h) => [h.id, h]));
    const items: PortfolioUpcoming[] = [];
    for (const house of list) {
      for (const t of house.tasks ?? []) {
        if (t.completed_at) continue;
        items.push({
          id: t.id,
          property_id: house.id,
          title: t.title,
          system_name: t.system_name,
          due_on: t.due_on,
          scheduled_on: t.scheduled_on,
          scheduled_note: t.scheduled_note,
          status: taskStatus(t),
          address_line: house.address_line,
          city: house.city,
          state: house.state,
          zip: house.zip,
          homeowner_name: house.homeowner_name,
          kind: "maintenance",
        });
      }
      for (const est of house.acceptedEstimates ?? []) {
        const hold = (est.scheduled_on ?? est.accepted_at ?? "").slice(0, 10);
        items.push({
          id: est.id,
          property_id: house.id,
          title: est.title,
          system_name: est.company_name,
          due_on: hold,
          scheduled_on: est.scheduled_on ? est.scheduled_on.slice(0, 10) : hold,
          scheduled_note: est.scheduled_note,
          status: "scheduled",
          address_line: house.address_line,
          city: house.city,
          state: house.state,
          zip: house.zip,
          homeowner_name: house.homeowner_name,
          kind: "estimate",
          share_token: est.share_token,
        });
      }
    }
    const visible = filter === "all" ? items : items.filter((item) => item.status === filter);
    const needs = visible
      .filter((item) => item.status === "overdue" || item.status === "dueSoon")
      .sort(sortNeedsDate);
    const dated = visible.filter((item) => item.status === "scheduled").sort(sortDated);
    const later = visible.filter((item) => item.status === "current").sort(sortNeedsDate);
    return {
      needs: groupByHouse(needs, byId),
      dated: groupByHouse(dated, byId),
      later: groupByHouse(later, byId),
      needCount: needs.length,
      datedCount: dated.length,
      laterCount: later.length,
    };
  }, [portfolio.data?.houses, filter]);

  if (portfolio.isLoading) return <Skeleton className="h-48 w-full" />;
  if (portfolio.error || !portfolio.data) {
    return <p className="text-destructive">Could not load the office.</p>;
  }

  const cap = portfolio.data.cap;
  const count = portfolio.data.houseCount;
  const name = portfolio.data.name;
  const counts = portfolio.data.counts;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Property manager</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">{name}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {count} of {cap} houses. Calendar and map first, then each property’s house-file photo,
            then the work that still needs a date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {count > 0 ? (
            <Button asChild>
              <Link to="/manage/estimates">Estimates</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/manage/add">Add a Property</Link>
          </Button>
        </div>
      </div>

      {count === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">No houses in this portfolio yet</p>
            <p className="text-sm text-muted-foreground">
              Add an address you manage. Maintenance dates land on the calendar as soon as the
              record exists. Invite a shop and take measurements from Estimates.
            </p>
            <Button asChild>
              <Link to="/manage/add">Add a Property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All", count],
                  ["overdue", "Overdue", counts.overdue],
                  ["dueSoon", "Due soon", counts.dueSoon],
                  ["scheduled", "Scheduled", counts.scheduled],
                  ["current", "Current", counts.current],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-3 text-sm shadow-[var(--shadow-border)]",
                    filter === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground hover:shadow-[var(--shadow-border-hover)]",
                  )}
                >
                  {label}
                  <span className={cn("ml-2 tabular-nums", filter === key ? "opacity-80" : "text-muted-foreground")}>
                    {n}
                  </span>
                </button>
              ))}
            </div>
            <PortfolioLookup
              houses={portfolio.data.houses}
              owners={portfolio.data.owners}
              upcoming={portfolio.data.upcoming}
            />
          </div>

          {houses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No houses match that filter.</p>
          ) : (
            <>
              <RecordSection
                title="Calendar and map"
                blurb="Current, overdue, and scheduled work on the month. Pins are the houses — color matches the date."
                photo={CATEGORY_PHOTO.house}
                countLabel={`${houses.length} houses`}
                defaultOpen
                chips={
                  <ul className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["overdue", "Overdue", counts.overdue],
                        ["dueSoon", "Due soon", counts.dueSoon],
                        ["scheduled", "Scheduled", counts.scheduled],
                        ["current", "Current", counts.current],
                      ] as const
                    )
                      .filter(([, , n]) => n > 0)
                      .map(([key, label, n]) => (
                        <li
                          key={key}
                          className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                        >
                          {label} {n}
                        </li>
                      ))}
                  </ul>
                }
              >
                <PortfolioWorkBoard houses={houses} upcoming={upcoming} />
              </RecordSection>

              <section className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight">Properties</h2>
                    <p className="text-sm text-muted-foreground">
                      Default photo from each house file. Open a tile for the full record.
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {houses.length} {houses.length === 1 ? "house" : "houses"}
                  </p>
                </div>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {houses.map((house) => (
                    <li key={house.id}>
                      <PropertyTile house={house} />
                    </li>
                  ))}
                </ul>
              </section>

              <ScheduleBoard schedule={schedule} filter={filter} />
            </>
          )}
        </>
      )}

      <p className="text-sm text-muted-foreground">
        {count} of {cap} houses on this portfolio.{" "}
        <Link to="/manage/settings" className="underline">
          Office settings and billing
        </Link>
        .
      </p>
    </div>
  );
}

function PropertyTile({ house }: { house: PortfolioHouse }) {
  return (
    <Link
      to="/manage/$id"
      params={{ id: house.id }}
      className="block overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {house.cover_src ? (
          <img
            src={house.cover_src}
            alt=""
            className="size-full object-cover outline outline-1 -outline-offset-1 outline-foreground/10"
          />
        ) : (
          <div className="grid size-full place-items-center font-display text-2xl text-muted-foreground">
            {house.address_line.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-h-11 space-y-0.5 p-2">
        <p className="truncate text-sm font-medium">{house.address_line}</p>
        <p className="truncate text-xs text-muted-foreground">
          {house.homeowner_name || `${house.city}, ${house.state}`}
        </p>
      </div>
    </Link>
  );
}

type HouseBucket = {
  house: PortfolioHouse;
  items: PortfolioUpcoming[];
};

type ScheduleGroups = {
  needs: HouseBucket[];
  dated: HouseBucket[];
  later: HouseBucket[];
  needCount: number;
  datedCount: number;
  laterCount: number;
};

type LaneKey = "needs" | "dated";

function sortNeedsDate(a: PortfolioUpcoming, b: PortfolioUpcoming) {
  if (a.status !== b.status) return a.status === "overdue" ? -1 : 1;
  const byDate = relevantTaskDate(a).slice(0, 10).localeCompare(relevantTaskDate(b).slice(0, 10));
  if (byDate !== 0) return byDate;
  return a.address_line.localeCompare(b.address_line);
}

function sortDated(a: PortfolioUpcoming, b: PortfolioUpcoming) {
  const byDate = relevantTaskDate(a).slice(0, 10).localeCompare(relevantTaskDate(b).slice(0, 10));
  if (byDate !== 0) return byDate;
  return a.address_line.localeCompare(b.address_line);
}

function groupByHouse(items: PortfolioUpcoming[], byId: Map<string, PortfolioHouse>): HouseBucket[] {
  const order: string[] = [];
  const map = new Map<string, PortfolioUpcoming[]>();
  for (const item of items) {
    const list = map.get(item.property_id);
    if (list) list.push(item);
    else {
      map.set(item.property_id, [item]);
      order.push(item.property_id);
    }
  }
  return order
    .map((id) => {
      const house = byId.get(id);
      const grouped = map.get(id) ?? [];
      if (!house || grouped.length === 0) return null;
      return { house, items: grouped };
    })
    .filter((row): row is HouseBucket => row !== null);
}

function ScheduleBoard({ schedule, filter }: { schedule: ScheduleGroups; filter: Filter }) {
  const [lane, setLane] = useState<LaneKey>("needs");
  const [openLater, setOpenLater] = useState(false);
  const showNeeds = filter === "all" || filter === "overdue" || filter === "dueSoon";
  const showDated = filter === "all" || filter === "scheduled";
  const showLater = filter === "all" || filter === "current";
  const twoLanes = showNeeds && showDated;
  const laterOnly = showLater && !showNeeds && !showDated;
  const empty =
    (showNeeds ? schedule.needCount : 0) +
      (showDated ? schedule.datedCount : 0) +
      (showLater ? schedule.laterCount : 0) ===
    0;

  return (
    <section id="maintenance" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Maintenance schedule</h2>
          <p className="text-sm text-muted-foreground">
            Overdue and unscheduled first, grouped by house. Owner is on each card.
          </p>
        </div>
        <p className="text-xs font-semibold tabular-nums text-muted-foreground">
          {schedule.needCount} need a date
        </p>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">Nothing on the schedule for this filter.</p>
      ) : (
        <>
          {twoLanes ? (
            <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 md:hidden">
              {(
                [
                  ["needs", "Needs a date", schedule.needCount],
                  ["dated", "On the calendar", schedule.datedCount],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLane(key)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center rounded-full px-3 text-sm",
                    lane === key ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-muted-foreground",
                  )}
                >
                  {label}
                  <span className="ml-1.5 tabular-nums">{n}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className={cn("grid gap-4", twoLanes && "md:grid-cols-2")}>
            {showNeeds ? (
              <ScheduleLane
                title="Needs a date"
                blurb="Overdue first, then due soon that is not booked."
                count={schedule.needCount}
                buckets={schedule.needs}
                empty="Nothing overdue or due soon."
                hideTitleOnMobile={twoLanes}
                className={twoLanes && lane !== "needs" ? "hidden md:block" : undefined}
              />
            ) : null}
            {showDated ? (
              <ScheduleLane
                title="On the calendar"
                blurb="Booked and agreed work, soonest first."
                count={schedule.datedCount}
                buckets={schedule.dated}
                empty="Nothing booked yet."
                hideTitleOnMobile={twoLanes}
                className={twoLanes && lane !== "dated" ? "hidden md:block" : undefined}
              />
            ) : null}
          </div>

          {showLater && schedule.laterCount > 0 ? (
            <div className="rounded-lg bg-card shadow-[var(--shadow-border)]">
              {laterOnly ? (
                <div className="px-4 py-3">
                  <p className="text-sm font-medium">Later this year</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{schedule.laterCount} current</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenLater((v) => !v)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium">Later this year</span>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {schedule.laterCount} current
                  </span>
                </button>
              )}
              {laterOnly || openLater ? (
                <div className="space-y-3 border-t border-border p-3">
                  {schedule.later.map((bucket) => (
                    <HouseWorkCard key={bucket.house.id} bucket={bucket} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function ScheduleLane({
  title,
  blurb,
  count,
  buckets,
  empty,
  hideTitleOnMobile,
  className,
}: {
  title: string;
  blurb: string;
  count: number;
  buckets: HouseBucket[];
  empty: string;
  hideTitleOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className={hideTitleOnMobile ? "hidden md:block" : undefined}>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-bold tracking-tight">{title}</h3>
          <p className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</p>
        </div>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      {buckets.length === 0 ? (
        <p className="rounded-lg bg-card px-4 py-6 text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          {empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {buckets.map((bucket) => (
            <li key={bucket.house.id}>
              <HouseWorkCard bucket={bucket} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HouseWorkCard({ bucket }: { bucket: HouseBucket }) {
  const { house, items } = bucket;
  const extra = items.length - HOUSE_PREVIEW;
  const overdue = items.filter((item) => item.status === "overdue").length;
  return (
    <article className="overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
      <Link
        to="/manage/$id"
        params={{ id: house.id }}
        className="flex min-h-11 items-center gap-3 px-3 py-2.5"
      >
        <div className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
          {house.cover_src ? (
            <img
              src={house.cover_src}
              alt=""
              className="size-full object-cover outline outline-1 -outline-offset-1 outline-foreground/10"
            />
          ) : (
            <div className="grid size-full place-items-center font-display text-sm text-muted-foreground">
              {house.address_line.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{house.address_line}</p>
          <p className="truncate text-xs text-muted-foreground">
            {house.homeowner_name || `${house.city}, ${house.state}`}
            {overdue ? ` · ${overdue} overdue` : ""}
          </p>
        </div>
      </Link>
      <ul className="divide-y divide-border border-t border-border">
        {items.slice(0, HOUSE_PREVIEW).map((item) => (
          <li key={`${item.kind ?? "maintenance"}:${item.id}`}>
            <ScheduleLine item={item} />
          </li>
        ))}
      </ul>
      {extra > 0 ? (
        <Link
          to="/manage/$id"
          params={{ id: house.id }}
          className="block min-h-11 px-3 py-2 text-xs font-semibold text-muted-foreground"
        >
          {extra} more on this house
        </Link>
      ) : null}
    </article>
  );
}

function ScheduleLine({ item }: { item: PortfolioUpcoming }) {
  const when =
    item.kind === "estimate"
      ? `agreed ${shortDate(item.scheduled_on ?? item.due_on)}`
      : item.scheduled_on
        ? `scheduled ${shortDate(item.scheduled_on)}`
        : `due ${shortDate(item.due_on)}`;
  return (
    <Link
      to="/manage/$id"
      params={{ id: item.property_id }}
      className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.homeowner_name ? `${item.homeowner_name} · ` : ""}
          {when}
          {item.kind === "estimate" && item.system_name ? ` · ${item.system_name}` : ""}
        </p>
      </div>
      <MaintenanceBadge status={item.status} />
    </Link>
  );
}
