import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { AuthSlot, PageFooter, PublicHeader, SignInCta } from "@/components/site-chrome";
import { PaidLanding } from "@/components/paid-landing";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  MANAGE_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { useAudience } from "@/lib/housefile/use-audience";

export const Route = createFileRoute("/manage")({ component: ManageFrame });

function ManageFrame() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const { audience, isPending: audiencePending } = useAudience();
  const authReady = !isPending && !(user && audiencePending);

  if (pathname === "/manage/open") return <Outlet />;

  if (authReady && audience.hats.manager) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
            <Wordmark to="/manage" />
            <nav className="ml-auto flex items-center gap-1">
              <Link
                to="/manage"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
                activeOptions={{ exact: true }}
              >
                Houses
              </Link>
              <Link
                to="/manage/add"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Add a house
              </Link>
              <Link
                to="/manage/settings"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
              >
                Office
              </Link>
              <Button asChild size="sm">
                <Link to="/manage/add">New record</Link>
              </Button>
              <UserButton />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-8">
          <Outlet />
        </div>
      </div>
    );
  }

  if (pathname !== "/manage") {
    if (!authReady) {
      return (
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-5xl px-5 py-6">
            <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
      );
    }
    return <Navigate to="/manage/open" />;
  }

  return <ManageMarketing />;
}

function ManageMarketing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding prefer="manager" />
      <PublicHeader path="manager">
        <AuthSlot signedInTo="/manage" />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/cover-hero.jpg"
            alt=""
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/60" />
          <div className="relative mx-auto max-w-3xl space-y-6 px-4 py-16 text-center sm:px-5 md:py-24">
            <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">
              For property managers
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              One record for every house you manage.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-primary-foreground/80">
              Photos, jobs, warranties, and issued estimates at the address. You keep the file.
              Shops still quote in their shop. The homeowner can claim it later.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/manage/open">Open a portfolio</Link>
              </Button>
              <SignInCta
                signedInTo="/manage"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Step
              n="1"
              title="The address is the file."
              body="Add the houses you manage. Each one is a Property Record — not a second set of books."
            />
            <Step
              n="2"
              title="The work stays on the house."
              body="Photos, products, warranties, and maintenance live at the address. Issued estimates from shops show up when they send them."
            />
            <Step
              n="3"
              title="You are not a shop."
              body="No catalog. No quoting. The file is the product. Ten houses on the base, then a bulk rate for the rest."
            />
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-medium tracking-tight">
                A portfolio, not ten homeowner plans.
              </h2>
              <p className="text-muted-foreground">
                Ten Standard houses would be billed one-by-one. The portfolio is one login, one
                subscription, and the records you already walk.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{MANAGE_INCLUDED} Property Records on the base plan</li>
                <li>Extra houses ${dollars(MANAGE_EXTRA_MONTHLY)} / month each</li>
                <li>No materials catalog. No quote wizard.</li>
              </ul>
            </div>
            <div className="rounded-xl bg-primary p-6 text-primary-foreground shadow-[var(--shadow-border)] sm:p-8">
              <p className="text-sm tracking-wide uppercase opacity-80">The portfolio</p>
              <p className="mt-3 font-display text-5xl font-medium tracking-tight">
                ${dollars(MANAGE_MONTHLY)}
                <span className="ml-2 text-lg font-sans font-normal opacity-80">/ month</span>
              </p>
              <p className="mt-2 text-sm opacity-80">
                or ${dollars(MANAGE_ANNUAL)} a year. {MANAGE_INCLUDED} houses included.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li>Search the portfolio by address or owner</li>
                <li>Open the Property Record — photos, jobs, warranties</li>
                <li>See estimates shops have already issued</li>
                <li>Add house {MANAGE_INCLUDED + 1}+ at the bulk rate</li>
              </ul>
              <div className="mt-8 space-y-3">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link to="/manage/open">Open a portfolio</Link>
                </Button>
                <SignInCta
                  signedInTo="/manage"
                  className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                />
              </div>
              <p className="mt-3 text-center text-xs opacity-80">
                Extra houses ${dollars(MANAGE_EXTRA_MONTHLY)}/month or billed yearly.
              </p>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">Step {n}</p>
      <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
