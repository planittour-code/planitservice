import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HomeownerHeader } from "@/components/homeowner-chrome";
import { Wordmark } from "@/components/logo";
import { ProposalDoc } from "@/components/proposal-doc";
import { SampleLock } from "@/components/sample-lock";
import { Skeleton } from "@/components/ui/skeleton";
import { isSampleHouseToken, isSampleShopQuote } from "@/lib/housefile/sample";
import { getProposalByToken } from "@/lib/housefile/server";

export const Route = createFileRoute("/p/$token")({
  loader: async ({ params }) => {
    try {
      return { kind: "ok" as const, bundle: await getProposalByToken({ data: params.token }) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("waiting on the shop")) return { kind: "pending" as const };
      return { kind: "missing" as const };
    }
  },
  component: PublicProposal,
});

function PublicProposal() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["p", token],
    queryFn: () => getProposalByToken({ data: token }),
    initialData: initial.kind === "ok" ? initial.bundle : undefined,
    enabled: initial.kind === "ok",
    retry: false,
  });

  if (initial.kind === "pending") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">This quote is still in the shop</h1>
          <p className="text-sm text-muted-foreground">
            A cost is waiting on the owner. You will get a new link when it is ready to review.
          </p>
        </div>
      </main>
    );
  }

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <Skeleton className="mx-auto h-64 max-w-3xl" />
      </div>
    );
  }
  if (initial.kind === "missing" || q.error || !q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">Proposal not found</h1>
        </div>
      </main>
    );
  }

  const bundle = q.data;
  const sample = isSampleHouseToken(bundle.property.share_token);

  return (
    <div className="min-h-screen bg-background">
      <HomeownerHeader
        houseToken={bundle.property.share_token}
        estimateToken={bundle.proposal.share_token}
        company={bundle.company.name}
      />
      <main className="hf-rise mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-5 sm:py-8 sm:pb-24">
        {sample ? (
          <SampleLock to={isSampleShopQuote(token) ? "/shop/open" : "/start"}>
            <ProposalDoc bundle={bundle} mode="homeowner" onChanged={() => q.refetch()} />
          </SampleLock>
        ) : (
          <ProposalDoc bundle={bundle} mode="homeowner" onChanged={() => q.refetch()} />
        )}
      </main>
    </div>
  );
}
