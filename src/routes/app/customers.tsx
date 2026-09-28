import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HouseCard } from "@/components/site-chrome";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listShopIndex } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/customers")({ component: CustomersPage });

function CustomersPage() {
  const q = useQuery({ queryKey: ["shop-index"], queryFn: () => listShopIndex() });
  const [query, setQuery] = useState("");
  const houses = q.data?.houses ?? [];
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const current = houses.filter((house) => house.job_count > 0 || house.open_proposal_count > 0);
    const list = current.length > 0 ? current : houses;
    if (!needle) return list;
    return list.filter((house) =>
      [house.homeowner_name, house.address_line, house.city, house.zip, house.homeowner_email]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [houses, query]);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <p className="text-destructive">Could not load customers.</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm tracking-wide text-muted-foreground uppercase">Current customers</p>
        <h1 className="font-display text-2xl font-medium tracking-tight md:text-3xl">
          The houses this shop keeps
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Open a cover to the record: job history, materials, measurements, and warranties. The
          homeowner keeps the details that were agreed when the work started.
        </p>
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a customer or address"
        aria-label="Search customers"
      />
      {shown.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-border)]">
          {houses.length === 0
            ? "No customers yet. A quote opens the first Property Record."
            : "No customers match that search."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((house) => (
            <HouseCard
              key={house.id}
              to="/app/properties/$id"
              params={{ id: house.id }}
              address={house.address_line}
              city={house.city}
              state={house.state}
              zip={house.zip}
              name={house.homeowner_name}
              coverSrc={house.cover_src}
              factCount={house.fact_count}
              jobCount={house.job_count}
              photoCount={house.photo_count}
              openCount={house.open_proposal_count}
              footnote={
                <p className="text-sm text-muted-foreground">
                  {house.job_count} {house.job_count === 1 ? "job" : "jobs"} on the record
                  {house.open_proposal_count
                    ? ` · ${house.open_proposal_count} open`
                    : ""}
                </p>
              }
            />
          ))}
        </div>
      )}
      {houses.length > shown.length && !query.trim() ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/app/properties" search={{ view: "houses" }} className="underline underline-offset-4">
            All houses on file
          </Link>
        </p>
      ) : null}
    </div>
  );
}
