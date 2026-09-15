import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { PathSignInForm } from "@/components/path-sign-in";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { PaidLanding } from "@/components/paid-landing";
import { AddressLookup, TeaseCard } from "@/components/address-lookup";
import { TradeCarousel } from "@/components/trade-carousel";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useAudience } from "@/lib/housefile/use-audience";
import {
  PROPERTY_MONTHLY,
  SEAT_MONTHLY,
  SHOP_ANNUAL,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import type { AddressTease } from "@/lib/housefile/types";

export const Route = createFileRoute("/shop")({ component: ShopFrame });

function ShopFrame() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/shop") return <Outlet />;
  return <HomePage />;
}

function HomePage() {
  const [tease, setTease] = useState<AddressTease | null>(null);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding prefer="contractor" />
      <PublicHeader path="contractor">
        <AuthSlot />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/shop-open.jpg"
            alt="A contractor with a tablet in front of a house and work van"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-8 md:pt-14">
            <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div className="space-y-6">
                <p className="text-sm font-bold tracking-[0.16em] text-primary uppercase">
                  For contractors
                </p>
                <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl md:text-6xl">
                  Turn one job into the next visit.
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-pretty text-primary-foreground/80">
                  Quote onto the File so you are the known shop for repeat work. Upsell the other
                  trades you offer. Catch Request Estimates from homeowners and offices in your
                  service area.
                </p>
                <div className="rounded-xl bg-card p-2 text-left text-foreground shadow-[var(--shadow-border)]">
                  <AddressLookup onTease={setTease} />
                </div>
              </div>
              <div className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
                <PathSignInForm
                  next="/app"
                  role="contractor"
                  kicker="Already have a shop"
                  title="Sign in to the shop"
                  submitLabel="Sign in to the shop"
                  newAccountTo="/shop/open"
                  newAccountLabel="Open a shop"
                />
                <SignedInOpenShop />
              </div>
            </div>
            {tease && (
              <div className="mx-auto mt-10 max-w-6xl text-foreground">
                <TeaseCard tease={tease} />
              </div>
            )}
          </div>
        </section>

        <TradeCarousel />

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-xl space-y-8 px-5 py-16">
            <h2 className="text-center font-display text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
              A little homework can remove a lot of guesswork.
            </h2>
            <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
              <img
                src="/houses/maple-front.jpg"
                alt="A craftsman bungalow in Marietta"
                className="aspect-[16/9] w-full object-cover"
              />
              <div className="space-y-4 p-5">
                <div>
                  <p className="font-display text-xl font-bold">142 Maple Street</p>
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
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-[1fr_1fr] md:items-center">
            <div className="space-y-4">
              <h2 className="font-display text-3xl font-extrabold tracking-tight">
                Getting to Approval has never been easier.
              </h2>
              <img
                src="/houses/aisle.jpg"
                alt="Paint, lumber, shingles, and gutter coil in a materials aisle"
                className="aspect-[16/9] w-full rounded-md object-cover"
              />
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
              <p className="mt-3 font-display text-5xl font-extrabold tracking-tight">
                ${dollars(SHOP_MONTHLY)}
                <span className="ml-2 text-lg font-sans font-normal opacity-80">/ month</span>
              </p>
              <p className="mt-2 text-sm opacity-80">
                or ${dollars(SHOP_ANNUAL)} a year. Extra seats ${dollars(SEAT_MONTHLY)}/month.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                <li>Quote onto the File — you become the known shop</li>
                <li>Repeat and upsell from jobs already at the address</li>
                <li>Request Estimates leads in your trades and area</li>
                <li>The next visit is already yours</li>
              </ul>
              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Link to="/shop/open" search={{ intent: "up" }}>
                    Open a shop
                  </Link>
                </Button>
              </div>
              <p className="mt-3 text-center text-xs opacity-80">
                Annual is ${dollars(SHOP_ANNUAL)}. Extra seats ${dollars(SEAT_MONTHLY)}/month.
              </p>
              <p className="mt-3 text-center text-xs opacity-70">
                The Property Record you open is theirs. They keep it for ${dollars(PROPERTY_MONTHLY)} a month.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PageFooter shop />
    </div>
  );
}

function SignedInOpenShop() {
  const { user } = useCurrentUserState();
  const { audience } = useAudience();
  if (!user) return null;
  if (audience.hats.contractor) return null;
  if (audience.hats.manager || audience.hats.homeowner) return null;
  return (
    <div className="space-y-3">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">Signed in</p>
      <p className="font-display text-2xl font-extrabold tracking-tight">Open a shop on this login</p>
      <p className="text-sm text-muted-foreground">
        Pay for the shop, then quote from the Property Record. Card details stay on Stripe.
      </p>
      <Button asChild className="min-h-12 w-full">
        <Link to="/shop/open" search={{ intent: "up" }}>
          Continue to Stripe
        </Link>
      </Button>
    </div>
  );
}
