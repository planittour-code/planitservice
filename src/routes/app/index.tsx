import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HouseCard } from "@/components/site-chrome";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adoptSampleHouse, getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/")({ component: ShopHome });

function ShopHome() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const adopt = useMutation({
    mutationFn: () => adoptSampleHouse(),
    onSuccess: (res) => {
      toast.success(res.already ? "Sample house is already in your shop" : "142 Maple Street is in your shop");
      void q.refetch();
      void navigate({ to: "/app/properties/$id", params: { id: res.propertyId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not load sample"),
  });
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

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">{company.trade.replace(/-/g, " ")}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{company.name}</h1>
      </div>

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
            <h2 className="font-display text-2xl font-medium">No houses yet</h2>
            <p className="text-sm text-muted-foreground">
              Enter an address, pick the work, and fill the measurements that price it. Or load the
              sample — roof, paint, gutters, and an interior draft already on file.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/app/new">Start a quote</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={adopt.isPending}
                onClick={() => adopt.mutate()}
              >
                {adopt.isPending ? "Loading…" : "Load 142 Maple Street"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {properties.map((p) => (
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
        </section>
      )}

      {proposals.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Recent proposals</h2>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {proposals.map((pr) => (
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
