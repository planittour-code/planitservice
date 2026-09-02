import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
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
      <PublicHeader compact>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </Link>
      </PublicHeader>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-5 sm:py-12">
        <div className="space-y-3">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">For the homeowner</p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Start a house record
          </h1>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            PlanitService keeps what was done at the address — jobs, products, warranties, and the
            maintenance that follows. Pick Standard or Pro, then create your account. You add the
            property and pay on the next screen.
          </p>
        </div>

        <div className="grid gap-3">
          <PlanCard
            selected={tier === "standard"}
            onSelect={() => setTier("standard")}
            name="Standard"
            price={`$${dollars(PROPERTY_MONTHLY)} / month`}
            year={`or $${dollars(PROPERTY_ANNUAL)} a year`}
            points={[
              "Build the record for each property you own",
              "Jobs, photos, products, and warranties at the address",
              "Share the File with a link",
              "Transfer the record when you sell or the house passes on",
            ]}
          />
          <PlanCard
            selected={tier === "pro"}
            onSelect={() => setTier("pro")}
            name="Pro"
            price={`$${dollars(PRO_MONTHLY)} / month`}
            year={`or $${dollars(PRO_ANNUAL)} a year`}
            points={[
              "Everything in Standard",
              "Write an RFP and put the job out to trades",
              "Delegate the File and the bids to a property manager",
            ]}
          />
        </div>

        <fieldset className="flex gap-2">
          <legend className="sr-only">Billing</legend>
          <button
            type="button"
            className={cn(
              "min-h-11 flex-1 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
              cadence === "monthly" ? "bg-primary text-primary-foreground" : "bg-card",
            )}
            onClick={() => setCadence("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "min-h-11 flex-1 rounded-md px-3 text-sm shadow-[var(--shadow-border)]",
              cadence === "annual" ? "bg-primary text-primary-foreground" : "bg-card",
            )}
            onClick={() => setCadence("annual")}
          >
            Annual
          </button>
        </fieldset>

        <form className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            {user ? "Continue with this plan" : "Create your account"}
          </h2>
          {!user && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="start-name">Name</Label>
                <Input id="start-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
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
              <Link to="/login" search={{ role: "homeowner", next }} className="underline underline-offset-2">
                Sign in
              </Link>
            </p>
          )}
        </form>
      </main>
      <PageFooter />
    </div>
  );
}

function PlanCard({
  selected,
  onSelect,
  name,
  price,
  year,
  points,
}: {
  selected: boolean;
  onSelect: () => void;
  name: string;
  price: string;
  year: string;
  points: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)] sm:p-5",
        selected && "ring-2 ring-ring",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1 grid size-5 shrink-0 place-items-center rounded-full border border-border",
            selected && "border-primary bg-primary",
          )}
        >
          {selected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-xl font-medium">{name}</span>
            <span className="text-sm">{price}</span>
          </span>
          <span className="block text-xs text-muted-foreground">{year}</span>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </span>
      </div>
    </button>
  );
}
