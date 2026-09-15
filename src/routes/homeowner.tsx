import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { TermsAgree } from "@/components/legal-doc";
import { PaidLanding } from "@/components/paid-landing";
import { PageFooter, PublicHeader, AuthSlot, SignInCta } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, clearSignedOutFlag } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  PROPERTY_ANNUAL,
  PROPERTY_MONTHLY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tier: z.enum(["standard", "pro"]).optional(),
});

export const Route = createFileRoute("/homeowner")({
  validateSearch: (s) => searchSchema.parse(s),
  component: StartHouseRecord,
});

function StartHouseRecord() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [tier, setTier] = useState<"standard" | "pro">(search.tier ?? "standard");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = `/home/add?tier=${tier}`;
  const monthly = tier === "pro" ? PRO_MONTHLY : PROPERTY_MONTHLY;
  const annual = tier === "pro" ? PRO_ANNUAL : PROPERTY_ANNUAL;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (user) {
      void navigate({ to: "/home" });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signUp.email({
        email,
        password,
        name: name.trim() || email.split("@")[0],
        callbackURL: next,
      });
      if (res.error) throw new Error(res.error.message || "Could not create the account");
      clearSignedOutFlag();
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaidLanding prefer="homeowner" />
      <PublicHeader path="homeowner">
        <AuthSlot signedInTo="/home" />
      </PublicHeader>

      <main>
        <section className="relative isolate overflow-hidden bg-ink text-primary-foreground">
          <img
            src="/houses/homeowner-hero.jpg"
            alt="Homeowners reviewing house photos on the porch"
            className="absolute inset-0 size-full object-cover outline-none"
          />
          <div className="absolute inset-0 bg-ink/70" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <div className="space-y-5">
              <p className="text-sm font-bold tracking-[0.16em] text-primary uppercase">
                For the homeowner
              </p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance text-white md:text-5xl">
                The house keeps the record. The shops who worked it stay on it.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                Photos, jobs, warranties, and maintenance at this address — and who already did the
                work, so you call them back. You do not wait on a shop to start the file. Pro adds
                Request Estimates when you want bids from shops that service this street.
              </p>
              <ul className="space-y-3 text-sm text-primary-foreground/80">
                <li>Standard: the Property Record, known shops, and maintenance due dates.</li>
                <li>Pro: Request Estimates — one job, shops that can do that work at this address.</li>
                <li>A named shop you already know stays on Standard. The market is Pro.</li>
              </ul>
              <SignInCta
                signedInTo="/home"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              />
            </div>

            <div id="signup" className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
              <p className="text-sm tracking-wide text-muted-foreground uppercase">Start a Property Record</p>
              <p className="mt-2 font-display text-3xl font-extrabold tracking-tight">
                ${dollars(cadence === "annual" ? annual : monthly)}
                <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">
                  / {cadence === "annual" ? "year" : "month"}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Per property. Cancel anytime.</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                    tier === "standard" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                  onClick={() => setTier("standard")}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                    tier === "pro" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                  onClick={() => setTier("pro")}
                >
                  Pro
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                    cadence === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                  onClick={() => setCadence("monthly")}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={cn(
                    "min-h-11 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
                    cadence === "annual" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                  onClick={() => setCadence("annual")}
                >
                  Annual
                </button>
              </div>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                {tier === "pro" ? (
                  <>
                    <li>Everything in Standard</li>
                    <li>Request Estimates from shops that service this address</li>
                    <li>Named shop you already know stays available on Standard</li>
                  </>
                ) : (
                  <>
                    <li>Property Record — photos, jobs, products, warranties</li>
                    <li>Known shops who already worked the house</li>
                    <li>Maintenance due dates, share, and transfer</li>
                  </>
                )}
              </ul>

              <form className="mt-4 space-y-2" onSubmit={(e) => void onSubmit(e)}>
                {!user && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="start-name">Name</Label>
                      <Input
                        id="start-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="start-email">Email</Label>
                      <Input
                        id="start-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="start-password">Password</Label>
                      <Input
                        id="start-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                {!user && <TermsAgree id="home-agree-terms" />}
                <Button type="submit" className="min-h-12 w-full" disabled={busy}>
                  {busy
                    ? "Working…"
                    : user
                      ? `Continue with ${tier === "pro" ? "Pro" : "Standard"}`
                      : `Create account — ${tier === "pro" ? "Pro" : "Standard"}`}
                </Button>
                {!user && (
                  <p className="text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      search={{ role: "homeowner", next }}
                      className="underline underline-offset-2"
                    >
                      Sign in
                    </Link>
                    {" · "}
                    <Link
                      to="/forgot-password"
                      search={{ role: "homeowner", next }}
                      className="underline underline-offset-2"
                    >
                      Forgot password?
                    </Link>
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-5 md:grid-cols-3">
            <Proof
              photo="/houses/maple-front.jpg"
              kicker="Keep the file"
              title="The house remembers the last job."
              body="Photos, products, warranties, and who did the work. Call that shop back when it is due again."
            />
            <Proof
              photo="/houses/maple-siding.jpg"
              kicker="Request Estimates"
              title="Pro asks shops that can service this street."
              body="One job, one address. Bids come from PlanitService shops that offer that trade in this area — not a dump of every request."
            />
            <Proof
              photo="/houses/maple-roof.jpg"
              kicker="Hand it on"
              title="The next owner starts with history."
              body="Share a link. Transfer the record at sale. The Property Record stays with the address."
            />
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-5">
            <h2 className="font-display text-3xl font-extrabold tracking-tight">
              Stop hunting for the last receipt.
            </h2>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              Who did the gutters, when the roof is due, what paint is on the trim — that lives at
              the address. Request Estimates when you need new bids.
            </p>
            <Button asChild size="lg" className="min-h-12">
              <a href="#signup">Create the account</a>
            </Button>
          </div>
        </section>
      </main>
      <PageFooter />
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
