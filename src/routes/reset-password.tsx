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
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Choose a new password — PlanitService" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const search = Route.useSearch();
  const token = search.token?.trim() ?? "";
  const invalid = Boolean(search.error) || !token;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (res.error) throw new Error(res.error.message || "Could not update the password");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <PublicHeader>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          Sign in
        </Link>
      </PublicHeader>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Account</p>
          <h1 className="font-display text-4xl font-medium tracking-tight md:text-5xl">Choose a new password</h1>
          <p className="max-w-md text-muted-foreground">
            Use at least eight characters. After you save it, sign in with the new password.
          </p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          {!authEnabled ? (
            <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
          ) : done ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Password updated. Sign in with the email on the account and the new password.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          ) : invalid ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                This reset link is missing or expired. Request a new one from the sign-in page. If it
                keeps failing, write {LEGAL_EMAIL}.
              </p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Saving…" : "Save new password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
