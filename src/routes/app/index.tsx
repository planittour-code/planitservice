import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { workTypesFor } from "@/lib/housefile/quote";
import { getDashboard, listWorkKits } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/")({ component: ShopHome });

function ShopHome() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const kitsQ = useQuery({ queryKey: ["work-kits"], queryFn: () => listWorkKits({ data: {} }) });
  const [workId, setWorkId] = useState("");
  const [kitId, setKitId] = useState("");
  const kitsForWork = (kitsQ.data?.kits ?? []).filter((kit) => kit.work_id === workId);
  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return <p className="text-destructive">Could not load the shop.</p>;
  }
  const { company, properties, proposals, pending, role } = q.data;
  const clients = q.data.clients ?? [];
  const trades = workTypesFor(company.trades);
  const propertyCount = properties.length;
  const jobCount = properties.reduce((n, p) => n + p.job_count + p.open_proposal_count, 0);

  function startQuote() {
    if (!workId) return;
    void navigate({
      to: "/app/new",
      search: { work: workId, kit: kitId || undefined },
    });
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        {company.logo_src ? (
          <div className="-mx-4 overflow-hidden bg-card shadow-[var(--shadow-border)] sm:-mx-5 sm:rounded-xl">
            <img
              src={company.logo_src}
              alt={company.name}
              className="h-44 w-full object-contain p-4 sm:h-56 sm:p-6 md:h-72"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{company.name}</h1>
          <Button asChild variant="outline">
            <Link to="/app/book">Materials</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium">Start a Quote</h2>
          <p className="text-sm text-muted-foreground">
            Pick a work category, then a sub-category. Address and details come next.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quote-work">Work category</Label>
            <select
              id="quote-work"
              value={workId}
              onChange={(e) => {
                setWorkId(e.target.value);
                setKitId("");
              }}
              className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">Select work</option>
              {trades.map((work) => (
                <option key={work.id} value={work.id}>
                  {work.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quote-kit">Sub-category</Label>
            <select
              id="quote-kit"
              value={kitId}
              disabled={!workId || kitsQ.isLoading}
              onChange={(e) => setKitId(e.target.value)}
              className="flex h-11 w-full rounded-md bg-card px-3 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {!workId
                  ? "Pick a work category first"
                  : kitsQ.isLoading
                    ? "Loading…"
                    : kitsForWork.length
                      ? "Select sub-category"
                      : "No sub-categories — start blank"}
              </option>
              {kitsForWork.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="button" disabled={!workId || (kitsForWork.length > 0 && !kitId)} onClick={startQuote}>
          Start a Quote
        </Button>
      </section>

      {role === "owner" && (pending?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Needs approval</h2>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {pending.map((pr) => (
              <li key={pr.id}>
                <Link
                  to="/app/proposals/$id"
                  params={{ id: pr.id }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{pr.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pr.homeowner_name} · {pr.address_line}
                    </p>
                  </div>
                  <StatusBadge status={pr.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {properties.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <h2 className="font-display text-2xl font-medium">No clients yet</h2>
            <p className="text-sm text-muted-foreground">
              Enter an address, pick the work, and fill the details that price it. The house, the
              client, and the job all open from that quote.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-medium">Client List</h2>
              <p className="text-sm text-muted-foreground">
                {propertyCount} {propertyCount === 1 ? "property" : "properties"} · {jobCount}{" "}
                {jobCount === 1 ? "job" : "jobs"}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/properties" search={{ view: "clients" }}>
                All clients
              </Link>
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {clients.slice(0, 8).map((client) => (
              <li key={client.key}>
                <Link
                  to="/app/properties"
                  search={{ view: "clients", q: client.email || client.name }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {client.houseCount} {client.houseCount === 1 ? "property" : "properties"} ·{" "}
                      {client.jobCount + client.openCount}{" "}
                      {client.jobCount + client.openCount === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">{client.email || client.phone || ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {proposals.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl font-medium">Recent quotes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/properties">All jobs</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {proposals.slice(0, 6).map((pr) => (
              <li key={pr.id}>
                <Link
                  to="/app/proposals/$id"
                  params={{ id: pr.id }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{pr.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {pr.homeowner_name} · {pr.address_line}
                    </p>
                  </div>
                  <StatusBadge status={pr.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
