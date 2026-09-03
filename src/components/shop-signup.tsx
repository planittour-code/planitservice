import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";
import { shopKind } from "@/lib/housefile/stripe";
import { startCheckout } from "@/lib/housefile/stripe-billing";

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
        <li>Price from your book — suppliers, a spreadsheet, or numbers you type.</li>
        <li>Every quote starts the Property Record. The next trade at that address is already yours.</li>
      </ul>
    </div>
  );
}

export function ShopSignupForm({ next = "/shop/open" }: { next?: string }) {
  const { user } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function goPay() {
    const { url } = await startCheckout({
      data: {
        kind: shopKind(cadence),
        successPath: "/app/onboard",
        cancelPath: "/shop/open",
      },
    });
    window.location.href = url;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!user) {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || email.split("@")[0],
          callbackURL: "/shop/open",
        });
        if (res.error) throw new Error(res.error.message || "Could not create the shop account");
      }
      await goPay();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start shop checkout");
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={cadence === "monthly" ? "default" : "outline"}
          onClick={() => setCadence("monthly")}
        >
          ${dollars(SHOP_MONTHLY)}/mo
        </Button>
        <Button
          type="button"
          variant={cadence === "annual" ? "default" : "outline"}
          onClick={() => setCadence("annual")}
        >
          ${dollars(SHOP_ANNUAL)}/yr
        </Button>
      </div>
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Working…" : user ? "Pay and open the shop" : "Create account and pay"}
      </Button>
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" search={{ next }} className="underline underline-offset-2">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
