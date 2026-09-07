import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HouseCard } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/properties")({ component: PropertiesPage });

function PropertiesPage() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const properties = q.data?.properties ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Houses</h1>
          <p className="text-muted-foreground">Every address you have a file for.</p>
        </div>
        <Button asChild>
          <Link to="/app/new">Add a house</Link>
        </Button>
      </div>
      {properties.length === 0 ? (
        <p className="text-muted-foreground">No houses yet. Send a proposal to open a file.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
      )}
    </div>
  );
}
