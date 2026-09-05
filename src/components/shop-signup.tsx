import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TermsAgree } from "@/components/legal-doc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { shopKind } from "@/lib/housefile/stripe";
import { useAudience } from "@/lib/housefile/use-audience";
import { cn } from "@/lib/utils";

export function ShopExplainer() {
  return (
    <div className="space-y-5">
      <p className="text-sm tracking-wide text-muted-foreground uppercase">For contractors</p>
      <h2 className="font-display text-3xl font-medium tracking-tight text-balance md:text-4xl">
        The first clean number wins the job.
      </h2>
      <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
        Look up the house. Quote from what is already on the Property Record. Send the estimate
        while you are still talking — or before anyone else leaves the shop.
      </p>
      <ul className="space-y-3 text-sm text-muted-foreground">
        <li>Search the address before you roll the truck.</li>
        <li>Price from your materials — suppliers, a spreadsheet, or numbers you type.</li>
        <li>Every quote starts the Property Record. The next trade at that address is already yours.</li>
      </ul>
    </div>
  );
}

export function ShopSignupForm({ next = "/app/onboard" }: { next?: string }) {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const { audience } = useAudience();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const price = cadence === "annual" ? SHOP_ANNUAL : SHOP_MONTHLY;

  async function payForShop() {
    const { startCheckout } = await import("@/lib/housefile/stripe-billing");
    const checkout = await startCheckout({
      data: {
        kind: shopKind(cadence),
        successPath: "/shop/open",
        cancelPath: "/shop/open",
      },
    });
    window.location.href = checkout.url;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (user && audience.kind === "contractor" && audience.paying) {
        void navigate({ to: next });
        return;
      }
      if (!user) {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: "/shop/open",
        });
        if (res.error) throw new Error(res.error.message || "Could not create the shop account");
      }
      await payForShop();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the shop account");
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
      {!user && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="shop-name">Shop or your name</Label>
            <Input
              id="shop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-email">Email</Label>
            <Input
              id="shop-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-password">Password</Label>
            <Input
              id="shop-password"
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
              Two months free
            </p>
          </button>
        </div>
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!user && <TermsAgree id="shop-agree-terms" />}
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy
          ? "Working…"
          : user
            ? `Continue to checkout · $${dollars(price)}`
            : `Create account and open a shop · $${dollars(price)}`}
      </Button>
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" search={{ next: "/shop/open" }} className="underline underline-offset-2">
            Sign in
          </Link>
          {" · "}
          <Link to="/forgot-password" search={{ next }} className="underline underline-offset-2">
            Forgot password?
          </Link>
        </p>
      )}
    </form>
  );
}
