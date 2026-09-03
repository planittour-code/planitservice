import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HouseCard } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getHousehold } from "@/lib/housefile/server";
import { PROPERTY_ANNUAL, PROPERTY_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { startBillingPortal } from "@/lib/housefile/stripe-billing";

export const Route = createFileRoute("/home/")({ component: HomeDashboard });

function HomeDashboard() {
  const q = useQuery({ queryKey: ["household"], queryFn: () => getHousehold() });
  const portal = useMutation({
    mutationFn: () => startBillingPortal({ data: { returnPath: "/home" } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not open billing"),
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full" />;

  const houses = q.data?.houses ?? [];
  const planLabel = (house: (typeof houses)[number]) => {
    if (!house.plan) return "No plan yet";
    const tier = house.plan.tier === "pro" ? "Pro" : "Standard";
    const cadence = house.plan.cadence === "annual" ? "yearly" : "monthly";
    return `${tier} plan · billed ${cadence}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Your Property Records</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {houses.length === 1 ? "This is the house on your account." : "Houses on this account."}
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Open a card to add photos, products, warranties, and maintenance. Add another address only
            if you own a second property — one address is one record.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/home/add">Add another property</Link>
        </Button>
      </div>

      {houses.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">No Property Record yet</p>
            <p className="text-sm text-muted-foreground">Add the address you just paid for.</p>
            <Button asChild>
              <Link to="/home/add">Add a property</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={houses.length === 1 ? "max-w-md" : "grid gap-4 md:grid-cols-2"}>
          {houses.map((h) => (
            <HouseCard
              key={h.id}
              to={"/home/$id"}
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
                  {planLabel(h)}
                  {h.dueSoon ? ` · ${h.dueSoon} maintenance due soon` : ""}
                </p>
              }
            />
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="font-display text-xl font-medium tracking-tight">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Standard is ${dollars(PROPERTY_MONTHLY)}/month or ${dollars(PROPERTY_ANNUAL)}/year per
          property. Change the card or cancel here. Access lasts through the period you already paid.
        </p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
          >
            {portal.isPending ? "Opening…" : "Manage subscription"}
          </Button>
        </div>
      </section>
    </div>
  );
}
