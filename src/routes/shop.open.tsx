import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PathSignInForm } from "@/components/path-sign-in";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { ShopClaimForm, ShopSignupForm } from "@/components/shop-signup";
import { Button } from "@/components/ui/button";
import { justSignedOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { confirmShopCheckout } from "@/lib/housefile/stripe-billing";
import { useAudience } from "@/lib/housefile/use-audience";

const searchSchema = z.object({
  session_id: z.string().optional(),
  intent: z.enum(["in", "up"]).optional(),
});

export const Route = createFileRoute("/shop/open")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OpenShop,
});

function OpenShop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUserState();
  const { audience, isPending } = useAudience();
  const [confirming, setConfirming] = useState(Boolean(user && search.session_id));
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [intent, setIntent] = useState<"in" | "up">(search.intent === "up" ? "up" : "in");

  useEffect(() => {
    setIntent(search.intent === "up" ? "up" : "in");
  }, [search.intent]);

  useEffect(() => {
    if (!user || !search.session_id) {
      setConfirming(false);
      return;
    }
    let cancelled = false;
    setConfirming(true);
    setConfirmError(null);
    void confirmShopCheckout({ data: search.session_id! })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setConfirming(false);
          setConfirmError("Checkout did not finish. Continue below to try again.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["audience"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void navigate({ to: "/app/onboard" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConfirming(false);
        setConfirmError(err instanceof Error ? err.message : "Could not confirm checkout.");
      });
    return () => {
      cancelled = true;
    };
  }, [user, search.session_id, queryClient, navigate]);

  if (
    !justSignedOut() &&
    !isPending &&
    audience.kind === "contractor" &&
    audience.paying &&
    !search.session_id
  ) {
    return <Navigate to="/app" />;
  }
  if (!isPending && audience.signedIn && !audience.hats.contractor && !search.session_id) {
    if (audience.hats.manager) return <Navigate to="/manage" />;
    if (audience.hats.homeowner) return <Navigate to="/home" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="contractor">
        <AuthSlot />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/shop-open.jpg"
            alt="A contractor in the yard with a tablet, van at the curb"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <div className="space-y-5">
              <p className="text-sm font-bold tracking-[0.16em] text-primary uppercase">For contractors</p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance text-white md:text-5xl">
                Repeat work, then Request Estimates leads.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                Quote onto the File so the homeowner calls you back. Choose the categories you want
                to offer — ${dollars(SHOP_MONTHLY)}/month each. Catch Request Estimates that match
                those trades in your service area.
              </p>
              <ul className="space-y-3 text-sm text-primary-foreground/80">
                <li>You become the known shop on every File you quote.</li>
                <li>Materials stay in the shop. The File stays with the house.</li>
                <li>Leads match only the categories you offer, in the area you work.</li>
              </ul>
            </div>
            <div id="signup" className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
              {confirming ? (
                <p className="text-sm text-muted-foreground">Confirming payment…</p>
              ) : search.session_id && !user ? (
                <ShopClaimForm sessionId={search.session_id} />
              ) : !user && intent === "in" ? (
                <PathSignInForm
                  next="/app"
                  role="contractor"
                  kicker="Already have a shop"
                  title="Sign in to the shop"
                  submitLabel="Sign in to the shop"
                  newAccountLabel="Open a shop"
                  onNewAccount={() => setIntent("up")}
                />
              ) : (
                <>
                  <p className="text-sm tracking-wide text-muted-foreground uppercase">Open a shop</p>
                  <p className="mt-2 font-display text-3xl font-extrabold tracking-tight">
                    ${dollars(SHOP_MONTHLY)}
                    <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">
                      / category / month
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    or ${dollars(SHOP_ANNUAL)} a year per category. Extra seats $
                    {dollars(SEAT_MONTHLY)}/month. You pay for the work you offer — not every trade
                    on the site.
                  </p>
                  <div className="mt-5">
                    {confirmError ? <p className="mb-3 text-sm text-destructive">{confirmError}</p> : null}
                    <ShopSignupForm />
                    {!user ? (
                      <p className="mt-3 text-center text-sm text-muted-foreground">
                        Already have a shop?{" "}
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => setIntent("in")}
                        >
                          Sign in
                        </button>
                      </p>
                    ) : null}
                  </div>
                </>
              )}
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
              photo="/houses/aisle.jpg"
              kicker="Send it now"
              title="The estimate leaves with you still in the yard."
              body="Templates, line items, and materials. Talk and type. The homeowner has a number before the other shop finds parking."
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
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              Ready when the phone rings.
            </h2>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              Unlimited quotes. Unlimited Property Records. The household is never the customer.
            </p>
            <Button asChild size="lg" className="min-h-12">
              <a href="#signup">Continue to Stripe</a>
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
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}
