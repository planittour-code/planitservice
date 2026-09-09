import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TermsAgree } from "@/components/legal-doc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { shopKind } from "@/lib/housefile/stripe";
import { claimShopCheckout, startCheckout, startShopCheckout } from "@/lib/housefile/stripe-billing";
import { useAudience } from "@/lib/housefile/use-audience";
import { cn } from "@/lib/utils";

export function ShopSignupForm() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const { audience } = useAudience();
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const price = cadence === "annual" ? SHOP_ANNUAL : SHOP_MONTHLY;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (user && audience.kind === "contractor" && audience.paying) {
        void navigate({ to: "/app" });
        return;
      }
      if (user) {
        const checkout = await startCheckout({
          data: {
            kind: shopKind(cadence),
            successPath: "/shop/open",
            cancelPath: "/shop/open",
          },
        });
        window.location.href = checkout.url;
        return;
      }
      const checkout = await startShopCheckout({
        data: {
          kind: cadence === "annual" ? "shop_annual" : "shop_monthly",
          shopName: name.trim() || undefined,
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
      {!user && (
        <div className="space-y-1.5">
          <Label htmlFor="shop-name">Shop name (optional)</Label>
          <Input
            id="shop-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
          />
        </div>
      )}
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
            <p className="font-medium">${dollars(SHOP_MONTHLY)} / month</p>
            <p className={cn("mt-1 text-sm", cadence === "monthly" ? "opacity-80" : "text-muted-foreground")}>
              Extra seats ${dollars(SEAT_MONTHLY)}/month
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
            <p className="font-medium">${dollars(SHOP_ANNUAL)} / year</p>
            <p className={cn("mt-1 text-sm", cadence === "annual" ? "opacity-80" : "text-muted-foreground")}>
              Two months included
            </p>
          </button>
        </div>
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <TermsAgree id="shop-agree-terms" />
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Sending you to Stripe…" : `Continue to Stripe · $${dollars(price)}`}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Card details stay on Stripe. No PlanitService account until payment finishes.
      </p>
    </form>
  );
}

export function ShopClaimForm({ sessionId }: { sessionId: string }) {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const claimed = await claimShopCheckout({
        data: { sessionId, password, name: name.trim() || undefined },
      });
      const signed = await authClient.signIn.email({
        email: claimed.email,
        password,
        callbackURL: "/app/onboard",
      });
      if (signed.error) throw new Error(signed.error.message || "Account created. Sign in to continue.");
      window.location.href = "/app/onboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish shop setup");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-muted-foreground">
        Payment received. Set a password for the email you used on Stripe.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="claim-name">Your name</Label>
        <Input id="claim-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claim-password">Password</Label>
        <Input
          id="claim-password"
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
        {busy ? "Opening your shop…" : "Set password and open the shop"}
      </Button>
    </form>
  );
}
