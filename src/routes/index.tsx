import { createFileRoute, Link } from "@tanstack/react-router";
import { AudienceTracks } from "@/components/audience-tracks";
import { HowItWorks } from "@/components/how-it-works";
import { JsonLd } from "@/components/json-ld";
import { Mark } from "@/components/logo";
import { PaidLanding } from "@/components/paid-landing";
import { ProductPreview } from "@/components/product-preview";
import { justSignedOut } from "@/lib/auth/client";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { organizationJsonLd, pageHead, SITE_DESCRIPTION, softwareJsonLd } from "@/lib/seo";
import { trackCta } from "@/lib/track-cta";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "PlanitService",
      description: SITE_DESCRIPTION,
      path: "/",
    }),
  component: WelcomeSite,
});

function WelcomeSite() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {justSignedOut() ? null : <PaidLanding />}
      <PublicHeader path="choose" />

      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareJsonLd()} />
      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/cover-hero.jpg"
            alt="A house with a kept record of jobs, products, and warranties"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-20">
            <div className="space-y-6 text-left">
              <div className="flex items-center gap-3">
                <Mark className="size-14 rounded-lg bg-secondary shadow-[var(--shadow-border)]" />
                <p className="text-sm font-medium tracking-wide text-primary">PlanitService</p>
              </div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
                Keep the house file. Call the shop that already knows it.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-white/90">
                Photos, jobs, products, and warranties live at the address. A shop quotes onto that
                file and stays the known shop for the next visit.
              </p>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="min-h-12 bg-go text-go-foreground hover:opacity-90">
                  <Link to="/homeowner" onClick={() => trackCta("homeowner_start")}>
                    Start a Property Record
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-12 whitespace-nowrap border-white/40 bg-white/10 px-4 text-white hover:border-white hover:bg-white/20 hover:text-white"
                >
                  <Link to="/shop" onClick={() => trackCta("contractor_lane")}>
                    Open a Shop
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-white/75">
                Managing more than one house?{" "}
                <Link
                  to="/manage"
                  className="underline underline-offset-4"
                  onClick={() => trackCta("manager_lane")}
                >
                  Open a portfolio
                </Link>
                .
              </p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <AudienceTracks />
        <HowItWorks />
      </main>
      <PageFooter />
    </div>
  );
}
