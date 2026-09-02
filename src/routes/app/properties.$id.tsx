import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Completeness,
  CopyLink,
  FactsPanel,
  InvitationLetter,
  JobTimeline,
  MissingChips,
  PhotoGrid,
  SectionRule,
  WarrantyList,
} from "@/components/house-panels";
import { QuoteTypePicker } from "@/components/quote-type";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContractorProperty } from "@/lib/housefile/server";

export const Route = createFileRoute("/app/properties/$id")({ component: PropertyPage });

function PropertyPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["property", id],
    queryFn: () => getContractorProperty({ data: id }),
  });
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!q.data) return <p className="text-destructive">House not found.</p>;
  const file = q.data;
  const p = file.property;
  const housePath = `/house/${p.share_token}`;

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <p className="text-sm text-muted-foreground">{file.company.name}</p>
        <h1 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
          {p.address_line}
        </h1>
        <p className="text-muted-foreground">
          {p.city}, {p.state} {p.zip} · {p.homeowner_name} · {p.homeowner_email}
        </p>
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <QuoteTypePicker
            onPick={(workId) => {
              void navigate({ to: "/app/new", search: { property: p.id, work: workId } });
            }}
            hint="This Property Record is a start, not the whole house. Pick the trade you are quoting — a painter’s record will not price a roof."
          />
        </div>
        <Completeness filled={file.filledCount} total={file.totalCount} />
        <MissingChips file={file} limit={8} href="#house-data" />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/new" search={{ property: p.id }}>
              New quote for this house
            </Link>
          </Button>
          <CopyLink path={housePath} label="Copy property record link" />
        </div>
        <details className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          <summary className="cursor-pointer font-medium">Invitation to {p.homeowner_name}</summary>
          <div className="mt-4">
            <InvitationLetter
              email={p.homeowner_email}
              name={p.homeowner_name}
              address={`${p.address_line}, ${p.city}`}
              company={file.company.name}
              invitePath={`/invite/${p.invite_token}`}
              housePath={housePath}
            />
          </div>
        </details>
      </header>

      {file.proposals.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Proposals</h2>
          <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
            {file.proposals.map((pr) => (
              <li key={pr.id}>
                <Link
                  to="/app/proposals/$id"
                  params={{ id: pr.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span>{pr.title}</span>
                  <StatusBadge status={pr.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SectionRule />
      <div id="photos">
        <PhotoGrid file={file} mode="contractor" onChanged={() => q.refetch()} />
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
        <FactsPanel file={file} mode="contractor" onChanged={() => q.refetch()} />
      </div>
    </div>
  );
}
