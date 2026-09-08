import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ManageClaimForm, ManageSignupForm } from "@/components/manage-signup";
import { AuthSlot, PageFooter, PublicHeader } from "@/components/site-chrome";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  MANAGE_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { confirmManageCheckout } from "@/lib/housefile/stripe-billing";
import { useAudience } from "@/lib/housefile/use-audience";

const searchSchema = z.object({
  session_id: z.string().optional(),
});

export const Route = createFileRoute("/manage/open")({
  validateSearch: (s) => searchSchema.parse(s),
  component: OpenPortfolio,
});

function OpenPortfolio() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUserState();
  const { audience, isPending } = useAudience();
  const [confirming, setConfirming] = useState(Boolean(user && search.session_id));
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !search.session_id) {
      setConfirming(false);
      return;
    }
    let cancelled = false;
    setConfirming(true);
    setConfirmError(null);
    void confirmManageCheckout({ data: search.session_id! })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setConfirming(false);
          setConfirmError("Checkout did not finish. Continue below to try again.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["audience"] });
        await queryClient.invalidateQueries({ queryKey: ["portfolio"] });
        void navigate({ to: "/manage" });
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

  if (!isPending && audience.kind === "manager" && audience.paying && !search.session_id) {
    return <Navigate to="/manage" />;
  }
  if (!isPending && audience.kind === "contractor" && audience.paying && !search.session_id) {
    return <Navigate to="/app" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="manager">
        <AuthSlot signedInTo="/manage" />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/cover-hero.jpg"
            alt=""
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/60" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <div className="space-y-5">
              <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">For property managers</p>
              <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-5xl">
                One record for every house you manage.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                Photos, jobs, warranties, and issued estimates at the address. The homeowner can claim
                the file later. Shops still quote in their own shop.
              </p>
              <ul className="space-y-3 text-sm text-primary-foreground/80">
                <li>{MANAGE_INCLUDED} Property Records on the base plan.</li>
                <li>Extra houses ${dollars(MANAGE_EXTRA_MONTHLY)} / month each.</li>
                <li>No catalog. No quoting. The file is the product.</li>
              </ul>
            </div>
            <div id="signup" className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
              <p className="text-sm tracking-wide text-muted-foreground uppercase">Open a portfolio</p>
              <p className="mt-2 font-display text-3xl font-medium tracking-tight">
                ${dollars(MANAGE_MONTHLY)}
                <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">/ month</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                or ${dollars(MANAGE_ANNUAL)} a year. {MANAGE_INCLUDED} houses included.
              </p>
              <div className="mt-5">
                {confirming ? (
                  <p className="text-sm text-muted-foreground">Confirming payment…</p>
                ) : search.session_id && !user ? (
                  <ManageClaimForm sessionId={search.session_id} />
                ) : (
                  <>
                    {confirmError ? <p className="mb-3 text-sm text-destructive">{confirmError}</p> : null}
                    <ManageSignupForm />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}
