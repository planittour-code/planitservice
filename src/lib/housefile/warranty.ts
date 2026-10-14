import { jobWorkType, WORK_BY_ID, canonicalTradeId, type WorkType } from "./quote";
import type { JobSpec, JobWithSpecs, ProposalListRow, WarrantyRecord } from "./types";

export const WARRANTY_COVERAGE = [
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "both", label: "Materials and labor" },
  { value: "lifetime", label: "Lifetime" },
] as const;

export type WarrantyCoverage = (typeof WARRANTY_COVERAGE)[number]["value"];

export function tradeMatchesWork(work: WorkType, tradeId: string) {
  const want = canonicalTradeId(tradeId).toLowerCase();
  if (!want) return false;
  return (
    canonicalTradeId(work.id).toLowerCase() === want ||
    work.trade.toLowerCase() === want ||
    work.name.toLowerCase() === want
  );
}

export function jobsForTrade(jobs: JobWithSpecs[], tradeId: string) {
  return jobs.filter((job) => {
    const work = jobWorkType(job);
    return work ? tradeMatchesWork(work, tradeId) : false;
  });
}

export function proposalsForTrade<
  T extends { title: string; template_trade?: string | null },
>(proposals: T[], tradeId: string) {
  const work = WORK_BY_ID[canonicalTradeId(tradeId)];
  const want = canonicalTradeId(tradeId).toLowerCase();
  const name = work?.name.toLowerCase() ?? want;
  const singular = name.endsWith("s") ? name.slice(0, -1) : name;
  return proposals.filter((p) => {
    const trade = canonicalTradeId(p.template_trade || "").toLowerCase();
    if (trade && trade === want) return true;
    const title = p.title.toLowerCase();
    return Boolean(name) && (title.includes(name) || (singular.length > 3 && title.includes(singular)));
  });
}

export function pickProposalIdForTrade(
  jobs: JobWithSpecs[],
  proposals: Array<Pick<ProposalListRow, "id" | "title" | "status" | "created_at" | "template_trade">>,
  tradeId: string,
): string | null {
  const byId = new Map(proposals.map((p) => [p.id, p]));
  for (const job of jobsForTrade(jobs, tradeId)) {
    if (job.proposal_id && byId.has(job.proposal_id)) return job.proposal_id;
  }
  const rank = (status: string) =>
    status === "accepted" || status === "completed" ? 0 : status === "sent" || status === "revised" ? 1 : 2;
  const ranked = proposalsForTrade(proposals, tradeId).slice().sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus) return byStatus;
    return b.created_at.localeCompare(a.created_at);
  });
  return ranked[0]?.id ?? null;
}

export function inheritedWarrantyItems(jobs: JobWithSpecs[], tradeId?: string) {
  const source = tradeId ? jobsForTrade(jobs, tradeId) : jobs;
  const items: (JobSpec & { jobTitle: string; completed: string; tradeId: string | null })[] = [];
  for (const job of source) {
    const work = jobWorkType(job);
    for (const spec of job.specs) {
      if (!spec.warranty_terms && !spec.warranty_years) continue;
      items.push({
        ...spec,
        jobTitle: job.title,
        completed: job.completed_at,
        tradeId: work?.id ?? null,
      });
    }
  }
  return items;
}

export function warrantiesForTrade(rows: WarrantyRecord[], tradeId: string) {
  const want = canonicalTradeId(tradeId).toLowerCase();
  return rows.filter((row) => canonicalTradeId(row.trade_id).toLowerCase() === want);
}

export function warrantyExpiry(installedOn: string | null | undefined, years: number | null | undefined) {
  if (!installedOn || years == null || years <= 0) return null;
  const d = new Date(`${installedOn}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

