import { createFileRoute, Link } from "@tanstack/react-router";
import { PaidLanding } from "@/components/paid-landing";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import {
  MANAGE_MONTHLY,
  PROPERTY_MONTHLY,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";

export const Route = createFileRoute("/")({ component: WelcomeSite });

function WelcomeSite() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding />
      <PublicHeader path="choose" />

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
              PlanitService
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              The house keeps the record. The shops who already worked it are on it.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-primary-foreground/80">
              One Property Record at the address — jobs, products, warranties, and maintenance.
              Homeowners call back the shop they already used. When they need bids, Request
              Estimates goes to shops that can do that work at that address.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
            <p className="text-center text-sm tracking-wide text-muted-foreground uppercase">
              Choose how you use it
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <PathCard
                kicker="Homeowners"
                title="Keep the file. Call the shop back."
                body="Photos, jobs, warranties, and maintenance at the address — plus the shops that already worked the house. Pro adds Request Estimates when you want bids from shops that service this street."
                price={`From $${dollars(PROPERTY_MONTHLY)} / month per property`}
                to="/homeowner"
                cta="I’m a homeowner"
              />
              <PathCard
                kicker="Contractors"
                title="Turn one job into the next visit."
                body="Quote onto the File so you are the known shop for repeat work. Upsell the other trades you offer. Catch Request Estimates from homeowners and offices in your service area."
                price={`Shop from $${dollars(SHOP_MONTHLY)} / month`}
                to="/shop"
                cta="I’m a contractor"
                emphasis
              />
              <PathCard
                kicker="Property managers"
                title="Records, a calendar, and bids."
                body="A portfolio of Property Records with a maintenance calendar. Known shops first. Request Estimates when a house needs work and you want numbers from shops that cover the address."
                price={`Portfolio from $${dollars(MANAGE_MONTHLY)} / month for 10 houses`}
                to="/manage"
                cta="I’m a property manager"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Step
              n="1"
              title="The address is the file."
              body="Search the house. Start a Property Record if one is not there. Everything that follows hangs on that address."
            />
            <Step
              n="2"
              title="The quote writes the history."
              body="A shop measures, prices, and sends. Accepted work, products, and warranties stay on the record after the crew leaves."
            />
            <Step
              n="3"
              title="The shop that knows the house gets called back."
              body="Known providers stay on the file. Request Estimates is for new work, or when you want competing numbers from shops that service the address."
            />
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}

function PathCard({
  kicker,
  title,
  body,
  price,
  to,
  cta,
  emphasis,
}: {
  kicker: string;
  title: string;
  body: string;
  price: string;
  to: "/homeowner" | "/shop" | "/manage";
  cta: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={
        emphasis
          ? "flex flex-col rounded-xl bg-primary p-6 text-primary-foreground shadow-[var(--shadow-border)] sm:p-8"
          : "flex flex-col rounded-xl bg-card p-6 shadow-[var(--shadow-border)] sm:p-8"
      }
    >
      <p className={`text-sm tracking-wide uppercase ${emphasis ? "opacity-80" : "text-muted-foreground"}`}>
        {kicker}
      </p>
      <h2 className="mt-3 font-display text-3xl font-medium tracking-tight">{title}</h2>
      <p className={`mt-4 flex-1 leading-relaxed ${emphasis ? "opacity-90" : "text-muted-foreground"}`}>
        {body}
      </p>
      <p className={`mt-5 text-sm ${emphasis ? "opacity-80" : "text-muted-foreground"}`}>{price}</p>
      <Button
        asChild
        className={
          emphasis
            ? "mt-6 min-h-12 w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            : "mt-6 min-h-12 w-full"
        }
      >
        <Link to={to}>{cta}</Link>
      </Button>
    </article>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">Step {n}</p>
      <h2 className="font-display text-xl font-medium">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
