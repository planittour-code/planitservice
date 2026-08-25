import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Completeness,
  FactsPanel,
  JobTimeline,
  MissingChips,
  PhotoGrid,
  SectionRule,
  WarrantyList,
} from "@/components/house-panels";
import { EstimateGroups, HomeownerHeader } from "@/components/homeowner-chrome";
import { RfpForm, RfpList } from "@/components/rfp-panel";
import { FileNav } from "@/components/site-chrome";
import { Wordmark } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getHouseByToken } from "@/lib/housefile/server";

export const Route = createFileRoute("/house/$token")({
  loader: async ({ params }) => {
    try {
      return await getHouseByToken({ data: params.token });
    } catch {
      return null;
    }
  },
  component: HousePage,
});

function HousePage() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["house", token],
    queryFn: () => getHouseByToken({ data: token }),
    initialData: initial ?? undefined,
  });

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <Skeleton className="mx-auto h-64 max-w-3xl" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">House file not found</h1>
          <p className="text-sm text-muted-foreground">
            This link may be wrong. Ask the contractor to send it again.
          </p>
        </div>
      </main>
    );
  }

  const file = q.data;
  const p = file.property;
  const hero = file.photos.find((ph) => ph.category === "exterior") ?? file.photos[0];
  const latest = file.proposals.find(
    (pr) => pr.status !== "completed" && pr.status !== "pending" && pr.status !== "draft",
  );

  return (
    <div className="min-h-screen bg-background">
      <HomeownerHeader
        houseToken={p.share_token}
        estimateToken={latest?.share_token}
        company={file.company.name}
      />
      {hero && (
        <div className="mx-auto max-w-3xl px-5 pt-6">
          <img
            src={hero.src}
            alt={hero.caption || p.address_line}
            className="aspect-[16/9] min-h-40 w-full rounded-xl object-cover shadow-[var(--shadow-border)]"
          />
        </div>
      )}
      <main className="hf-rise mx-auto max-w-3xl space-y-10 px-5 py-8">
        <header id="file" className="space-y-4">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">The File</p>
          <h1 className="font-display text-4xl font-medium tracking-tight">{p.address_line}</h1>
          <p className="text-muted-foreground">
            {p.city}, {p.state} {p.zip}
            <span className="mx-2">·</span>
            Kept for {p.homeowner_name}
          </p>
          <Completeness filled={file.filledCount} total={file.totalCount} />
          <MissingChips file={file} limit={5} href="#house-data" />
        </header>
        <FileNav homeowner />

        <EstimateGroups proposals={file.proposals} />

        <SectionRule />
        <section id="rfps" className="space-y-6">
          <div>
            <h2 className="font-display text-xl font-medium">Ask the market</h2>
            <p className="text-sm text-muted-foreground">
              Pro puts this job in front of shops. They quote. Bids land here as estimates.
            </p>
          </div>
          <RfpList houseToken={p.share_token} />
          <RfpForm
            houseToken={p.share_token}
            addressLine={p.address_line}
            city={p.city}
            state={p.state}
            zip={p.zip}
            homeownerName={p.homeowner_name}
          />
        </section>

        <SectionRule />
        <div id="photos">
          <PhotoGrid file={file} mode="homeowner" token={token} onChanged={() => q.refetch()} />
        </div>
        <SectionRule />
        <div id="jobs">
          <JobTimeline file={file} />
        </div>
        <SectionRule />
        <div id="warranties">
          <WarrantyList file={file} />
        </div>
        <SectionRule />
        <div id="house-data">
          <FactsPanel file={file} mode="homeowner" token={token} onChanged={() => q.refetch()} />
        </div>
      </main>
    </div>
  );
}
