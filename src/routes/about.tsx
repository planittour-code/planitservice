import { createFileRoute, Link } from "@tanstack/react-router";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { LEGAL_EMAIL, LEGAL_NAME, LEGAL_SUPPORT_HOURS } from "@/lib/legal";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: () =>
    pageHead({
      title: "About",
      description:
        "PlanitService is the hosted SaaS for PlanItContract, a live-document program registered with the U.S. Copyright Office in 2009. Online since 2007. Georgia.",
      path: "/about",
    }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="choose" />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-12 sm:px-5 sm:py-16">
        <div className="space-y-4">
          <p className="text-sm font-medium tracking-wide text-secondary">About</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            The file for the house, hosted since 2007.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {LEGAL_NAME} is the original — and only authorized — SaaS for PlanItContract.com, a
            live-document computer program registered with the United States Copyright Office in
            2009 as TXu 1-630-125. Online since 2007. The company operates from Georgia.
          </p>
        </div>

        <section className="space-y-3 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-semibold tracking-tight">What we build</h2>
          <p className="leading-relaxed text-muted-foreground">
            A Property Record hangs on the address: photos, jobs, products, warranties, and the
            shops who already worked the house. Contractors quote onto that file and stay the known
            shop for the next visit. Property managers run a portfolio of the same records plus a
            maintenance calendar.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            We host the software. We are not a general contractor, broker, or escrow. Quotes and
            work stay between the shop and the homeowner.
          </p>
        </section>

        <section className="space-y-3 rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-2xl font-semibold tracking-tight">A shop on the product</h2>
          <p className="leading-relaxed text-muted-foreground">
            Painting Plus in Marietta, Georgia uses PlanitService to quote, schedule, and keep the
            house file after the crew leaves. Public booking and new-project requests for that shop
            live on their shop page.
          </p>
          <Button asChild variant="outline">
            <Link to="/s/$slug" params={{ slug: "painting-plus" }}>
              See Painting Plus
            </Link>
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Support</h2>
          <p className="leading-relaxed text-muted-foreground">
            Email{" "}
            <a className="underline underline-offset-4" href={`mailto:${LEGAL_EMAIL}`}>
              {LEGAL_EMAIL}
            </a>
            . {LEGAL_SUPPORT_HOURS}, excluding U.S. federal holidays.
          </p>
          <p className="text-sm text-muted-foreground">
            Read the{" "}
            <Link to="/terms" className="underline underline-offset-2">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            , and{" "}
            <Link to="/sla" className="underline underline-offset-2">
              SLA
            </Link>
            .
          </p>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
