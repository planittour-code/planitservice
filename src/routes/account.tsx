import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getAccount } from "@/lib/housefile/server";
import {
  MANAGE_ANNUAL,
  MANAGE_EXTRA_MONTHLY,
  MANAGE_INCLUDED,
  MANAGE_MONTHLY,
  MANAGE_SEAT_MONTHLY,
  PROPERTY_ANNUAL,
  PROPERTY_MONTHLY,
  PRO_ANNUAL,
  PRO_MONTHLY,
  SEAT_MONTHLY,
  SHOP_ANNUAL,
  SHOP_MONTHLY,
  dollars,
} from "@/lib/housefile/pricing";
import { BILLING_PORTAL } from "@/lib/housefile/stripe";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["account"],
    queryFn: () => getAccount(),
    enabled: Boolean(user),
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-5 py-6">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const data = q.data;
  const isShop = Boolean(data?.shop);
  const isHome = (data?.houses.length ?? 0) > 0;
  const isManage = Boolean(data?.portfolio);
  const homeTo = isShop ? "/app" : isManage ? "/manage" : "/home";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Wordmark to={homeTo} />
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Account</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {data?.name ?? user.displayName ?? "You"}
          </h1>
          <p className="mt-1 text-muted-foreground">{data?.email ?? user.primaryEmail}</p>
        </div>

        {q.isLoading && <Skeleton className="h-40 w-full" />}

        {data && (
          <>
            <section className="space-y-3">
              <h2 className="font-display text-xl font-medium">Your dashboard</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {isShop && (
                  <Link
                    to="/app"
                    className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
                  >
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">Contractor</p>
                    <p className="mt-1 font-display text-lg font-medium">{data.shop?.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.quoteCount} {data.quoteCount === 1 ? "quote" : "quotes"} on file
                    </p>
                  </Link>
                )}
                {isHome && (
                <Link
                  to="/home"
                  className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
                >
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Homeowner</p>
                  <p className="mt-1 font-display text-lg font-medium">My houses</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {data.houses.length} {data.houses.length === 1 ? "property" : "properties"}
                  </p>
                </Link>
                )}
                {isManage && data.portfolio && (
                  <Link
                    to="/manage"
                    className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]"
                  >
                    <p className="text-xs tracking-wide text-muted-foreground uppercase">
                      Property manager
                    </p>
                    <p className="mt-1 font-display text-lg font-medium">{data.portfolio.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.portfolio.houseCount}{" "}
                      {data.portfolio.houseCount === 1 ? "house" : "houses"} in the portfolio
                      {data.portfolio.role === "staff" ? " · Staff seat" : ""}
                    </p>
                  </Link>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-medium">License</h2>
              <ul className="divide-y divide-border rounded-xl bg-card shadow-[var(--shadow-border)]">
                {isShop && data.shop && (
                  <li className="px-5 py-4">
                    <p className="font-medium">
                      Shop · {data.shop.role === "owner" ? "Owner" : "Sales seat"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.shop.name}. ${dollars(SHOP_MONTHLY)}/month or ${dollars(SHOP_ANNUAL)}/year
                      for the shop
                      {data.shop.seats > 1
                        ? ` · ${data.shop.seats - 1} extra ${data.shop.seats - 1 === 1 ? "seat" : "seats"} at $${dollars(SEAT_MONTHLY)}/month`
                        : ""}
                      .
                    </p>
                  </li>
                )}
                {data.houses.map((h) => (
                  <li key={h.id} className="px-5 py-4">
                    <p className="font-medium">
                      {h.address}
                      {h.city ? `, ${h.city}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {h.tier
                        ? `${h.tier === "pro" ? "Pro" : "Standard"} · ${h.cadence === "annual" ? "annual" : "monthly"}`
                        : "No paid plan yet"}
                      {h.status ? ` · ${h.status}` : ""}
                      {h.renewsOn ? ` · renews ${formatDay(h.renewsOn)}` : ""}
                      {h.tier
                        ? ` · $${dollars(h.tier === "pro" ? (h.cadence === "annual" ? PRO_ANNUAL : PRO_MONTHLY) : h.cadence === "annual" ? PROPERTY_ANNUAL : PROPERTY_MONTHLY)}${h.cadence === "annual" ? "/year" : "/month"}`
                        : ""}
                    </p>
                  </li>
                ))}
                {isManage && data.portfolio && (
                  <li className="px-5 py-4">
                    <p className="font-medium">
                      Portfolio · {data.portfolio.name}
                      {data.portfolio.role === "staff" ? " · Staff seat" : " · Owner"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${dollars(MANAGE_MONTHLY)}/month or ${dollars(MANAGE_ANNUAL)}/year for{" "}
                      {MANAGE_INCLUDED} houses
                      {data.portfolio.extraSlots > 0
                        ? ` · ${data.portfolio.extraSlots} extra ${data.portfolio.extraSlots === 1 ? "house" : "houses"} at $${dollars(MANAGE_EXTRA_MONTHLY)}/month`
                        : ""}
                      {data.portfolio.extraSeats > 0
                        ? ` · ${data.portfolio.extraSeats} extra ${data.portfolio.extraSeats === 1 ? "seat" : "seats"} at $${dollars(MANAGE_SEAT_MONTHLY)}/month`
                        : ""}
                      .
                    </p>
                  </li>
                )}
                {!isShop && !isHome && !isManage && (
                  <li className="px-5 py-4 text-sm text-muted-foreground">
                    No shop, house, or portfolio license on this login yet.
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl font-medium">Billing</h2>
              <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                <p className="text-sm text-muted-foreground">
                  Cards, invoices, and cancel live in Stripe. Use the email on this account. Paid
                  plans are a{" "}
                  <Link to="/saas" className="underline underline-offset-2">
                    SaaS subscription
                  </Link>{" "}
                  under the{" "}
                  <Link to="/terms" className="underline underline-offset-2">
                    Terms
                  </Link>
                  ,{" "}
                  <Link to="/aup" className="underline underline-offset-2">
                    AUP
                  </Link>
                  , and{" "}
                  <Link to="/sla" className="underline underline-offset-2">
                    SLA
                  </Link>
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <a href={BILLING_PORTAL}>Manage billing</a>
                  </Button>
                  {isShop && (
                    <Button asChild variant="outline">
                      <Link to="/app/settings">Shop settings</Link>
                    </Button>
                  )}
                  {isManage && (
                    <>
                      <Button asChild variant="outline">
                        <Link to="/manage">Open portfolio</Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/manage/settings">Office settings</Link>
                      </Button>
                    </>
                  )}
                  {isHome && (
                    <Button asChild variant="outline">
                      <Link to="/home/settings">Household settings</Link>
                    </Button>
                  )}
                  {!isHome && !isManage && (
                    <Button asChild variant="outline">
                      <Link to="/home/add">Add a house</Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Password</h2>
          <ChangePasswordForm />
        </section>
      </main>
    </div>
  );
}

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (newPassword !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) throw new Error(res.error.message || "Could not update the password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-muted-foreground">
        Change the password on this email login. If you signed in with Google or X and never set a
        password, request a reset from the sign-in page instead.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-new-password">New password</Label>
        <Input
          id="account-new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-confirm-password">Confirm new password</Label>
        <Input
          id="account-confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && <p className="text-sm text-muted-foreground">Password updated.</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}

function formatDay(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
