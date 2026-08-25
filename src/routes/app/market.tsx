import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { workLabel } from "@/components/rfp-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/housefile/format";
import { listMarketRfps } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/market")({ component: MarketPage });

function MarketPage() {
  const q = useQuery({ queryKey: ["market"], queryFn: () => listMarketRfps() });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Marketplace</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Homeowners on Pro put work on the market. Quote from the File when you can — or start
          one.
        </p>
      </div>
      {(q.data?.rfps.length ?? 0) === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          No open requests right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {(q.data?.rfps ?? []).map((rfp) => (
            <li key={rfp.id}>
              <Link
                to="/rfp/$token"
                params={{ token: rfp.share_token }}
                className="block rounded-xl bg-card px-4 py-4 shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
              >
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {workLabel(rfp.work_id)}
                </p>
                <p className="font-display text-xl font-medium">{rfp.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rfp.address_line}, {rfp.city} {rfp.state} · Posted {shortDate(rfp.created_at)}
                  {rfp.budget ? ` · ${rfp.budget}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="ghost">
        <Link to="/rfp/$token" params={{ token: "maple-roof-rfp" }}>
          Sample: Maple Street reroof
        </Link>
      </Button>
    </div>
  );
}
