import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeownerHeader } from "@/components/homeowner-chrome";
import { ProposalDoc } from "@/components/proposal-doc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProposalByToken } from "@/lib/housefile/server";

export const Route = createFileRoute("/p/$token/accepted")({
  component: AcceptedEstimate,
});

function AcceptedEstimate() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["p", token, "accepted"],
    queryFn: () => getProposalByToken({ data: token }),
    retry: false,
  });
  if (q.isLoading) return <Skeleton className="mx-auto mt-10 h-64 max-w-3xl" />;
  if (!q.data) return <p className="p-6 text-destructive">Estimate not found.</p>;
  const bundle = q.data;

  return (
    <div className="min-h-screen bg-background">
      <HomeownerHeader
        houseToken={bundle.property.share_token}
        estimateToken={bundle.proposal.share_token}
        company={bundle.company.name}
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-5 sm:py-8">
        <div className="space-y-2">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Accepted estimate</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Work may begin.</h1>
          <p className="text-muted-foreground">
            Every line was accepted. This is the agreement for {bundle.property.address_line}.
          </p>
        </div>
        <ProposalDoc bundle={bundle} mode="accepted" onChanged={() => q.refetch()} />
        <Button asChild variant="outline" className="w-full">
          <Link to="/p/$token" params={{ token }}>
            Back to the working estimate
          </Link>
        </Button>
      </main>
    </div>
  );
}
