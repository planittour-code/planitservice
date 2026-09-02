import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { PaidLanding } from "@/components/paid-landing";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_ANNUAL,
  PROPERTY_MONTHLY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";

export const Route = createFileRoute("/")({ component: HomeownerSite });

function HomeownerSite() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding prefer="homeowner" />
      <PublicHeader>
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <a href="#pricing">Pricing</a>
        </Button>
        <AuthSlot signedInTo="/home" />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/cover-hero.jpg"
            alt=""
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative mx-auto max-w-3xl space-y-6 px-4 py-16 text-center sm:px-5 md:py-24">
            <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">
              Use the same software as your contractor
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              The Property Record that belongs to you.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-primary-foreground/80">
              You do not need a contractor to begin. Open a Property Record. Put in the paint colors, the roof
              year, the filter size, the last time the gutters were cleaned. When you need work,
              request bids from shops. If the shop uses PlanitService, the job writes itself onto
              the same record — products, warranties, and what was done.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12 w-full sm:w-auto">
                <Link to="/start">Start a Property Record</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12 w-full border-0 bg-card text-foreground sm:w-auto"
              >
                <Link to="/house/$token" params={{ token: "maple-14" }}>
                  See a sample Property Record
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-12 text-center sm:px-5">
            <h2 className="font-display text-3xl font-medium tracking-tight">
              Stop hunting for the last receipt.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The next buyer will ask what is on the roof. The next painter will ask what color is
              on the trim. The next property manager will ask when the HVAC was serviced. That
              answer should live at the address — not in a text thread you already deleted.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Pillar
              kicker="Start it yourself"
              title="You own the Property Record from day one."
              body="Add the house. Write what you already know. Photos, products, warranties, the maintenance calendar. No shop has to invite you first."
            />
            <Pillar
              kicker="Ask for bids"
              title="Put the work in front of shops."
              body="Pro lets you write a request and send it to the market. Estimates come back against the house you already documented — not a clipboard on the lawn."
            />
            <Pillar
              kicker="Work writes in"
              title="A PlanitService shop fills the gaps."
              body="When you hire a contractor on PlanitService, the quote and the finished job land on your Property Record. You keep the history. They do not take it with them."
            />
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Pillar
              kicker="Share it"
              title="One link. The right people."
              body="Send the Property Record to a buyer, another contractor, or a property manager. They see the house. They do not get to keep the login."
            />
            <Pillar
              kicker="More than one house"
              title="Every property, one household."
              body="The place you live. The rental. A parent’s house. Each address is its own Property Record. You manage them from one account."
            />
            <Pillar
              kicker="It outlasts you"
              title="Hand the record on."
              body="Transfer the Property Record at sale or when the house passes on. The next owner starts with history instead of a blank house."
            />
          </div>
        </section>

        <section id="pricing" className="border-t border-border">
          <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 sm:px-5">
            <div className="mx-auto max-w-2xl space-y-3 text-center">
              <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
                Pay to keep the record. Not to start talking.
              </h2>
              <p className="text-muted-foreground">
                Standard is the Property Record you own and share. Pro adds bids and a property manager on the
                same record. Either way, you can begin before a contractor ever knocks.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <article className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8">
                <p className="text-sm tracking-wide text-muted-foreground uppercase">Standard</p>
                <p className="mt-3 font-display text-5xl font-medium tracking-tight">
                  ${dollars(PROPERTY_MONTHLY)}
                  <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">
                    / month / property
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  or ${dollars(PROPERTY_ANNUAL)} a year per property
                </p>
                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li>Build the Property Record yourself — jobs, photos, products, warranties</li>
                  <li>Keep maintenance in one place</li>
                  <li>Share a link with buyers or contractors</li>
                  <li>Transfer the record at sale or when the house passes on</li>
                </ul>
                <Button asChild className="mt-8 min-h-12 w-full">
                  <Link to="/start" search={{ tier: "standard" }}>
                    Start Standard
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Then pick monthly or pay ${dollars(PROPERTY_ANNUAL)} for the year
                </p>
              </article>
              <article className="rounded-xl bg-primary p-6 text-primary-foreground shadow-[var(--shadow-border)] sm:p-8">
                <p className="text-sm tracking-wide uppercase opacity-80">Pro</p>
                <p className="mt-3 font-display text-5xl font-medium tracking-tight">
                  ${dollars(PRO_MONTHLY)}
                  <span className="ml-2 text-lg font-sans font-normal opacity-80">
                    / month / property
                  </span>
                </p>
                <p className="mt-2 text-sm opacity-80">or ${dollars(PRO_ANNUAL)} a year per property</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li>Everything in Standard</li>
                  <li>Request bids and put the job on the market</li>
                  <li>Let a property manager see the Property Record and the bids</li>
                </ul>
                <Button
                  asChild
                  className="mt-8 min-h-12 w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link to="/start" search={{ tier: "pro" }}>
                    Start Pro
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs opacity-80">
                  Then pick monthly or pay ${dollars(PRO_ANNUAL)} for the year
                </p>
              </article>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}

function Pillar({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">{kicker}</p>
      <h2 className="font-display text-2xl font-medium tracking-tight">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
