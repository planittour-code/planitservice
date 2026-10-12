import { createFileRoute } from "@tanstack/react-router";
import { AudienceTracks } from "@/components/audience-tracks";
import { JsonLd } from "@/components/json-ld";
import { Mark } from "@/components/logo";
import { PaidLanding } from "@/components/paid-landing";
import { justSignedOut } from "@/lib/auth/client";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { organizationJsonLd, pageHead, SITE_DESCRIPTION, softwareJsonLd } from "@/lib/seo";

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
          <div className="relative mx-auto max-w-3xl space-y-6 px-4 py-16 text-left sm:px-6 md:py-24">
            <div className="flex items-center gap-3">
              <Mark className="size-14 rounded-lg bg-secondary shadow-[var(--shadow-border)]" />
              <p className="text-sm font-medium tracking-wide text-primary">PlanitService</p>
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
              The file for the house.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-white/90">
              Photos, jobs, products, and warranties stay at the address. The shop that already
              worked it stays on the file.
            </p>
          </div>
        </section>

        <AudienceTracks />
      </main>
      <PageFooter />
    </div>
  );
}
