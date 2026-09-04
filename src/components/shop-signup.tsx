import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TermsAgree } from "@/components/legal-doc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (user) {
      void navigate({ to: "/app/onboard" });
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
      if (res.error) throw new Error(res.error.message || "Could not create the shop account");
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the shop account");
    } finally {
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
      {!user && <TermsAgree id="shop-agree-terms" />}
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Working…" : user ? "Continue to shop setup" : "Create account and open a shop"}
      </Button>
      {!user && (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" search={{ next }} className="underline underline-offset-2">
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
