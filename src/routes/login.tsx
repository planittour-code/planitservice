import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, authClient, authEnabled, grokOauthOnThisHost, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { safeNextPath } from "@/lib/housefile/invite";

const searchSchema = z.object({
  invite: z.string().optional(),
  email: z.string().optional(),
  next: z.string().optional(),
  role: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  component: Login,
});

function Login() {
  const search = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const homeowner = Boolean(search.invite) || search.role === "homeowner";
  const after = search.invite
    ? `/invite/${search.invite}`
    : search.next
      ? safeNextPath(search.next, homeowner ? "/home" : "/app/onboard")
      : homeowner
        ? "/home"
        : "/app/onboard";
  const [mode, setMode] = useState<"in" | "up">(search.invite ? "up" : "in");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isPending && user) {
    if (search.invite) {
      return <Navigate to="/invite/$token" params={{ token: search.invite }} />;
    }
    const next = safeNextPath(search.next);
    if (next.startsWith("/app/new")) {
      const params = new URLSearchParams(next.split("?")[1] ?? "");
      return (
        <Navigate
          to="/app/new"
          search={{
            work: params.get("work") ?? undefined,
            address: params.get("address") ?? undefined,
            city: params.get("city") ?? undefined,
            state: params.get("state") ?? undefined,
            zip: params.get("zip") ?? undefined,
            rfp: params.get("rfp") ?? undefined,
          }}
        />
      );
    }
    if (homeowner || next === "/home" || next === "/my" || search.next === "/my") {
      return <Navigate to="/home" />;
    }
    return <Navigate to="/app" />;
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const res = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
          callbackURL: after,
        });
        if (res.error) throw new Error(res.error.message || "Could not create account");
      } else {
        const res = await authClient.signIn.email({ email, password, callbackURL: after });
        if (res.error) throw new Error(res.error.message || "Could not sign in");
      }
      window.location.href = after;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <PublicHeader>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </Link>
      </PublicHeader>
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            {homeowner ? "For the homeowner" : "For contractors"}
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight md:text-5xl">
            {homeowner ? "Keep the record for every house you own." : "Sign in and quote the job."}
          </h1>
          <p className="max-w-md text-muted-foreground">
            {homeowner
              ? "Jobs, warranties, and maintenance at the address. Add another property when you need to. Pro hands the File to the next owner."
              : "Pick the template. Enter while you talk. Price from the book. Send the estimate before you leave. The File is how they call you back."}
          </p>
        </div>
        <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-border)]">
          {authEnabled ? (
            <div className="space-y-3">
              {grokOauthOnThisHost() &&
                GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => signIn(p.providerId, { callbackURL: after })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              {grokOauthOnThisHost() && (
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">or email</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <form className="space-y-3" onSubmit={(e) => void onEmail(e)}>
                {mode === "up" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{search.invite ? "Your name" : "Company or name"}</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
                </Button>
              </form>
              <button
                type="button"
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "up" ? "in" : "up")}
              >
                {mode === "up" ? "Already have an account? Sign in" : "New here? Create an account"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
