import { createFileRoute, Link } from "@tanstack/react-router";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { ShopSignupForm } from "@/components/shop-signup";
import { Button } from "@/components/ui/button";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";

export const Route = createFileRoute("/shop/open")({
  component: OpenShop,
});

function OpenShop() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader home="/shop">
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/p/$token" params={{ token: "maple-paint-draft" }}>
            Sample quote
          </Link>
        </Button>
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/shop-open.jpg"
            alt="A contractor in the yard with a tablet, van at the curb"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/60" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <div className="space-y-5">
              <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">For contractors</p>
              <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-5xl">
                The first clean number wins the job.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                Look up the house. Quote from what is already on the Property Record. Send the estimate while
                you are still talking — or before anyone else leaves the shop.
              </p>
              <ul className="space-y-3 text-sm text-primary-foreground/80">
                <li>Search the address before you roll the truck.</li>
                <li>Price from your book — suppliers, a spreadsheet, or numbers you type.</li>
                <li>Every quote starts the Property Record. The next trade at that address is already yours.</li>
              </ul>
            </div>
            <div id="signup" className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
              <p className="text-sm tracking-wide text-muted-foreground uppercase">Open a shop</p>
              <p className="mt-2 font-display text-3xl font-medium tracking-tight">
                ${dollars(SHOP_MONTHLY)}
                <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">/ month</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                or ${dollars(SHOP_ANNUAL)} a year. Extra seats ${dollars(SEAT_MONTHLY)}/month. You pay
                for the people who quote — not per house.
              </p>
              <div className="mt-5">
                <ShopSignupForm />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Proof
              photo="/houses/maple-front.jpg"
              kicker="Know the walk"
              title="The last job is already written down."
              body="Roof year, paint formula, gutter product. If a Property Record exists, you are not guessing from the curb."
            />
            <Proof
              photo="/houses/maple-interior.jpg"
              kicker="Send it now"
              title="The estimate leaves with you still in the yard."
              body="Templates, line items, and the book. Talk and type. The homeowner has a number before the other shop finds parking."
            />
            <Proof
              photo="/houses/maple-roof.jpg"
              kicker="Get called back"
              title="Repeat work is why you built the Property Record."
              body="The house keeps the record. The next trade looks it up and sees your shop was here first."
            />
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-5">
            <h2 className="font-display text-3xl font-medium tracking-tight">
              Ready when the phone rings.
            </h2>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              Unlimited quotes. Unlimited Property Records. The household is never the customer.
            </p>
            <Button asChild size="lg" className="min-h-12">
              <a href="#signup">Create the shop account</a>
            </Button>
          </div>
        </section>
      </main>
      <PageFooter shop />
    </div>
  );
}

function Proof({
  photo,
  kicker,
  title,
  body,
}: {
  photo: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
      <img src={photo} alt="" className="aspect-[16/9] w-full object-cover" />
      <div className="space-y-2 p-5">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">{kicker}</p>
        <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}
