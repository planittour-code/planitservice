import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { PageFooter, PublicHeader, AuthSlot } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
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

export const Route = createFileRoute("/start")({
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
      void navigate({ to: "/home/add", search: { tier } });
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
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="homeowner">
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
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-5 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-16">
            <div className="space-y-5">
              <p className="text-sm tracking-wide text-primary-foreground/70 uppercase">
                Use the same software as your contractor
              </p>
              <h1 className="font-display text-4xl font-medium tracking-tight text-balance md:text-5xl">
                The house should remember what you already paid for.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                You do not wait on a shop to start the Property Record. Write the roof year, the paint color,
                the filter size. When a contractor quotes through PlanitService, that work lands on
                the same record. Share it. Hand it on.
              </p>
              <ul className="space-y-3 text-sm text-primary-foreground/80">
                <li>You own the Property Record from day one — no contractor has to invite you first.</li>
                <li>Jobs, products, warranties, and maintenance live at the address.</li>
                <li>Pro puts the next job in front of shops, or a property manager.</li>
              </ul>
            </div>

            <div id="signup" className="rounded-xl bg-card p-5 text-foreground shadow-[var(--shadow-border)] sm:p-6">
              <p className="text-sm tracking-wide text-muted-foreground uppercase">Start a Property Record</p>
              <p className="mt-2 font-display text-3xl font-medium tracking-tight">
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
                    <li>Request bids and put the job on the market</li>
                    <li>Let a property manager see the Property Record and the bids</li>
                  </>
                ) : (
                  <>
                    <li>Build the Property Record — jobs, photos, products, warranties</li>
                    <li>Share a link with buyers or contractors</li>
                    <li>Transfer the record at sale or when the house passes on</li>
                  </>
                )}
              </ul>

              <form className="mt-5 space-y-3" onSubmit={(e) => void onSubmit(e)}>
                {!user && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="start-name">Name</Label>
                      <Input
                        id="start-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1.5">
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
                    <div className="space-y-1.5">
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
              kicker="Start it yourself"
              title="You own the Property Record from day one."
              body="Add the house. Write what you already know. No shop has to invite you first."
            />
            <Proof
              photo="/houses/maple-interior.jpg"
              kicker="Ask for bids"
              title="Put the work in front of shops."
              body="Pro lets you write a request and send it to the market against the house you already documented."
            />
            <Proof
              photo="/houses/maple-roof.jpg"
              kicker="Hand it on"
              title="The next owner starts with history."
              body="Share a link. Transfer the record at sale or when the house passes on. The Property Record stays with the address."
            />
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-5">
            <h2 className="font-display text-3xl font-medium tracking-tight">
              Stop hunting for the last receipt.
            </h2>
            <p className="max-w-xl text-muted-foreground leading-relaxed">
              The next buyer will ask what is on the roof. That answer should live at the address.
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
        <h2 className="font-display text-xl font-medium tracking-tight">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}
