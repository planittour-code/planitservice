import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { FIELD_CATALOG } from "@/lib/housefile/fields";
import { cn } from "@/lib/utils";

export function AuthSlot({ signedInTo = "/app" }: { signedInTo?: "/app" | "/my" | "/home" | "/shop" }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-11 w-24 animate-pulse rounded-md bg-muted" />;
  if (user) {
    return (
      <Button asChild>
        <Link to="/account">Account</Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="outline">
      <Link
        to="/login"
        search={signedInTo === "/home" || signedInTo === "/my" ? { role: "homeowner", next: "/home" } : {}}
      >
        Sign in
      </Link>
    </Button>
  );
}

export function PublicHeader({
  children,
  compact = false,
  home = "/",
  path,
}: {
  children?: ReactNode;
  compact?: boolean;
  home?: "/" | "/shop";
  path?: "choose" | "homeowner" | "contractor";
}) {
  const lane = path ?? (home === "/shop" ? "contractor" : "choose");
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5",
          compact ? "max-w-3xl py-3" : "max-w-6xl py-3 sm:py-5",
        )}
      >
        <Wordmark to="/" />
        <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 sm:gap-2">
          {lane === "choose" && (
            <>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/homeowner">Homeowner</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/shop">Contractor</Link>
              </Button>
            </>
          )}
          {lane === "homeowner" && (
            <>
              <HeaderLink to="/homeowner">Start a record</HeaderLink>
              <HeaderLink to="/house/$token" params={{ token: "maple-14" }}>
                Sample record
              </HeaderLink>
              <HeaderLink to="/homeowner" hash="pricing" hideOnMobile>
                Pricing
              </HeaderLink>
              <HeaderLink to="/shop">For contractors</HeaderLink>
            </>
          )}
          {lane === "contractor" && (
            <>
              <HeaderLink to="/shop">Look up a house</HeaderLink>
              <HeaderLink to="/shop/open">Open a shop</HeaderLink>
              <HeaderLink to="/p/$token" params={{ token: "maple-paint-draft" }} hideOnMobile>
                Sample quote
              </HeaderLink>
              <HeaderLink to="/shop" hash="pricing" hideOnMobile>
                Pricing
              </HeaderLink>
              <HeaderLink to="/homeowner">For homeowners</HeaderLink>
            </>
          )}
          {children}
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({
  to,
  params,
  hash,
  hideOnMobile,
  children,
}: {
  to: string;
  params?: Record<string, string>;
  hash?: string;
  hideOnMobile?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      hash={hash}
      className={cn(
        "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        hideOnMobile && "hidden sm:inline-flex",
      )}
    >
      {children}
    </Link>
  );
}

export function PageFooter({ shop = false }: { shop?: boolean }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {shop
            ? "Know the house before you start talking."
            : "You start the record. You keep it."}{" "}
          <span className="text-muted-foreground/80">© {new Date().getFullYear()} PlanitService</span>
        </span>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          {shop ? (
            <>
              <Link to="/shop" className="hover:text-foreground">
                Look up a house
              </Link>
              <Link to="/shop/open" className="hover:text-foreground">
                Open a shop
              </Link>
              <Link to="/homeowner" className="hover:text-foreground">
                For homeowners
              </Link>
            </>
          ) : (
            <>
              <Link to="/homeowner" className="hover:text-foreground">
                Start a record
              </Link>
              <Link to="/shop" className="hover:text-foreground">
                For contractors
              </Link>
            </>
          )}
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link to="/saas" className="hover:text-foreground">
            SaaS
          </Link>
          <Link to="/aup" className="hover:text-foreground">
            AUP
          </Link>
          <Link to="/sla" className="hover:text-foreground">
            SLA
          </Link>
          <Link to="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export function WizardSteps({
  step,
  items,
}: {
  step: number;
  items: { n: number; label: string }[];
}) {
  return (
    <ol className="flex gap-2" aria-label="Quote steps">
      {items.map((item) => {
        const current = step === item.n;
        const done = step > item.n;
        return (
          <li
            key={item.n}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-2 text-sm",
              current && "bg-primary text-primary-foreground",
              done && "bg-muted text-foreground",
              !current && !done && "bg-card text-muted-foreground shadow-[var(--shadow-border)]",
            )}
            aria-current={current ? "step" : undefined}
          >
            <span className="tabular-nums">{item.n}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function FileNav({ homeowner = false }: { homeowner?: boolean }) {
  const links = homeowner
    ? [
        { href: "#estimates", label: "Estimates" },
        { href: "#rfps", label: "Requests" },
        { href: "#jobs", label: "Jobs" },
        { href: "#photos", label: "Photos" },
        { href: "#warranties", label: "Warranties" },
        { href: "#house-data", label: "House data" },
      ]
    : [
        { href: "#open", label: "Drafts" },
        { href: "#jobs", label: "Jobs" },
        { href: "#photos", label: "Photos" },
        { href: "#warranties", label: "Warranties" },
        { href: "#house-data", label: "House data" },
      ];
  return (
    <nav
      className="sticky top-16 z-20 -mx-5 overflow-x-auto border-y border-border bg-background/95 px-5 py-2 backdrop-blur-sm"
      aria-label="On this file"
    >
      <ul className="flex min-w-max gap-1">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function HouseCard({
  to,
  params,
  address,
  city,
  state,
  zip,
  name,
  coverSrc,
  factCount,
  jobCount,
  photoCount,
  openCount,
  footnote,
}: {
  to: string;
  params?: Record<string, string>;
  address: string;
  city: string;
  state: string;
  zip: string;
  name?: string;
  coverSrc: string | null;
  factCount: number;
  jobCount: number;
  photoCount: number;
  openCount?: number;
  footnote?: ReactNode;
}) {
  const total = FIELD_CATALOG.length;
  const pct = total ? Math.round((factCount / total) * 100) : 0;
  return (
    <Link
      to={to as never}
      params={params as never}
      className="block overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
    >
      <div className="aspect-[16/9] bg-muted">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center font-display text-3xl text-muted-foreground">
            {address.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div>
          <h2 className="font-display text-xl font-medium">{address}</h2>
          <p className="text-sm text-muted-foreground">
            {city}, {state} {zip}
            {name ? ` · ${name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="size-10 shrink-0 rounded-full"
            style={{
              background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-muted) 0)`,
            }}
            aria-hidden
          >
            <div className="grid size-full place-items-center p-1">
              <div className="grid size-full place-items-center rounded-full bg-card text-[11px] font-medium tabular-nums">
                {pct}%
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {jobCount} jobs · {photoCount} photos
            {openCount ? ` · ${openCount} open` : ""}
          </p>
        </div>
        {footnote}
      </div>
    </Link>
  );
}
