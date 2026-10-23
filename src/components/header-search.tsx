import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import {
  hitFromValue,
  hitValue,
  isFocusShortcut,
  isSlashShortcut,
  looksLikeAddress,
  newEstimateUrl,
  opensPreview,
  previewUrl,
  type RecentHit,
  readRecents,
  recentsOrFallback,
  recordRecent,
  SEARCH_DEBOUNCE_MS,
  searchChips,
  searchUrl,
  TYPE_LABEL,
} from "@/lib/housefile/search-ui";

type Hit = {
  type: string;
  id: string;
  property_id: string | null;
  label: string;
  sublabel: string;
  url: string;
  match: string;
};

type Preview = {
  property: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    zip: string;
    homeowner_name: string;
    homeowner_email: string;
    homeowner_phone: string | null;
  };
  open_estimates: { id: string; title: string; status: string; created_at: string }[];
  recent_jobs: { id: string; title: string; completed_at: string }[];
  open_work_orders: null | unknown[];
  unpaid_invoices: null | unknown[];
  last_activity_at: string | null;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", signal });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

/**
 * Header search box (Sprint 1 #3). One component for /app, /manage and /home;
 * the API decides scope from the session, so HO sees only their own houses.
 * `surface="shop"` adds the "New estimate at this address" no-results action.
 */
