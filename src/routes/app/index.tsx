import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShopScheduleBoard } from "@/components/shop-schedule";
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
        <Skeleton className="h-12 w-40 sm:h-14" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return <p className="text-destructive">Could not load the shop.</p>;
  }
  const { company, properties, proposals, pending, role, schedule } = q.data;
  const clients = q.data.clients ?? [];
  const namedInvites = q.data.namedInvites ?? [];
  const propertyCount = properties.length;
  const jobCount =
    properties.reduce((n, p) => n + p.job_count + p.open_proposal_count, 0) + namedInvites.length;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {company.logo_src ? (
              <img
                src={company.logo_src}
                alt=""
                className="h-12 w-auto max-w-[10rem] object-contain sm:h-14"
              />
            ) : null}
            <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{company.name}</h1>
          </div>
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
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/new">Start a Quote</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/leads">Request Estimates leads</Link>
          </Button>
        </div>
      </section>

      {namedInvites.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl font-medium">Named jobs</h2>
            <p className="text-sm text-muted-foreground">
              Work sent to this shop from a Property Record. Quote from Materials.
            </p>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {namedInvites.map((row) => (
              <li key={row.id}>
                <Link
                  to="/app/new"
                  search={{ invite: row.invite_token ?? undefined }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {row.homeowner_name} · {row.address_line}
                      {row.city ? `, ${row.city}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ShopScheduleBoard items={schedule ?? []} />

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

      {properties.length === 0 && namedInvites.length === 0 ? (
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
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/app/campaign">Email past customers</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/properties" search={{ view: "clients" }}>
                  All clients
                </Link>
              </Button>
            </div>
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
