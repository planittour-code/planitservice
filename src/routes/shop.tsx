import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { AddressLookup, TeaseCard } from "@/components/address-lookup";
import { TradeCarousel } from "@/components/trade-carousel";
import { Button } from "@/components/ui/button";
import {
  PROPERTY_MONTHLY,
  SEAT_MONTHLY,
  SHOP_ANNUAL,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import type { AddressTease } from "@/lib/housefile/types";

export const Route = createFileRoute("/shop")({ component: HomePage });

function HomePage() {
  const [tease, setTease] = useState<AddressTease | null>(null);
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PublicHeader home="/shop">
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <a href="#pricing">Pricing</a>
        </Button>
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link to="/p/$token" params={{ token: "maple-paint-draft" }}>
            Sample quote
          </Link>
        </Button>
        <AuthSlot />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/hero.jpg?v=yard"
            alt="A contractor van at a house, salesperson talking with the homeowner in the yard"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/55" />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8 md:pt-14">
            <div className="mx-auto max-w-3xl space-y-6 text-center">
              <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">
                For general contractors
              </p>
              <h1 className="font-display text-4xl font-medium tracking-tight text-balance sm:text-5xl md:text-6xl">
                If you could know before you go…
              </h1>
              <p className="mx-auto max-w-xl text-lg leading-relaxed text-pretty text-primary-foreground/80">
                Save drive time with a quick search. Know what you are walking before you start
                talking. Jump the line with fast, accurate quotes based on the last job.
              </p>
              <div className="rounded-xl bg-card p-2 text-left text-foreground shadow-[var(--shadow-border)]">
                <AddressLookup onTease={setTease} />
              </div>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link to="/login" search={{ next: "/app/onboard" }}>
                    Open a shop
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-0 bg-card text-foreground"
                >
                  <Link to="/p/$token" params={{ token: "maple-paint-draft" }}>
                    See a sample quote
                  </Link>
                </Button>
              </div>
            </div>
            {tease && (
              <div className="mx-auto mt-10 max-w-xl text-foreground">
                <TeaseCard tease={tease} />
              </div>
            )}
          </div>
        </section>

        <TradeCarousel />

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-xl space-y-8 px-5 py-16">
            <h2 className="text-center font-display text-3xl font-medium tracking-tight text-balance md:text-4xl">
              A little homework can generate a lot of home work.
            </h2>
            <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
              <img
                src="/houses/maple-front.jpg"
                alt="A craftsman bungalow in Marietta"
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="space-y-4 p-5">
                <div>
                  <p className="font-display text-xl font-medium">142 Maple Street</p>
                  <p className="text-sm text-muted-foreground">Marietta, GA · 18 facts on file</p>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between gap-3">
                    <span>Architectural shingle reroof</span>
                    <span className="text-muted-foreground">2019</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span>Exterior — SW 7008 Alabaster</span>
                    <span className="text-muted-foreground">2023</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span>LeafFilter gutter guards</span>
                    <span className="text-muted-foreground">Lifetime</span>
                  </li>
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/invite/$token" params={{ token: "maple-invite" }}>
                    Take a Tour
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-medium tracking-tight">
                Getting to Approval has never been easier.
              </h2>
              <p className="text-muted-foreground">
                Being first to send an estimate shows you are ready and willing.{" "}
                <strong className="font-semibold underline">
                  Getting the details straight shows you are able
                </strong>
                .
              </p>
              <p className="text-sm font-medium">Bring your Material Prices from:</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>National Supplier APIs</li>
                <li>Custom Spreadsheets</li>
                <li>Manual Entry</li>
              </ul>
            </div>
            <div className="rounded-xl bg-primary p-6 text-primary-foreground shadow-[var(--shadow-border)] sm:p-8">
              <p className="text-sm tracking-wide uppercase opacity-80">The shop</p>
              <p className="mt-3 font-display text-5xl font-medium tracking-tight">
                ${dollars(SHOP_MONTHLY)}
                <span className="ml-2 text-lg font-sans font-normal opacity-80">/ month</span>
              </p>
              <p className="mt-2 text-sm opacity-80">
                or ${dollars(SHOP_ANNUAL)} a year. Extra seats ${dollars(SEAT_MONTHLY)}/month.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li>Search the address before you roll</li>
                <li>Quote from the last job on the File</li>
                <li>Jump the line — send it while you talk</li>
                <li>The next trade is already yours</li>
              </ul>
              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link to="/login" search={{ next: "/app/onboard" }}>
                    Open a shop
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-center text-xs opacity-70">
                After sign-in, checkout runs on planitservice.com via Stripe Checkout (not Payment
                Links). The File you open is theirs — they keep it for ${dollars(PROPERTY_MONTHLY)} a
                month.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PageFooter shop />
    </div>
  );
}
