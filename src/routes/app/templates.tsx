import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { workTypesFor } from "@/lib/housefile/quote";
import { getDashboard } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const types = workTypesFor(dash.data?.company.trades);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Work types</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Paint, roof, windows, gutters, siding, decks, porches. Each one asks the house for the
          numbers that price it.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {types.map((w) => (
          <Card key={w.id}>
            <CardContent className="flex h-full flex-col gap-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">{w.trade}</p>
              <h2 className="font-display text-xl font-medium">{w.name}</h2>
              <p className="text-sm text-muted-foreground">{w.blurb}</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {w.fields
                  .filter((f) => f.required)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f.key}>{f.label}</li>
                  ))}
              </ul>
              <div className="mt-auto pt-2">
                <Button asChild>
                  <Link to="/app/new" search={{ work: w.id }}>
                    Quote this
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
