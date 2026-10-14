import assert from "node:assert/strict";
import test from "node:test";

const TRADE_ALIASES = { porch: "deck", porches: "deck", decks: "deck" };

function canonicalTradeId(id) {
  const key = id.trim().toLowerCase();
  return TRADE_ALIASES[key] ?? id.trim();
}

function jobWorkType(job, types) {
  const hay = `${job.title} ${job.summary ?? ""} ${job.specs.map((s) => s.label).join(" ")}`.toLowerCase();
  return types.find((w) => {
    const name = w.name.toLowerCase();
    const trade = w.trade.toLowerCase();
    const singular = name.endsWith("s") ? name.slice(0, -1) : name;
    return hay.includes(name) || hay.includes(singular) || hay.includes(trade);
  });
}

function jobsForTrade(jobs, tradeId, types) {
  return jobs.filter((job) => {
    const work = jobWorkType(job, types);
    if (!work) return false;
    const want = canonicalTradeId(tradeId).toLowerCase();
    return canonicalTradeId(work.id).toLowerCase() === want || work.trade.toLowerCase() === want;
  });
}

function proposalsForTrade(proposals, tradeId, work) {
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

function pickProposalIdForTrade(jobs, proposals, tradeId, types) {
  const byId = new Map(proposals.map((p) => [p.id, p]));
  for (const job of jobsForTrade(jobs, tradeId, types)) {
    if (job.proposal_id && byId.has(job.proposal_id)) return job.proposal_id;
  }
  const ranked = proposalsForTrade(proposals, tradeId, types.find((t) => t.id === tradeId));
  return ranked[0]?.id ?? null;
}

function warrantyExpiry(installedOn, years) {
  if (!installedOn || years == null || years <= 0) return null;
  const d = new Date(`${installedOn}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TYPES = [
  { id: "gutters", trade: "gutters", name: "Gutters" },
  { id: "paint", trade: "paint", name: "Paint" },
];

test("gutters job maps to gutters trade and its invoice", () => {
  const jobs = [
    {
      id: "j1",
      title: "6-inch K-style gutters",
      summary: "Heritage Cream over the porch",
      proposal_id: "p-gutter",
      specs: [{ label: "Gutter run" }],
    },
  ];
  const proposals = [
    { id: "p-paint", title: "Interior walls", template_trade: "paint" },
    { id: "p-gutter", title: "Gutters — 6 inch", template_trade: "gutters" },
  ];
  assert.equal(jobsForTrade(jobs, "gutters", TYPES)[0]?.id, "j1");
  assert.equal(pickProposalIdForTrade(jobs, proposals, "gutters", TYPES), "p-gutter");
  assert.equal(pickProposalIdForTrade(jobs, proposals, "paint", TYPES), "p-paint");
});

test("warranty expiry adds years to install date", () => {
  assert.equal(warrantyExpiry("2026-03-09", 20), "2046-03-09");
  assert.equal(warrantyExpiry(null, 20), null);
});
