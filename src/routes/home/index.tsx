import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HouseCard } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHousehold } from "@/lib/housefile/server";
import { PROPERTY_ANNUAL, PROPERTY_MONTHLY, dollars } from "@/lib/housefile/pricing";

export const Route = createFileRoute("/home/")({ component: HomeDashboard });

function HomeDashboard() {
  const q = useQuery({ queryKey: ["household"], queryFn: () => getHousehold() });
  if (q.isLoading) return <Skeleton className="h-48 w-full" />;

  const houses = q.data?.houses ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Your houses</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">The record, by address.</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            ${dollars(PROPERTY_MONTHLY)}/month or ${dollars(PROPERTY_ANNUAL)}/year for each property.
            Share a link. Transfer the record. Pro adds RFPs and a property manager.
          </p>
        </div>
        <Button asChild>
          <Link to="/home/add">Add a property</Link>
        </Button>
      </div>

      {houses.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">No properties on this account yet</p>
            <p className="text-sm text-muted-foreground">
              Start a File, or open one a contractor already began.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/home/add">Add a property</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/invite/$token" params={{ token: "maple-invite" }}>
                  Open the Maple sample
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {houses.map((h) => (
            <HouseCard
              key={h.id}
              to="/home/$id"
              params={{ id: h.id }}
              address={h.address_line}
              city={h.city}
              state={h.state}
              zip={h.zip}
              coverSrc={h.cover_src}
              factCount={h.fact_count}
              jobCount={h.job_count}
              photoCount={h.photo_count}
              footnote={
                <p className="text-sm text-muted-foreground">
                  {h.plan
                    ? `${h.plan.tier === "pro" ? "Pro" : "Standard"} · ${h.plan.cadence}`
                    : "No plan yet"}
                  {h.dueSoon ? ` · ${h.dueSoon} due soon` : ""}
                </p>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
