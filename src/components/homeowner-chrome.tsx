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
  flooring: "Flooring",
  drainage: "Drainage",
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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md bg-white px-2 py-1 text-[#0b3a6a] shadow-[var(--shadow-border)]"
        >
          <Mark className="size-10 bg-white" />
          <span className="font-display text-lg font-semibold tracking-tight">
            PlanitService
          </span>
        </Link>
        <p className="hidden text-sm font-medium text-secondary-foreground/80 sm:block">{company}</p>
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto border-t border-white/10 px-4 py-1 sm:px-6" aria-label="For the homeowner">
        {estimateToken ? (
          <NavItem to="/p/$token" params={{ token: estimateToken }} label="This estimate" />
        ) : null}
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="estimates" label="Estimates" />
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="rfps" label="Requests" />
        <NavItem to="/house/$token" params={{ token: houseToken }} hash="file" label="The Property Record" />
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
      className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-secondary-foreground/85 hover:bg-white/10 hover:text-secondary-foreground [&.active]:bg-white/12 [&.active]:text-secondary-foreground"
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
    <section id="estimates" className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold">Estimates</h2>
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
