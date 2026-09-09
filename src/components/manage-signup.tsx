import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TermsAgree } from "@/components/legal-doc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  MANAGE_ANNUAL,
  MANAGE_EXTRA_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { manageKind } from "@/lib/housefile/stripe";
import { claimManageCheckout, startCheckout, startManageCheckout } from "@/lib/housefile/stripe-billing";
import { useAudience } from "@/lib/housefile/use-audience";
import { cn } from "@/lib/utils";

export function ManageSignupForm() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const { audience } = useAudience();
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const price = cadence === "annual" ? MANAGE_ANNUAL : MANAGE_MONTHLY;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (user && audience.hats.manager) {
        void navigate({ to: "/manage" });
        return;
      }
      if (user) {
        const checkout = await startCheckout({
          data: {
            kind: manageKind(cadence),
            officeName: name.trim() || undefined,
            successPath: "/manage/open",
            cancelPath: "/manage/open",
          },
        });
        window.location.href = checkout.url;
        return;
      }
      const checkout = await startManageCheckout({
        data: {
          kind: cadence === "annual" ? "manage_annual" : "manage_monthly",
          officeName: name.trim() || undefined,
        },
      });
      window.location.href = checkout.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue to Stripe checkout");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
      <div className="space-y-1.5">
        <Label htmlFor="office-name">Office name (optional)</Label>
        <Input
          id="office-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="organization"
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Billing</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCadence("monthly")}
            className={cn(
              "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
              cadence === "monthly" ? "bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            <p className="font-medium">${dollars(MANAGE_MONTHLY)} / month</p>
            <p className={cn("mt-1 text-sm", cadence === "monthly" ? "opacity-80" : "text-muted-foreground")}>
              {MANAGE_INCLUDED} houses. Extra ${dollars(MANAGE_EXTRA_MONTHLY)}/month each
            </p>
          </button>
          <button
            type="button"
            onClick={() => setCadence("annual")}
            className={cn(
              "rounded-xl p-4 text-left shadow-[var(--shadow-border)]",
              cadence === "annual" ? "bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            <p className="font-medium">${dollars(MANAGE_ANNUAL)} / year</p>
            <p className={cn("mt-1 text-sm", cadence === "annual" ? "opacity-80" : "text-muted-foreground")}>
              {MANAGE_INCLUDED} houses. Extra ${dollars(MANAGE_EXTRA_ANNUAL)}/year each
            </p>
          </button>
        </div>
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <TermsAgree id="manage-agree-terms" />
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Sending you to Stripe…" : `Continue to Stripe · $${dollars(price)}`}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {user
          ? "Card details stay on Stripe. This login becomes the office."
          : "Card details stay on Stripe. No PlanitService account until payment finishes."}
      </p>
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          Already paid and set a password?{" "}
          <Link to="/login" search={{ next: "/manage" }} className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}

export function ManageClaimForm({ sessionId }: { sessionId: string }) {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const claimed = await claimManageCheckout({
        data: { sessionId, password, name: name.trim() || undefined },
      });
      const signed = await authClient.signIn.email({
        email: claimed.email,
        password,
        callbackURL: "/manage",
      });
      if (signed.error) throw new Error(signed.error.message || "Account created. Sign in to continue.");
      window.location.href = "/manage";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish portfolio setup");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-muted-foreground">
        Payment received. Set a password for the email you used on Stripe.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="manage-claim-name">Your name</Label>
        <Input id="manage-claim-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manage-claim-password">Password</Label>
        <Input
          id="manage-claim-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Opening your portfolio…" : "Set password and open the portfolio"}
      </Button>
    </form>
  );
}
