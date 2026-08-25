import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HouseCard } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { adoptSampleHouse, getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/properties")({ component: PropertiesPage });

function PropertiesPage() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const adopt = useMutation({
    mutationFn: () => adoptSampleHouse(),
    onSuccess: (res) => {
      toast.success("142 Maple Street is in your shop");
      void q.refetch();
      void navigate({ to: "/app/properties/$id", params: { id: res.propertyId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not load sample"),
  });
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
        <div className="space-y-3">
          <p className="text-muted-foreground">No houses yet. Send a proposal to open a file.</p>
          <Button
            type="button"
            variant="outline"
            disabled={adopt.isPending}
            onClick={() => adopt.mutate()}
          >
            {adopt.isPending ? "Loading…" : "Load 142 Maple Street"}
          </Button>
        </div>
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
