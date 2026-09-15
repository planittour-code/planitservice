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
import type { MaintenanceStatus } from "@/lib/housefile/maintain";
import type { PortfolioHouse, PortfolioOwner } from "@/lib/housefile/types";
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

  const owners = useMemo(() => {
    const list = portfolio.data?.owners ?? [];
    const ids = new Set(houses.map((h) => h.id));
    return list
      .map((owner) => ({
        ...owner,
        houses: owner.houses.filter((h) => ids.has(h.id)),
      }))
      .filter((owner) => owner.houses.length > 0);
  }, [portfolio.data?.owners, houses]);

  const upcoming = useMemo(() => {
    const list = portfolio.data?.upcoming ?? [];
    return list.filter((item) => filter === "all" || item.status === filter);
  }, [portfolio.data?.upcoming, filter]);

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
            {count} of {cap} houses. Work is grouped by owner so you can see what is current, due
            soon, overdue, or already scheduled — including estimates the owner has accepted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {count > 0 ? (
            <Button asChild>
              <Link to="/manage/estimates">Estimates</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/manage/add">Add a house</Link>
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
              <Link to="/manage/add">Add a house</Link>
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
            <RecordSection
              title="By owner"
              blurb="Open a house to log work or set a scheduled date once the owner has agreed."
              photo={CATEGORY_PHOTO.systems}
              countLabel={`${owners.length} ${owners.length === 1 ? "owner" : "owners"}`}
              chips={
                owners.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {owners.slice(0, 8).map((owner) => (
                      <li
                        key={owner.key}
                        className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                      >
                        {owner.name}
                        {owner.overdueCount ? ` · ${owner.overdueCount} overdue` : ""}
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
            >
              <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
                {owners.map((owner) => (
                  <OwnerBlock key={owner.key} owner={owner} />
                ))}
              </ul>
            </RecordSection>
            </>
          )}

          <RecordSection
            title="Upcoming"
            blurb="Overdue work first, then the next 60 days. Accepted estimates stay here until the shop logs the job complete."
            photo={CATEGORY_PHOTO.paint}
            countLabel={`${upcoming.length} in this window`}
            chips={
              upcoming.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {upcoming.slice(0, 6).map((item) => (
                    <li
                      key={item.id}
                      className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                    >
                      {item.title}
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          >
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in this window.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
                {upcoming.slice(0, 24).map((item) => (
                  <li key={item.id}>
                    <Link
                      to="/manage/$id"
                      params={{ id: item.property_id }}
                      className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.homeowner_name} · {item.address_line}
                          {item.kind === "estimate"
                            ? ` · agreed ${shortDate(item.scheduled_on ?? item.due_on)}`
                            : item.scheduled_on
                              ? ` · scheduled ${shortDate(item.scheduled_on)}`
                              : ` · due ${shortDate(item.due_on)}`}
                          {item.kind === "estimate" && item.system_name ? ` · ${item.system_name}` : ""}
                        </p>
                      </div>
                      <MaintenanceBadge status={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </RecordSection>
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

function OwnerBlock({ owner }: { owner: PortfolioOwner }) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{owner.name}</p>
          <p className="text-sm text-muted-foreground">
            {owner.houses.length} {owner.houses.length === 1 ? "property" : "properties"}
            {owner.email ? ` · ${owner.email}` : ""}
          </p>
        </div>
        <OwnerCounts houses={owner.houses} />
      </div>
      <ul className="mt-3 space-y-1">
        {owner.houses.map((house) => (
          <HouseRow key={house.id} house={house} />
        ))}
      </ul>
    </li>
  );
}

function OwnerCounts({ houses }: { houses: PortfolioHouse[] }) {
  const overdue = houses.reduce((n, h) => n + h.overdueCount, 0);
  const dueSoon = houses.reduce((n, h) => n + h.dueSoonCount, 0);
  const scheduled = houses.reduce((n, h) => n + h.scheduledCount, 0);
  const bits = [
    overdue ? `${overdue} overdue` : null,
    dueSoon ? `${dueSoon} due soon` : null,
    scheduled ? `${scheduled} scheduled` : null,
  ].filter(Boolean);
  if (bits.length === 0) {
    return <span className="text-sm text-muted-foreground">Current</span>;
  }
  return <span className="text-sm text-muted-foreground">{bits.join(" · ")}</span>;
}

function HouseRow({ house }: { house: PortfolioHouse }) {
  const next = house.nextTask;
  return (
    <li>
      <Link
        to="/manage/$id"
        params={{ id: house.id }}
        className="flex min-h-11 flex-col gap-1 rounded-md px-2 py-2 hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-medium">{house.address_line}</p>
          <p className="text-sm text-muted-foreground">
            {house.city}, {house.state} {house.zip}
            {next
              ? next.kind === "estimate"
                ? ` · ${next.title} agreed ${shortDate(next.scheduled_on ?? next.due_on)}`
                : next.scheduled_on
                  ? ` · ${next.title} scheduled ${shortDate(next.scheduled_on)}`
                  : ` · ${next.title} due ${shortDate(next.due_on)}`
              : " · no open maintenance"}
            {(house.acceptedEstimates?.length ?? 0)
              ? ` · ${house.acceptedEstimates.length} agreed ${house.acceptedEstimates.length === 1 ? "estimate" : "estimates"}`
              : ""}
            {house.job_count ? ` · ${house.job_count} ${house.job_count === 1 ? "job" : "jobs"}` : ""}
            {house.open_proposal_count
              ? ` · ${house.open_proposal_count} ${house.open_proposal_count === 1 ? "open estimate" : "open estimates"}`
              : ""}
          </p>
        </div>
        <MaintenanceBadge status={house.status} />
      </Link>
    </li>
  );
}
