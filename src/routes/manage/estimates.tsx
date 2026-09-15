import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MeasureGuidePanel } from "@/components/measure-guide";
import { NamedShopInviteForm } from "@/components/named-shop-invite";
import { RecordSection } from "@/components/house-panels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_PHOTO } from "@/lib/housefile/fields";
import { getPortfolio, getPortfolioRecord } from "@/lib/housefile/server";
import type { PortfolioHouse } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manage/estimates")({ component: ManageEstimates });

function ManageEstimates() {
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: () => getPortfolio() });
  const houses = portfolio.data?.houses ?? [];
  const [houseId, setHouseId] = useState<string | null>(null);
  const selectedId = houseId && houses.some((h) => h.id === houseId) ? houseId : (houses[0]?.id ?? null);
  const selected = houses.find((h) => h.id === selectedId) ?? null;
  const record = useQuery({
    queryKey: ["portfolio-record", selectedId],
    queryFn: () => getPortfolioRecord({ data: selectedId as string }),
    enabled: Boolean(selectedId),
  });

  const openEstimates = useMemo(
    () => houses.filter((h) => (h.open_proposal_count ?? 0) > 0 || (h.acceptedEstimates?.length ?? 0) > 0),
    [houses],
  );

  if (portfolio.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!portfolio.data) return <p className="text-destructive">Could not load the office.</p>;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Estimates</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Ask a shop with numbers, not a walk-through.</h1>
        <p className="max-w-2xl text-muted-foreground">
          Measure what you can, put it on the Property Record, then invite a go-to shop. They quote
          from the jobs and photos already on file.
        </p>
      </header>

      <MeasureGuidePanel audience="manager" />

      <RecordSection
        title="Invite a shop"
        blurb="Pick the house, send the address and the ask. The shop quotes from this record."
        photo={CATEGORY_PHOTO.paint}
        countLabel={selected ? selected.address_line : "Pick a house"}
        chips={
          houses.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {houses.slice(0, 6).map((h) => (
                <li
                  key={h.id}
                  className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                >
                  {h.address_line}
                </li>
              ))}
            </ul>
          ) : undefined
        }
      >
        {houses.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Add a property first. Then you can invite a shop against that record.
            </p>
            <Button asChild>
              <Link to="/manage/add">Add a Property</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {houses.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setHouseId(h.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full px-3 text-sm shadow-[var(--shadow-border)]",
                    selectedId === h.id
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-background hover:shadow-[var(--shadow-border-hover)]",
                  )}
                >
                  {h.address_line}
                </button>
              ))}
            </div>
            {selected ? (
              <p className="text-sm text-muted-foreground">
                {selected.city}, {selected.state} {selected.zip}
                {selected.homeowner_name ? ` · ${selected.homeowner_name}` : ""}
                {selected.job_count
                  ? ` · ${selected.job_count} ${selected.job_count === 1 ? "job" : "jobs"} on file`
                  : " · no jobs on file yet"}
              </p>
            ) : null}
            {record.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : record.data && selectedId ? (
              <NamedShopInviteForm
                propertyId={selectedId}
                invites={record.data.workInvites ?? []}
                estimates={record.data.shopEstimates ?? []}
                onDone={() => void record.refetch()}
              />
            ) : null}
          </div>
        )}
      </RecordSection>

      <RecordSection
        title="Estimates already on file"
        blurb="Open estimates and work the owner already agreed. Open the house to see the full record."
        photo={CATEGORY_PHOTO.house}
        countLabel={`${openEstimates.length} houses`}
        chips={
          openEstimates.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {openEstimates.slice(0, 6).map((h) => (
                <li
                  key={h.id}
                  className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold"
                >
                  {h.open_title || h.address_line}
                </li>
              ))}
            </ul>
          ) : undefined
        }
      >
        {openEstimates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. Invite a shop above, or open a house and Request Estimates from shops that
            service the address.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md bg-background shadow-[var(--shadow-border)]">
            {openEstimates.map((h) => (
              <EstimateHouseRow key={h.id} house={h} />
            ))}
          </ul>
        )}
      </RecordSection>
    </div>
  );
}

function EstimateHouseRow({ house }: { house: PortfolioHouse }) {
  const agreed = house.acceptedEstimates?.length ?? 0;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{house.address_line}</p>
        <p className="text-sm text-muted-foreground">
          {house.homeowner_name}
          {house.open_title ? ` · ${house.open_title}` : ""}
          {house.open_proposal_count
            ? ` · ${house.open_proposal_count} open`
            : ""}
          {agreed ? ` · ${agreed} agreed` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {house.open_token ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/p/$token" params={{ token: house.open_token }}>
              View estimate
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm">
          <Link to="/manage/$id" params={{ id: house.id }}>
            Open house
          </Link>
        </Button>
      </div>
    </li>
  );
}
