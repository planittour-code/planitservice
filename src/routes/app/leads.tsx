import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { WORK_BY_ID } from "@/lib/housefile/quote";
import { listQuoteLeads } from "@/lib/housefile/server";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/app/leads")({ component: LeadsPage });

function LeadsPage() {
  const q = useQuery({ queryKey: ["quote-leads"], queryFn: () => listQuoteLeads() });
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) {
    return <p className="text-destructive">{q.error instanceof Error ? q.error.message : "Could not load leads."}</p>;
  }
  const leads = q.data?.leads ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-medium tracking-tight">Quote requests</h1>
        <p className="max-w-xl text-muted-foreground">
          Address and trade from people who looked up a house. Sell the lead. Quote it yourself.
        </p>
      </header>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inbound addresses yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
          {leads.map((lead) => {
            const work = lead.work_id ? WORK_BY_ID[lead.work_id] : null;
            const place = [lead.city, lead.state, lead.zip].filter(Boolean).join(" ");
            return (
              <li key={lead.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                <div>
                  <p className="font-medium">{lead.address}</p>
                  <p className="text-sm text-muted-foreground">
                    {place || "—"}
                    {lead.found ? " · Property Record exists" : " · No Property Record yet"}
                  </p>
                </div>
                <p className="text-sm">
                  {work ? work.name : "Looked up"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
