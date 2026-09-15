import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { workLabel } from "@/components/rfp-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { shortDate } from "@/lib/housefile/format";
import { listMarketRfps } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/leads")({ component: LeadsPage });

function LeadsPage() {
  const q = useQuery({ queryKey: ["shop-leads"], queryFn: () => listMarketRfps() });
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;
  if (q.error || !q.data) {
    return <p className="text-destructive">Could not load Request Estimates.</p>;
  }
  const { rfps, trades, area } = q.data;
  const place = [area?.city, area?.zip].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Request Estimates</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Leads in your area</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Open requests for {trades.length ? trades.join(", ") : "the categories you offer"}
          {place ? ` near ${place}` : ""}. Only jobs in those categories, in this shop’s service
          area.
        </p>
      </div>
      {rfps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {trades.length === 0
            ? "Pick the categories you offer in shop settings. Request Estimates only match those trades."
            : "No matching Request Estimates right now. Keep the shop address and services current so new jobs in this area show up here."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
          {rfps.map((rfp) => (
            <li key={rfp.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{rfp.title}</p>
                <p className="text-sm text-muted-foreground">
                  {workLabel(rfp.work_id)} · {rfp.address_line}, {rfp.city} {rfp.zip} ·{" "}
                  {shortDate(rfp.created_at)}
                </p>
              </div>
              <Button asChild size="sm">
                <Link
                  to="/app/new"
                  search={{
                    work: rfp.work_id,
                    address: rfp.address_line,
                    city: rfp.city,
                    state: rfp.state,
                    zip: rfp.zip,
                    rfp: rfp.share_token,
                  }}
                >
                  Quote this job
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
