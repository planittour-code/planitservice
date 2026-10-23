/**
 * Pure helpers for the header search box (Sprint 1 #3). No React, no "@/"
 * imports, so scripts/search-ui.test.mjs can load it with plain Node.
 */

/** Chips shown in the box. `type` is the /api/search type param; null = all. */
export type SearchChip = { key: string; label: string; type: string | null };

/**
 * AC 3.2 lists Properties, Estimates, Jobs, Work orders, Invoices. The API
 * only indexes property / proposal / job / person today; Work orders
 * (feat/work-orders) and Invoices (#5) get chips once /api/search supports
 * them — add their type to `supported` and they appear.
 */
export const ALL_CHIPS: SearchChip[] = [
  { key: "all", label: "All", type: null },
  { key: "property", label: "Properties", type: "property" },
  { key: "proposal", label: "Estimates", type: "proposal" },
  { key: "job", label: "Jobs", type: "job" },
  { key: "person", label: "People", type: "person" },
  { key: "work_order", label: "Work orders", type: "work_order" },
  { key: "invoice", label: "Invoices", type: "invoice" },
];

export const API_TYPES = ["property", "proposal", "job", "person"] as const;

export function searchChips(supported: readonly string[] = API_TYPES): SearchChip[] {
  return ALL_CHIPS.filter((c) => c.type === null || supported.includes(c.type));
}

export const SEARCH_DEBOUNCE_MS = 150;

export function searchUrl(q: string, type: string | null): string {
  const p = new URLSearchParams();
  p.set("q", q.trim());
  if (type) p.set("type", type);
  return `/api/search?${p.toString()}`;
}

export function previewUrl(propertyId: string): string {
  return `/api/search-preview?property_id=${encodeURIComponent(propertyId)}`;
}

type KeyLike = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

/** Cmd-K (mac) / Ctrl-K (elsewhere) focuses the box from anywhere (AC 3.2). */
export function isFocusShortcut(e: KeyLike): boolean {
  return e.key.toLowerCase() === "k" && Boolean(e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
}

/**
 * Right-arrow opens the preview only when the caret is at the end of the
 * query, so it still moves the caret while editing (AC 3.3).
 */
export function opensPreview(e: KeyLike, caret: number | null, queryLength: number): boolean {
  return e.key === "ArrowRight" && !e.metaKey && !e.ctrlKey && (caret == null || caret >= queryLength);
}

/** cmdk item value: unique per hit, so the highlighted value maps back to it. */
export function hitValue(hit: { type: string; id: string }): string {
  return `${hit.type}:${hit.id}`;
}

export function hitFromValue<T extends { type: string; id: string }>(hits: T[], value: string): T | null {
  return hits.find((h) => hitValue(h) === value) ?? null;
}

/** AC 3.4: the shop no-results action, through the existing quote flow. */
export function newEstimateUrl(q: string): string {
  const address = q.trim();
  return address ? `/app/new?address=${encodeURIComponent(address)}` : "/app/new";
}

/** A query worth offering "New estimate at this address" for: starts with a house number. */
export function looksLikeAddress(q: string): boolean {
  return /^\s*\d+[a-z]?\s+\p{L}/iu.test(q);
}

export const TYPE_LABEL: Record<string, string> = {
  property: "Property",
  proposal: "Estimate",
  job: "Job",
  person: "Person",
  work_order: "Work order",
  invoice: "Invoice",
};

/** Focus is somewhere typing happens: "/" must not hijack it there. */
type TargetLike = { tagName?: string; isContentEditable?: boolean } | null | undefined;
export function isTypingTarget(t: TargetLike): boolean {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = (t.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** "/" opens search, unless the user is typing in a field or holding a modifier. */
export function isSlashShortcut(e: KeyLike & { target?: unknown }): boolean {
  return (
    e.key === "/" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !isTypingTarget(e.target as TargetLike)
  );
}

// ---- Recently opened records (localStorage, per tenant + user) ----

export const RECENT_MAX = 8;

export type RecentHit = {
  type: string;
  id: string;
  property_id: string | null;
  label: string;
  sublabel: string;
  url: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function recentKey(tenant: string, userId: string): string {
  return `planit.search.recent.v1:${tenant}:${userId}`;
}

function isRecent(v: unknown): v is RecentHit {
  const r = v as RecentHit;
  return Boolean(r) && typeof r.type === "string" && typeof r.id === "string" &&
    typeof r.url === "string" && r.url.startsWith("/") && typeof r.label === "string";
}

export function readRecents(storage: StorageLike | null | undefined, tenant: string, userId: string): RecentHit[] {
  if (!storage || !userId) return [];
  try {
    const raw = JSON.parse(storage.getItem(recentKey(tenant, userId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isRecent).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Pure: put `hit` first, drop older copies of the same record, cap at RECENT_MAX. */
export function pushRecent(list: RecentHit[], hit: RecentHit): RecentHit[] {
  const clean: RecentHit = {
    type: hit.type,
    id: hit.id,
    property_id: hit.property_id ?? null,
    label: hit.label,
    sublabel: hit.sublabel ?? "",
    url: hit.url,
  };
  return [clean, ...list.filter((h) => !(h.type === hit.type && h.id === hit.id))].slice(0, RECENT_MAX);
}

export function recordRecent(
  storage: StorageLike | null | undefined,
  tenant: string,
  userId: string,
  hit: RecentHit,
): RecentHit[] {
  if (!storage || !userId || !isRecent(hit)) return [];
  const next = pushRecent(readRecents(storage, tenant, userId), hit);
  try {
    storage.setItem(recentKey(tenant, userId), JSON.stringify(next));
  } catch {
    // Quota / private mode: recents are best-effort.
  }
  return next;
}

/** Empty query: opened records first; if none, the API's recently updated ones. */
export function recentsOrFallback<T>(opened: RecentHit[], apiRecent: T[]): (RecentHit | T)[] {
  return opened.length ? opened : apiRecent;
}