export function HeaderSearch({
  surface,
  tenant,
  className,
}: {
  surface: "shop" | "manage" | "home";
  /** Recents are stored per tenant + user (e.g. the shop's company id). */
  tenant?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const userId = user?.id ?? "";
  const tenantKey = tenant || surface;
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [opened, setOpened] = useState<RecentHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("all");
  const [active, setActive] = useState("");
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const debounced = useDebounced(q, SEARCH_DEBOUNCE_MS);
  const chips = searchChips();
  const type = chips.find((c) => c.key === chip)?.type ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isFocusShortcut(e) || isSlashShortcut(e)) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const results = useQuery({
    queryKey: ["header-search", debounced.trim(), type],
    queryFn: ({ signal }) => getJson<{ hits: Hit[] }>(searchUrl(debounced, type), signal),
    enabled: open,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
  // Re-read on open so visits from other tabs / pages show up.
  useEffect(() => {
    if (open) setOpened(readRecents(storage, tenantKey, userId));
  }, [open, storage, tenantKey, userId]);
  const apiHits = results.data?.hits ?? [];
  const emptyQuery = !debounced.trim();
  const hits: Hit[] = emptyQuery && !type
    ? recentsOrFallback(opened, apiHits).map((h) => ({ match: "recent", ...h }))
    : apiHits;
  const activeHit = hitFromValue(hits, active);
  const previewProperty = previewFor
    ? (hitFromValue(hits, previewFor)?.property_id ?? null)
    : null;

  const preview = useQuery({
    queryKey: ["header-search-preview", previewProperty],
    queryFn: ({ signal }) => getJson<{ preview: Preview }>(previewUrl(previewProperty ?? ""), signal),
    enabled: open && Boolean(previewProperty),
    staleTime: 30_000,
  });

  // A new highlight closes a stale preview.
  useEffect(() => {
    if (previewFor && previewFor !== active) setPreviewFor(null);
  }, [active, previewFor]);

  const close = () => {
    setOpen(false);
    setPreviewFor(null);
    inputRef.current?.blur();
  };
  const go = (url: string, hit?: Hit) => {
    if (hit) setOpened(recordRecent(storage, tenantKey, userId, hit));
    close();
    setQ("");
    void navigate({ to: url });
  };

  const showNewEstimate = surface === "shop" && hits.length === 0 && debounced.trim().length > 0 && !results.isFetching;

  return (
    <div ref={rootRef} className={cn("relative w-full sm:w-72", className)}>
      <Command
        shouldFilter={false}
        loop
        value={active}
        onValueChange={setActive}
        label="Search"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            if (previewFor) setPreviewFor(null);
            else close();
          } else if (e.key === "ArrowLeft" && previewFor) {
            e.preventDefault();
            setPreviewFor(null);
          } else if (
            activeHit?.property_id &&
            opensPreview(e, inputRef.current?.selectionStart ?? null, q.length)
          ) {
            e.preventDefault();
            setPreviewFor(active);
          }
        }}
      >
        <Command.Input
          ref={inputRef}
          value={q}
          onValueChange={(v) => {
            setQ(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search address, name, phone…  ⌘K"
          aria-label="Search"
          className="h-8 w-full rounded-md border border-white/20 bg-white/10 px-2.5 text-sm text-secondary-foreground placeholder:text-secondary-foreground/60 focus:bg-white focus:text-foreground focus:outline-none"
        />
        {open && (
          <div className="absolute right-0 top-9 z-[60] flex max-h-[min(70vh,32rem)] w-[min(calc(100vw-1.5rem),40rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1 border-b p-2" role="radiogroup" aria-label="Filter by type">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={chip === c.key}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setChip(c.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      chip === c.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <Command.List className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain p-1">
                {results.isError && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Search is unavailable right now.</div>
                )}
                {!debounced.trim() && hits.length > 0 && (
                  <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Recent</div>
                )}
                {hits.map((h) => (
                  <Command.Item
                    key={hitValue(h)}
                    value={hitValue(h)}
                    onSelect={() => go(h.url, h)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[selected=true]:bg-muted"
                  >
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">{TYPE_LABEL[h.type] ?? h.type}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{h.label}</span>
                      {h.sublabel && <span className="block truncate text-xs text-muted-foreground">{h.sublabel}</span>}
                    </span>
                    {h.property_id && <span className="text-xs text-muted-foreground" aria-hidden>→</span>}
                  </Command.Item>
                ))}
                {!results.isError && debounced.trim() && hits.length === 0 && !results.isFetching && (
                  <Command.Empty className="px-2 py-3 text-sm text-muted-foreground">No matches.</Command.Empty>
                )}
                {showNewEstimate && (
                  <Command.Item
                    value="__new_estimate"
                    onSelect={() => go(newEstimateUrl(looksLikeAddress(debounced) ? debounced : ""))}
                    className="cursor-pointer rounded-md px-2 py-1.5 text-sm font-medium data-[selected=true]:bg-muted"
                  >
                    {looksLikeAddress(debounced) ? `New estimate at “${debounced.trim()}”` : "New estimate"}
                  </Command.Item>
                )}
              </Command.List>
              <div className="border-t px-2 py-1 text-[11px] text-muted-foreground">
                ↑↓ move · Enter open · → preview · Esc close
              </div>
            </div>
            {previewFor && (
              <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-muted sm:block p-3 text-sm" aria-label="Preview">
                {preview.isPending && <div className="text-muted-foreground">Loading…</div>}
                {preview.isError && <div className="text-muted-foreground">No preview.</div>}
                {preview.data && <PreviewPanel p={preview.data.preview} />}
              </aside>
            )}
          </div>
        )}
      </Command>
    </div>
  );
}

function PreviewPanel({ p }: { p: Preview }) {
  const pr = p.property;
  return (
    <div className="space-y-2">
      <div>
        <div className="font-medium">{pr.address_line}</div>
        <div className="text-xs text-muted-foreground">
          {[pr.city, pr.state, pr.zip].filter(Boolean).join(", ")}
        </div>
      </div>
      <div className="text-xs">
        <div>{pr.homeowner_name || "—"}</div>
        {pr.homeowner_email && <div className="text-muted-foreground">{pr.homeowner_email}</div>}
        {pr.homeowner_phone && <div className="text-muted-foreground">{pr.homeowner_phone}</div>}
      </div>
      <Section title="Open estimates" empty="None open">
        {p.open_estimates.map((e) => (
          <li key={e.id} className="truncate">
            {e.title} <span className="text-muted-foreground">· {e.status}</span>
          </li>
        ))}
      </Section>
      <Section title="Recent jobs" empty="No jobs yet">
        {p.recent_jobs.map((j) => (
          <li key={j.id} className="truncate">
            {j.title} <span className="text-muted-foreground">· {shortDate(j.completed_at)}</span>
          </li>
        ))}
      </Section>
      {p.open_work_orders && (
        <Section title="Open work orders" empty="None open">{null}</Section>
      )}
      {p.unpaid_invoices && (
        <Section title="Unpaid invoices" empty="None unpaid">{null}</Section>
      )}
      <div className="text-xs text-muted-foreground">Last activity {shortDate(p.last_activity_at)}</div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = Array.isArray(children) ? children : children ? [children] : [];
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {items.length ? <ul className="text-xs">{items}</ul> : <div className="text-xs text-muted-foreground">{empty}</div>}
    </div>
  );
}
