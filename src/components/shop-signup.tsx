import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";

export function ShopExplainer() {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-2xl font-medium tracking-tight">Open a shop</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          First to quote wins more jobs. Accuracy makes it count. Search the address, quote from the
          last job on the File, and send the number while you talk — or before you roll the truck.
        </p>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>Know before you go — specs from the last job, if a File exists.</li>
        <li>Quote from your book — supplier APIs, a spreadsheet, or numbers you type.</li>
        <li>The File brings them back. Repeat work is why you built it.</li>
      </ul>
      <p className="text-sm">
        ${dollars(SHOP_MONTHLY)}/month or ${dollars(SHOP_ANNUAL)}/year. Extra seats $
        {dollars(SEAT_MONTHLY)}/month.
      </p>
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
      <p className="font-medium">{user ? "Continue shop setup" : "Create the shop account"}</p>
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
      <Button type="submit" className="min-h-12 w-full" disabled={busy}>
        {busy ? "Working…" : user ? "Continue to shop setup" : "Create account and open a shop"}
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
