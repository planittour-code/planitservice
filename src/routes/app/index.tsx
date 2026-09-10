import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/")({ component: ShopHome });

function ShopHome() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
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
  const propertyCount = properties.length;
  const jobCount = properties.reduce((n, p) => n + p.job_count + p.open_proposal_count, 0);

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
            Address and the ask first. Photos, measurements, then line items from Materials.
          </p>
        </div>
        <Button asChild>
          <Link to="/app/new">Start a Quote</Link>
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
