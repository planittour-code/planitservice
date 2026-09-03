import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { PaidLanding } from "@/components/paid-landing";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_MONTHLY,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";

export const Route = createFileRoute("/")({ component: WelcomeSite });

function WelcomeSite() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding />
      <PublicHeader path="choose">
        <AuthSlot signedInTo="/home" />
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
              PlanitService
            </p>
            <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-6xl">
              The house keeps a record. The shop quotes from it.
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-primary-foreground/80">
              One Property Record at the address. Homeowners keep the jobs, products, warranties,
              and maintenance. Contractors search the address, quote from what is already known,
              and send a number before the other shop is still driving over.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5">
            <p className="text-center text-sm tracking-wide text-muted-foreground uppercase">
              Choose how you use it
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <PathCard
                kicker="Homeowners"
                title="Own the Property Record."
                body="Put in what you already know. Photos, paint, roof year, equipment. Share it with a buyer, a shop, or a property manager. When a PlanitService contractor works the house, the job writes onto the same record."
                price={`From $${dollars(PROPERTY_MONTHLY)} / month per property`}
                to="/homeowner"
                cta="I’m a homeowner"
              />
              <PathCard
                kicker="Contractors"
                title="Quote from the last job."
                body="Look up the address. If a record is there, you know the walk before you talk. Templates, a price book, and a quote you can send before you leave the yard. The File you open is theirs — they keep it."
                price={`Shop from $${dollars(SHOP_MONTHLY)} / month`}
                to="/shop"
                cta="I’m a contractor"
                emphasis
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
              title="The next visit is faster."
              body="The next trade does not guess. The homeowner does not hunt a receipt. The shop that already knows the house gets called back."
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
  to: "/homeowner" | "/shop";
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
