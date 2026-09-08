import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CustomWorkDialog } from "@/components/custom-work-dialog";
import { StatusBadge } from "@/components/status-badge";
import { TradeGrid } from "@/components/trade-face";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { workTypesFor } from "@/lib/housefile/quote";
import { addCustomWork, getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/")({ component: ShopHome });

function ShopHome() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [adding, setAdding] = useState(false);
  const addWork = useMutation({
    mutationFn: (name: string) => addCustomWork({ data: { name } }),
    onSuccess: (res) => {
      toast.success(res.already ? "That category is already on your list" : "Category added");
      setAdding(false);
      void q.refetch();
      void navigate({ to: "/app/new", search: { work: res.workId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not add category"),
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
  const trades = workTypesFor(company.trades);

  return (
    <div className="space-y-10">
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
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{company.trade.replace(/-/g, " ")}</p>
          <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">{company.name}</h1>
        </div>
        <Button asChild variant="outline">
          <Link to="/app/book">Materials</Link>
        </Button>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium">Start a Quote</h2>
          <p className="text-sm text-muted-foreground">Pick the work. Address and details come next.</p>
        </div>
        <TradeGrid types={trades} onAddCustom={() => setAdding(true)} />
      </section>
      <CustomWorkDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSave={(name) => addWork.mutateAsync(name)}
        busy={addWork.isPending}
      />

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
            <h2 className="font-display text-2xl font-medium">No jobs yet</h2>
            <p className="text-sm text-muted-foreground">
              Enter an address, pick the work, and fill the details that price it. The house, the
              client, and the job all open from that quote.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/app/new">Start a Quote</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-medium">On the books</h2>
              <p className="text-sm text-muted-foreground">
                {properties.length} {properties.length === 1 ? "house" : "houses"} on file.
                Search by job, client, or address under Jobs.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/app/properties">Open Jobs</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {properties.slice(0, 6).map((p) => (
              <li key={p.id}>
                <Link
                  to="/app/properties/$id"
                  params={{ id: p.id }}
                  className="flex min-h-14 flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{p.address_line}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.homeowner_name}
                      {p.open_proposal_count ? ` · ${p.open_proposal_count} open` : ""}
                      {p.job_count ? ` · ${p.job_count} completed` : ""}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {p.city}, {p.state}
                  </span>
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
