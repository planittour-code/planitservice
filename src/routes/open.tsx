import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SEAT_MONTHLY, SHOP_ANNUAL, SHOP_MONTHLY, dollars } from "@/lib/housefile/pricing";

export const Route = createFileRoute("/open")({
  component: OpenShop,
});

function OpenShop() {
  const navigate = useNavigate();
  const { user } = useCurrentUserState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = "/app/onboard";

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
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader home="/shop">
        <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </Link>
      </PublicHeader>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-5 sm:py-12">
        <div className="space-y-3">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">For contractors</p>
          <h1 className="font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            Open a shop
          </h1>
          <p className="max-w-2xl text-muted-foreground leading-relaxed">
            First to quote wins more jobs. Accuracy makes it count. Search the address, quote from
            the last job on the File, and send the number while you are still talking — or before
            you roll the truck.
          </p>
        </div>

        <ul className="space-y-4">
          <Value
            title="Know before you go"
            body="Look up the house. If a File is there, specs from the last job are already written down. You walk in ready, or you quote without the drive."
          />
          <Value
            title="Quote from the book"
            body="Templates, takeoff lines, and your price book. National supplier APIs, a spreadsheet, or numbers you type. The estimate goes out before the other shop leaves the shop."
          />
          <Value
            title="The File brings them back"
            body="Every quote starts the house record if one is not there. The next trade at that address already has your work on file. Repeat business is why you built it."
          />
        </ul>

        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">The shop</p>
          <p className="mt-2 font-display text-4xl font-medium tracking-tight">
            ${dollars(SHOP_MONTHLY)}
            <span className="ml-2 text-lg font-sans font-normal text-muted-foreground">/ month</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or ${dollars(SHOP_ANNUAL)} a year. Extra seats ${dollars(SEAT_MONTHLY)}/month.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
            <li>Unlimited quotes and House Files</li>
            <li>Owner plus sales seats</li>
            <li>You pay for the people who quote — not per house</li>
          </ul>
        </div>

        <form
          className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6"
          onSubmit={(e) => void onSubmit(e)}
        >
          <h2 className="font-display text-2xl font-medium tracking-tight">
            {user ? "Continue shop setup" : "Create the shop account"}
          </h2>
          {!user && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="open-name">Shop or your name</Label>
                <Input
                  id="open-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="open-email">Email</Label>
                <Input
                  id="open-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="open-password">Password</Label>
                <Input
                  id="open-password"
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
      </main>
      <PageFooter shop />
    </div>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <li className="space-y-1">
      <p className="font-medium">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </li>
  );
}
