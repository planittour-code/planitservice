import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { HouseCard } from "@/components/site-chrome";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/housefile/format";
import { listShopIndex } from "@/lib/housefile/server";
import type { PropertyListRow, ShopClientRow, ShopWorkRow } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

const queryString = z.preprocess(
  (v) => (v == null || v === "" ? undefined : String(v)),
  z.string().optional(),
);

const searchSchema = z.object({
  view: z.preprocess((v) => {
    const value = String(v ?? "");
    return value === "clients" || value === "houses" || value === "jobs" ? value : undefined;
  }, z.enum(["jobs", "clients", "houses"]).optional()),
  q: queryString,
});

type ShopView = "jobs" | "clients" | "houses";

export const Route = createFileRoute("/app/properties")({
  validateSearch: (s) => searchSchema.parse(s),
  component: PropertiesPage,
});

function PropertiesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["shop-index"], queryFn: () => listShopIndex() });
  const view: ShopView = search.view ?? "jobs";
  const query = search.q ?? "";

  const houses = q.data?.houses ?? [];
  const work = q.data?.work ?? [];
  const clients = q.data?.clients ?? [];

  const filteredWork = useMemo(() => work.filter((row) => matchesHay(hayForWork(row), query)), [work, query]);
  const filteredClients = useMemo(
    () => clients.filter((row) => matchesHay(hayForClient(row), query)),
    [clients, query],
  );
  const filteredHouses = useMemo(
    () => houses.filter((row) => matchesHay(hayForHouse(row), query)),
    [houses, query],
  );

  function setView(next: ShopView) {
    void navigate({
      to: "/app/properties",
      search: { view: next === "jobs" ? undefined : next, q: query.trim() || undefined },
    });
  }

  function setQuery(next: string) {
    void navigate({
      to: "/app/properties",
      search: { view: view === "jobs" ? undefined : view, q: next.trim() ? next : undefined },
      replace: true,
    });
  }

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) {
    return <p className="text-destructive">{q.error instanceof Error ? q.error.message : "Could not load jobs."}</p>;
  }

  const emptyShop = houses.length === 0 && work.length === 0 && filteredWork.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Jobs</h1>
          <p className="mt-1 max-w-xl text-muted-foreground">
            Work in progress, the people you quote, and the houses on file. Search any of those.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/new">Start a Quote</Link>
        </Button>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search address, client, email, or job title"
        aria-label="Search jobs, clients, and houses"
      />

      <div className="flex flex-wrap gap-2">
        <ViewTab
          label="Jobs"
          count={filteredWork.length}
          active={view === "jobs"}
          onClick={() => setView("jobs")}
        />
        <ViewTab
          label="Clients"
          count={filteredClients.length}
          active={view === "clients"}
          onClick={() => setView("clients")}
        />
        <ViewTab
          label="Houses"
          count={filteredHouses.length}
          active={view === "houses"}
          onClick={() => setView("houses")}
        />
      </div>

      {emptyShop ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          No houses yet. Send a quote and the address, the client, and the job land here.
        </p>
      ) : view === "jobs" ? (
        <JobsList rows={filteredWork} query={query} />
      ) : view === "clients" ? (
        <ClientsList rows={filteredClients} query={query} />
      ) : (
        <HousesList rows={filteredHouses} query={query} />
      )}
    </div>
  );
}

function ViewTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground shadow-[var(--shadow-border)]",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {count}
      </span>
    </button>
  );
}

function JobsList({ rows, query }: { rows: ShopWorkRow[]; query: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query.trim() ? "No jobs match that search." : "No open quotes or completed jobs yet."}
      </p>
    );
  }
  const open = rows.filter((row) => row.kind === "proposal" || row.kind === "invite");
  const done = rows.filter((row) => row.kind === "job");
  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Open</h2>
          <WorkRows rows={open} />
        </section>
      )}
      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Completed</h2>
          <WorkRows rows={done} />
        </section>
      )}
    </div>
  );
}

function WorkRows({ rows }: { rows: ShopWorkRow[] }) {
  return (
    <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
      {rows.map((row) => {
        const body = (
          <>
            <div className="min-w-0">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">
                {row.homeowner_name} · {row.address_line}
                {row.city ? `, ${row.city}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status} />
              <span className="text-sm text-muted-foreground">
                {shortDate(row.completed_at || row.created_at)}
              </span>
            </div>
          </>
        );
        const className =
          "flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between";
        return (
          <li key={`${row.kind}-${row.id}`}>
            {row.kind === "invite" && row.invite_token ? (
              <Link to="/app/new" search={{ invite: row.invite_token }} className={className}>
                {body}
              </Link>
            ) : row.kind === "proposal" || row.proposal_id ? (
              <Link to="/app/proposals/$id" params={{ id: row.proposal_id || row.id }} className={className}>
                {body}
              </Link>
            ) : (
              <Link to="/app/properties/$id" params={{ id: row.property_id }} className={className}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ClientsList({ rows, query }: { rows: ShopClientRow[]; query: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query.trim() ? "No clients match that search." : "Clients appear when a house has a name and email."}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((client) => (
        <li key={client.key} className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="font-display text-lg font-medium">{client.name}</p>
              <p className="text-sm text-muted-foreground">
                {client.email || "No email"}
                {client.phone ? ` · ${client.phone}` : ""}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {client.houseCount} {client.houseCount === 1 ? "house" : "houses"}
              {client.openCount ? ` · ${client.openCount} open` : ""}
              {client.jobCount ? ` · ${client.jobCount} completed` : ""}
            </p>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-lg bg-background">
            {client.houses.map((house) => (
              <li key={house.id}>
                <Link
                  to="/app/properties/$id"
                  params={{ id: house.id }}
                  className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span>{house.address_line}</span>
                  <span className="text-muted-foreground">
                    {house.city}, {house.state} {house.zip}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function HousesList({ rows, query }: { rows: PropertyListRow[]; query: string }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {query.trim() ? "No houses match that search." : "No houses on file."}
      </p>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((p) => (
        <HouseCard
          key={p.id}
          to="/app/properties/$id"
          params={{ id: p.id }}
          address={p.address_line}
          city={p.city}
          state={p.state}
          zip={p.zip}
          name={p.homeowner_name}
          coverSrc={p.cover_src}
          factCount={p.fact_count}
          jobCount={p.job_count}
          photoCount={p.photo_count}
          openCount={p.open_proposal_count}
        />
      ))}
    </div>
  );
}

function matchesHay(hay: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return hay.includes(q);
}

function hayForWork(row: ShopWorkRow) {
  return [
    row.title,
    row.summary,
    row.homeowner_name,
    row.homeowner_email,
    row.homeowner_phone,
    row.address_line,
    row.city,
    row.state,
    row.zip,
    row.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hayForClient(row: ShopClientRow) {
  return [
    row.name,
    row.email,
    row.phone,
    ...row.houses.flatMap((h) => [h.address_line, h.city, h.state, h.zip]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hayForHouse(row: PropertyListRow) {
  return [row.address_line, row.city, row.state, row.zip, row.homeowner_name, row.homeowner_email, row.homeowner_phone]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
