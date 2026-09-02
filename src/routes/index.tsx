import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
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
          <div className="relative mx-auto max-w-3xl space-y-6 px-5 py-16 text-center md:py-24">
            <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">
              Use the same software as your contractor
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              The service history of the house you live in.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-primary-foreground/80">
              When a Contractor provides you a quote, PlanitService can add the details to a record
              for your home. You can keep the jobs, products, warranties, and the maintenance
              details across every property you own. This record can be shared with potential
              Buyers, other Contractors, or even a Property Manager.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/home/add">Start a house record</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-0 bg-card text-foreground">
                <Link to="/house/$token" params={{ token: "maple-14" }}>
                  See a sample File
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
            <Pillar
              kicker="The record"
              title="What was done, and with what."
              body="Colors, shingles, filters, warranties. Written when the shop quotes — kept at the address, not in a drawer."
            />
            <Pillar
              kicker="The upkeep"
              title="Maintenance across every property."
              body="Filters, gutters, alarms, the water heater. Due dates live on the File. One household. One to many houses."
            />
            <Pillar
              kicker="The handoff"
              title="The File survives the owner."
              body="Share a link. Transfer the record at sale or at death. The next owner starts with history, not a blank house."
            />
          </div>
        </section>

        <section id="pricing" className="border-t border-border">
          <div className="mx-auto max-w-6xl space-y-10 px-5 py-16">
            <div className="mx-auto max-w-2xl text-center space-y-3">
              <h2 className="font-display text-3xl font-medium tracking-tight md:text-4xl">
                Pay for the house, not the clutter.
              </h2>
              <p className="text-muted-foreground">
                Each property is its own File. Add a vacation house, a rental, a parent’s place.
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
                  <li>Build the House File — jobs, photos, products, warranties</li>
                  <li>Share the details with a link</li>
                  <li>Transfer the record at sale or at death</li>
                </ul>
                <Button asChild className="mt-8 w-full">
                  <Link to="/home/add">Start Standard</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  <Link
                    to="/home/add"
                    search={{ tier: "standard" }}
                    className="underline underline-offset-2"
                  >
                    Or pay ${dollars(PROPERTY_ANNUAL)} for the year
                  </Link>
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
                  <li>Build an RFP and put the job on the market</li>
                  <li>Delegate to a property manager — they see the File and the bids</li>
                </ul>
                <Button
                  asChild
                  className="mt-8 w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link to="/home/add" search={{ tier: "pro" }}>
                    Start Pro
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs opacity-80">
                  <Link
                    to="/home/add"
                    search={{ tier: "pro" }}
                    className="underline underline-offset-2"
                  >
                    Or pay ${dollars(PRO_ANNUAL)} for the year
                  </Link>
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
