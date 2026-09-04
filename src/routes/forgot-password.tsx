import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { LEGAL_EMAIL } from "@/lib/legal";

const searchSchema = z.object({
  email: z.string().optional(),
  next: z.string().optional(),
  role: z.string().optional(),
});

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Reset password — PlanitService" }],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const loginSearch = {
    email: email || undefined,
    next: search.next,
    role: search.role,
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      if (res.error) throw new Error(res.error.message || "Could not send the reset email");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <PublicHeader>
        <Link to="/login" search={loginSearch} className="text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </PublicHeader>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Account</p>
          <h1 className="font-display text-4xl font-medium tracking-tight md:text-5xl">Reset your password</h1>
          <p className="max-w-md text-muted-foreground">
            Enter the email on the account. If it is in our system, we send a link that expires in one
            hour.
          </p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          {!authEnabled ? (
            <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
          ) : sent ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                If that email is on an account, a reset link is on the way. Check spam if it is not in
                the inbox. The link expires in one hour.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nothing arrived? Write {LEGAL_EMAIL} from the same address.
              </p>
              <Button asChild className="w-full">
                <Link to="/login" search={loginSearch}>
                  Back to sign in
                </Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
