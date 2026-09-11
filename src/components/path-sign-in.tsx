import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function PathSignInForm({
  next,
  role,
  kicker,
  title,
  submitLabel,
  newAccountTo,
  newAccountLabel,
  onNewAccount,
}: {
  next: string;
  role?: "homeowner" | "manager" | "contractor";
  kicker: string;
  title: string;
  submitLabel?: string;
  newAccountTo?: "/shop/open" | "/manage/open" | "/homeowner";
  newAccountLabel: string;
  onNewAccount?: () => void;
}) {
  const { user } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return null;
  if (!authEnabled) {
    return <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authClient.signIn.email({ email, password, callbackURL: next });
      if (res.error) throw new Error(res.error.message || "Could not sign in");
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm tracking-wide text-muted-foreground uppercase">{kicker}</p>
        <p className="mt-1 font-display text-2xl font-medium tracking-tight">{title}</p>
      </div>
      <form className="space-y-2" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1">
          <Label htmlFor="path-email">Email</Label>
          <Input
            id="path-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="path-password">Password</Label>
            <Link
              from="/"
              to="/forgot-password"
              search={{ email: email || undefined, next, role }}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="path-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="pr-11"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((open) => !open)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="min-h-12 w-full" disabled={busy}>
          {busy ? "Signing in…" : submitLabel ?? "Sign in"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        {onNewAccount ? (
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={onNewAccount}
          >
            {newAccountLabel}
          </button>
        ) : newAccountTo ? (
          <Link
            from="/"
            to={newAccountTo}
            search={
              newAccountTo === "/manage/open" || newAccountTo === "/shop/open"
                ? { intent: "up" }
                : undefined
            }
            className="underline underline-offset-2 hover:text-foreground"
          >
            {newAccountLabel}
          </Link>
        ) : null}
      </p>
    </div>
  );
}
