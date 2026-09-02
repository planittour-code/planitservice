import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { StreetView } from "@/components/street-view";
import { QuoteTypePicker } from "@/components/quote-type";
import { ShopExplainer, ShopSignupForm } from "@/components/shop-signup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAudience } from "@/lib/housefile/use-audience";
import { FIELD_CATALOG } from "@/lib/housefile/fields";
import { formatLine, houseNumber } from "@/lib/housefile/geocode";
import { captureQuoteLead, peekHouseByAddress, suggestAddresses } from "@/lib/housefile/server";
import type { AddressTease } from "@/lib/housefile/types";

const GHOST_FACTS = [
  { key: "year_built", label: "Year built", value: "—" },
  { key: "square_feet", label: "Finished square feet", value: "—" },
  { key: "stories", label: "Stories", value: "—" },
];

export function AddressLookup({ onTease }: { onTease?: (tease: AddressTease) => void }) {
  const navigate = useNavigate();
  const listId = useId();
  const blurTimer = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [listNav, setListNav] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const suggestions = useQuery({
    queryKey: ["address-suggest", debounced],
    queryFn: () => suggestAddresses({ data: debounced }),
    enabled: debounced.length >= 4,
    staleTime: 30_000,
  });
  const hits = suggestions.data ?? [];

  const lookup = useMutation({
    mutationFn: (q: string) => peekHouseByAddress({ data: q }),
    onSuccess: (tease) => {
      const formatted = formatLine(tease.address, tease.city, tease.state, tease.zip);
      const wanted = houseNumber(query);
      const got = houseNumber(tease.address);
      if (!wanted || !got || wanted === got) setQuery(formatted);
      setOpen(false);
      setListNav(false);
      if (tease.owned && tease.propertyId) {
        void navigate({ to: "/app/properties/$id", params: { id: tease.propertyId } });
        return;
      }
      onTease?.(tease);
    },
  });

  function run(q: string) {
    const next = q.trim();
    if (next.length < 3) return;
    lookup.mutate(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setListNav(false);
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setListNav(true);
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setListNav(true);
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter" && listNav && hits[active]) {
      e.preventDefault();
      run(hits[active]!.line);
    }
  }

  const showList = open && hits.length > 0 && !lookup.isPending;

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Job address</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
              setListNav(false);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKey}
            placeholder="Street, city, state"
            className="h-14 pl-11 text-lg"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md bg-card py-1 shadow-[var(--shadow-border-hover)]"
            >
              {hits.map((hit, i) => (
                <li key={hit.line} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    className={
                      i === active
                        ? "w-full px-3 py-2.5 text-left text-sm bg-muted"
                        : "w-full px-3 py-2.5 text-left text-sm hover:bg-muted"
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(hit.line)}
                  >
                    {hit.line}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <Button
          type="submit"
          size="lg"
          className="h-14 shrink-0 px-8 text-base"
          disabled={lookup.isPending || query.trim().length < 3}
        >
          {lookup.isPending ? "Looking up…" : "Look up"}
        </Button>
      </form>
      {lookup.isError && (
        <p className="text-sm text-muted-foreground">Could not look that up. Try the street name.</p>
      )}
    </>
  );
}

export function TeaseCard({ tease }: { tease: AddressTease }) {
  const { audience } = useAudience();
  const navigate = useNavigate();
  const payingShop = audience.kind === "contractor" && audience.paying;
  const facts = tease.found && tease.facts.length ? tease.facts : GHOST_FACTS;
  const place = [tease.city, tease.state, tease.zip].filter(Boolean).join(" ");

  function pickTrade(workId: string) {
    const search = quoteSearch(tease, workId);
    void captureQuoteLead({
      data: {
        address: tease.address,
        city: tease.city,
        state: tease.state,
        zip: tease.zip,
        workId,
        found: tease.found,
      },
    });
    void navigate({ to: "/app/new", search });
  }

  return (
    <aside className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <div className="relative">
        {tease.photo ? (
          <img src={tease.photo} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <StreetView
            lat={tease.lat}
            lng={tease.lng}
            address={tease.address}
            city={tease.city}
            state={tease.state}
            zip={tease.zip}
          />
        )}
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/50 px-4">
          <p className="font-display max-w-lg text-center text-[clamp(1.05rem,3.4vw,1.7rem)] font-semibold leading-tight text-balance text-primary-foreground">
            {tease.found
              ? `There are ${tease.factCount ?? tease.facts.length} of ${tease.totalCount ?? FIELD_CATALOG.length} details on the property record.`
              : "No information for this property on record."}
          </p>
        </div>
      </div>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {tease.found ? "A record is on file" : "No Property Record yet"}
          </p>
          <p className="font-display text-xl font-medium">{tease.address}</p>
          {place ? <p className="text-sm text-muted-foreground">{place}</p> : null}
        </div>

        {payingShop ? (
          <QuoteTypePicker
            onPick={pickTrade}
            title="Do you want to start an Estimate for this property?"
            hint="Pick the trade. This quote writes to the Property Record for the next shop that looks it up."
          />
        ) : (
          <div className="space-y-5">
            <ShopExplainer />
            <ShopSignupForm />
          </div>
        )}

        {tease.found && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {facts.map((f) => (
                <div key={f.key}>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">{f.label}</dt>
                  <dd className="font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
            {tease.jobs.length > 0 && (
              <ul className="space-y-1 text-sm">
                {tease.jobs.map((j) => (
                  <li key={j.title} className="flex justify-between gap-3">
                    <span>{j.title}</span>
                    <span className="text-muted-foreground">{j.year}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function quoteSearch(tease: AddressTease, workId: string) {
  return {
    work: workId,
    address: tease.address,
    city: tease.city || undefined,
    state: tease.state || undefined,
    zip: tease.zip || undefined,
  };
}

function quoteNext(search: {
  work: string;
  address: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  const q = new URLSearchParams();
  q.set("work", search.work);
  q.set("address", search.address);
  if (search.city) q.set("city", search.city);
  if (search.state) q.set("state", search.state);
  if (search.zip) q.set("zip", search.zip);
  return `/app/new?${q.toString()}`;
}
