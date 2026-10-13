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
    visible.sort((a, b) => {
      const byDate = relevantTaskDate(b).slice(0, 10).localeCompare(relevantTaskDate(a).slice(0, 10));
      if (byDate !== 0) return byDate;
      return a.address_line.localeCompare(b.address_line);
    });
    return visible;
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
            then one maintenance schedule with the owner on every line.
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

              <section id="maintenance" className="scroll-mt-20 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold tracking-tight">Maintenance schedule</h2>
                    <p className="text-sm text-muted-foreground">
                      Latest date first. Owner is tagged on every line.
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {schedule.length} {schedule.length === 1 ? "item" : "items"}
                  </p>
                </div>
                {schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing on the schedule for this filter.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md bg-card shadow-[var(--shadow-border)]">
                    {schedule.map((item) => (
                      <li key={`${item.kind ?? "maintenance"}:${item.id}`}>
                        <ScheduleLine item={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
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
      className="flex min-h-14 flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{item.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {item.homeowner_name ? (
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
              {item.homeowner_name}
            </span>
          ) : null}
          <span>
            {item.address_line} · {when}
            {item.kind === "estimate" && item.system_name ? ` · ${item.system_name}` : ""}
          </span>
        </p>
      </div>
      <MaintenanceBadge status={item.status} />
    </Link>
  );
}
