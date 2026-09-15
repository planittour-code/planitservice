import { useNavigate } from "@tanstack/react-router";
import { Briefcase, Home, Search, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { shortDate } from "@/lib/housefile/format";
import type { PortfolioHouse, PortfolioOwner, PortfolioUpcoming } from "@/lib/housefile/types";
import { cn } from "@/lib/utils";

type HitKind = "house" | "job" | "client";

type Hit = {
  key: string;
  kind: HitKind;
  title: string;
  detail: string;
  propertyId: string;
  score: number;
};

const KIND_ORDER: HitKind[] = ["house", "job", "client"];
const KIND_LABEL: Record<HitKind, string> = {
  house: "Houses",
  job: "Jobs",
  client: "Clients",
};

function scoreHay(hay: string, needle: string) {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  if (!n || !h) return 0;
  if (h.startsWith(n)) return 4;
  if (h.includes(` ${n}`) || h.includes(`, ${n}`)) return 3;
  const idx = h.indexOf(n);
  if (idx < 0) return 0;
  return idx < 8 ? 2 : 1;
}

function takeHits(list: Hit[], cap: number) {
  return list
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, cap);
}

export function PortfolioLookup({
  houses,
  owners,
  upcoming,
}: {
  houses: PortfolioHouse[];
  owners: PortfolioOwner[];
  upcoming: PortfolioUpcoming[];
}) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const needle = q.trim();

  const hits = useMemo(() => {
    if (needle.length < 1) return [] as Hit[];
    const houseHits = takeHits(
      houses.map((h) => {
        const hay = `${h.address_line} ${h.city} ${h.state} ${h.zip} ${h.homeowner_name ?? ""}`;
        return {
          key: `house:${h.id}`,
          kind: "house" as const,
          title: h.address_line,
          detail: [h.city, h.state, h.zip].filter(Boolean).join(" ") + (h.homeowner_name ? ` · ${h.homeowner_name}` : ""),
          propertyId: h.id,
          score: scoreHay(hay, needle),
        };
      }),
      6,
    );

    const jobSeen = new Set<string>();
    const jobs: Hit[] = [];
    function addJob(id: string, title: string, hay: string, detail: string, propertyId: string) {
      if (jobSeen.has(id)) return;
      jobSeen.add(id);
      const score = scoreHay(`${title} ${hay}`, needle);
      if (!score) return;
      jobs.push({ key: `job:${id}`, kind: "job", title, detail, propertyId, score });
    }
    for (const item of upcoming) {
      addJob(
        item.id,
        item.title,
        `${item.address_line} ${item.homeowner_name} ${item.system_name}`,
        `${item.address_line} · ${item.scheduled_on ? `scheduled ${shortDate(item.scheduled_on)}` : `due ${shortDate(item.due_on)}`}`,
        item.property_id,
      );
    }
    for (const h of houses) {
      if (h.nextTask) {
        addJob(
          h.nextTask.id,
          h.nextTask.title,
          `${h.address_line} ${h.homeowner_name ?? ""}`,
          `${h.address_line} · ${h.nextTask.scheduled_on ? `scheduled ${shortDate(h.nextTask.scheduled_on)}` : `due ${shortDate(h.nextTask.due_on)}`}`,
          h.id,
        );
      }
      if (h.open_title) {
        addJob(`open:${h.id}`, h.open_title, `${h.address_line} ${h.homeowner_name ?? ""}`, `${h.address_line} · open estimate`, h.id);
      }
      for (const est of h.acceptedEstimates ?? []) {
        addJob(est.id, est.title, `${est.address_line} ${est.homeowner_name} ${est.company_name}`, `${est.address_line} · agreed ${shortDate(est.accepted_at)}`, h.id);
      }
    }

    const clientHits = takeHits(
      owners.map((o) => {
        const first = o.houses[0];
        const hay = `${o.name} ${o.email} ${o.houses.map((h) => h.address_line).join(" ")}`;
        return {
          key: `client:${o.key}`,
          kind: "client" as const,
          title: o.name,
          detail:
            [o.email, `${o.houses.length} ${o.houses.length === 1 ? "house" : "houses"}`].filter(Boolean).join(" · "),
          propertyId: first?.id ?? "",
          score: scoreHay(hay, needle),
        };
      }),
      6,
    ).filter((h) => h.propertyId);

    const ranked = [...houseHits, ...takeHits(jobs, 6), ...clientHits].sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || b.score - a.score,
    );
    return ranked.slice(0, 12);
  }, [houses, owners, upcoming, needle]);

  useEffect(() => {
    setActive(0);
  }, [needle]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    void navigate({ to: "/manage/$id", params: { id: hit.propertyId } });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter") && hits.length) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const hit = hits[active];
      if (hit) {
        e.preventDefault();
        go(hit);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const groups = KIND_ORDER.map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind) })).filter(
    (g) => g.items.length > 0,
  );
  const show = open && needle.length > 0;

  return (
    <div ref={root} className="relative min-w-0 w-full lg:max-w-sm lg:flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Find a house, job, or client"
        aria-label="Find a house, job, or client"
        aria-autocomplete="list"
        aria-expanded={show}
        className="pl-9"
        autoComplete="off"
      />
      {show ? (
        <div className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl bg-card py-1 shadow-[var(--shadow-border-hover)]">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No houses, jobs, or clients match.</p>
          ) : (
            groups.map((group) => (
              <div key={group.kind} className="py-1">
                <p className="px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {KIND_LABEL[group.kind]}
                </p>
                <ul>
                  {group.items.map((hit) => {
                    const i = hits.indexOf(hit);
                    return (
                      <li key={hit.key}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(hit)}
                          className={cn(
                            "flex w-full min-h-11 items-start gap-2 px-3 py-2 text-left",
                            i === active ? "bg-muted" : "hover:bg-muted/60",
                          )}
                        >
                          <KindIcon kind={hit.kind} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{hit.title}</span>
                            <span className="block truncate text-sm text-muted-foreground">{hit.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function KindIcon({ kind }: { kind: HitKind }) {
  const Icon = kind === "house" ? Home : kind === "job" ? Briefcase : User;
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />;
}
