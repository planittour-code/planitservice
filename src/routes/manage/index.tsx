import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HouseCard } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getPortfolio } from "@/lib/housefile/server";
import {
  MANAGE_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { BILLING_PORTAL } from "@/lib/housefile/stripe";

export const Route = createFileRoute("/manage/")({ component: ManageDashboard });

function ManageDashboard() {
  const [q, setQ] = useState("");
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => getPortfolio() });

  const houses = useMemo(() => {
    const list = portfolio.data?.houses ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((h) => {
      const hay = `${h.address_line} ${h.city} ${h.state} ${h.zip} ${h.homeowner_name ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [portfolio.data?.houses, q]);

  if (portfolio.isLoading) return <Skeleton className="h-48 w-full" />;

  const cap = portfolio.data?.cap ?? MANAGE_INCLUDED;
  const count = portfolio.data?.houseCount ?? 0;
  const name = portfolio.data?.name ?? "Portfolio";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Property manager</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">{name}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            {count} of {cap} houses on this portfolio. Open a card for photos, jobs, warranties, and
            issued estimates.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/manage/add">Add a house</Link>
        </Button>
      </div>

      {(portfolio.data?.houses.length ?? 0) > 0 ? (
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address or owner"
          aria-label="Search houses"
        />
      ) : null}

      {count === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">No houses in this portfolio yet</p>
            <p className="text-sm text-muted-foreground">
              Add an address you manage. The first {MANAGE_INCLUDED} are on the base plan.
            </p>
            <Button asChild>
              <Link to="/manage/add">Add a house</Link>
            </Button>
          </CardContent>
        </Card>
      ) : houses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No houses match that search.</p>
      ) : (
        <div className={houses.length === 1 ? "max-w-md" : "grid gap-4 md:grid-cols-2"}>
          {houses.map((h) => (
            <HouseCard
              key={h.id}
              to="/manage/$id"
              params={{ id: h.id }}
              address={h.address_line}
              city={h.city}
              state={h.state}
              zip={h.zip}
              name={h.homeowner_name}
              coverSrc={h.cover_src}
              factCount={h.fact_count}
              jobCount={h.job_count}
              photoCount={h.photo_count}
              openCount={h.open_proposal_count || undefined}
              footnote={
                h.open_title ? (
                  <p className="text-sm text-muted-foreground">Estimate: {h.open_title}</p>
                ) : null
              }
            />
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card/40 p-5">
        <h2 className="font-display text-xl font-medium tracking-tight">Billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base is ${dollars(MANAGE_MONTHLY)}/month or ${dollars(MANAGE_ANNUAL)}/year for{" "}
          {MANAGE_INCLUDED} houses. Extra houses ${dollars(MANAGE_EXTRA_MONTHLY)}/month each. Change
          the card or cancel here. Access lasts through the period you already paid.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <a href={BILLING_PORTAL}>Manage subscription</a>
          </Button>
        </div>
      </section>
    </div>
  );
}
