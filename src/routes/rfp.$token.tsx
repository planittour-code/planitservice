import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeownerHeader } from "@/components/homeowner-chrome";
import { workLabel } from "@/components/rfp-panel";
import { Wordmark } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { shortDate } from "@/lib/housefile/format";
import { closeRfp, getRfpByToken } from "@/lib/housefile/server";

export const Route = createFileRoute("/rfp/$token")({
  loader: async ({ params }) => {
    try {
      return await getRfpByToken({ data: params.token });
    } catch {
      return null;
    }
  },
  component: RfpPage,
});

function RfpPage() {
  const { token } = Route.useParams();
  const { user } = useCurrentUserState();
  const initial = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["rfp", token],
    queryFn: () => getRfpByToken({ data: token }),
    initialData: initial ?? undefined,
  });
  const close = useMutation({
    mutationFn: () => closeRfp({ data: token }),
    onSuccess: () => void q.refetch(),
  });

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <Skeleton className="mx-auto h-64 max-w-3xl" />
      </div>
    );
  }
  if (!q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">Request not found</h1>
        </div>
      </main>
    );
  }

  const { rfp, quotes, houseToken } = q.data;
  const mine = Boolean(user && user.id === rfp.user_id);
  const place = [rfp.city, rfp.state, rfp.zip].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-background">
      {houseToken ? (
        <HomeownerHeader houseToken={houseToken} company={rfp.homeowner_name} />
      ) : (
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
            <Wordmark to="/home" />
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/market">Marketplace</Link>
            </Button>
          </div>
        </header>
      )}
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        <header className="space-y-3">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            {workLabel(rfp.work_id)} request · {rfp.status}
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight">{rfp.title}</h1>
          <p className="text-muted-foreground">
            {rfp.address_line}
            {place ? `, ${place}` : ""}
            <span className="mx-2">·</span>
            {rfp.homeowner_name}
            <span className="mx-2">·</span>
            Posted {shortDate(rfp.created_at)}
          </p>
          {rfp.budget ? <p className="text-sm">Budget: {rfp.budget}</p> : null}
        </header>
        <p className="whitespace-pre-wrap leading-relaxed">{rfp.body}</p>

        {rfp.status === "open" && (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link
                to="/app/new"
                search={{
                  work: rfp.work_id,
                  address: rfp.address_line,
                  city: rfp.city,
                  state: rfp.state,
                  zip: rfp.zip,
                  rfp: rfp.share_token,
                }}
              >
                Quote this job
              </Link>
            </Button>
            {mine && (
              <Button type="button" variant="ghost" onClick={() => close.mutate()}>
                Close request
              </Button>
            )}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Bids</h2>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shops have quoted yet.</p>
          ) : (
            <ul className="space-y-2">
              {quotes.map((bid) => (
                <li
                  key={bid.id}
                  className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{bid.company_name}</p>
                    <p className="text-sm text-muted-foreground">{bid.proposal_title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={bid.proposal_status} />
                    <Button asChild size="sm">
                      <Link to="/p/$token" params={{ token: bid.proposal_token }}>
                        Open estimate
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
