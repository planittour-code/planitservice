import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import { shortDate } from "@/lib/housefile/format";
import type { ProposalListRow } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

const TRADE_LABEL: Record<string, string> = {
  paint: "Paint",
  roofing: "Roof",
  windows: "Windows",
  gutters: "Gutters",
  siding: "Siding",
  decks: "Decks",
  porches: "Porches",
};

export function HomeownerHeader({
  houseToken,
  estimateToken,
  company,
}: {
  houseToken: string;
  estimateToken?: string;
  company: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
        <Link
          to="/house/$token"
          params={{ token: houseToken }}
          className="flex items-center gap-2.5 text-primary"
        >
          <Mark />
          <span className="font-display text-lg font-medium tracking-tight text-foreground">
            PlanitService
          </span>
        </Link>
        <p className="hidden text-sm text-muted-foreground sm:block">{company}</p>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-5 pb-2" aria-label="For the homeowner">
        {estimateToken ? (
          <NavItem to="/p/$token" params={{ token: estimateToken }} label="This estimate" />
        ) : null}
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="estimates" label="Estimates" />
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="rfps" label="Requests" />
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="file" label="The File" />
      </nav>
    </header>
  );
}

function NavItem({
  to,
  params,
  hash,
  label,
}: {
  to: string;
  params: Record<string, string>;
  hash?: string;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      hash={hash}
      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
      activeOptions={{ exact: !hash, includeHash: Boolean(hash) }}
    >
      {label}
    </Link>
  );
}

export function EstimateGroups({
  proposals,
  currentToken,
}: {
  proposals: ProposalListRow[];
  currentToken?: string;
}) {
  const visible = proposals.filter((pr) => pr.status !== "draft" && pr.status !== "pending");
  const groups = groupByJob(visible);

  return (
    <section id="estimates" className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-medium">Estimates</h2>
        <p className="text-sm text-muted-foreground">Grouped by the job they belong to.</p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No estimates on this house yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="space-y-2">
            <h3 className="text-sm tracking-wide text-muted-foreground uppercase">{group.label}</h3>
            <ul className="space-y-2">
              {group.items.map((pr) => {
                const current = pr.share_token === currentToken;
                return (
                  <li key={pr.id}>
                    <Link
                      to="/p/$token"
                      params={{ token: pr.share_token }}
                      className={cn(
                        "flex flex-col gap-2 rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between",
                        current && "ring-2 ring-ring",
                      )}
                    >
                      <div>
                        <p className="font-medium">{pr.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {pr.sent_at ? `Sent ${shortDate(pr.sent_at)}` : shortDate(pr.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={pr.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function groupByJob(proposals: ProposalListRow[]) {
  const order: string[] = [];
  const map = new Map<string, ProposalListRow[]>();
  for (const pr of proposals) {
    const label =
      TRADE_LABEL[pr.template_trade ?? ""] ??
      pr.template_name ??
      pr.title.split("—")[0]?.trim() ??
      "Other work";
    if (!map.has(label)) {
      order.push(label);
      map.set(label, []);
    }
    map.get(label)!.push(pr);
  }
  return order.map((label) => ({ label, items: map.get(label)! }));
}
