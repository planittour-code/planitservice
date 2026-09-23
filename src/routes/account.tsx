import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ProfileHatBadges } from "@/components/profile-hats";
import { SignedInHeader } from "@/components/site-chrome";
import { SocialMark } from "@/components/social-mark";
import { justSignedOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { compressImage } from "@/lib/housefile/image";
import { filledSocials, initialsFrom, SOCIAL_LINKS, type UserProfile } from "@/lib/housefile/profile";
import { getAccount, updateUserProfile } from "@/lib/housefile/server";
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
  if (!user || justSignedOut()) return <Navigate to="/login" />;

  const data = q.data;
  const isShop = Boolean(data?.shop);
  const isHome = (data?.houses.length ?? 0) > 0;
  const isManage = Boolean(data?.portfolio);
  const homeTo = isShop ? "/app" : isManage ? "/manage" : "/home";

  return (
    <div className="min-h-screen bg-background">
      <SignedInHeader to={homeTo} max="max-w-3xl">
        <div className="ml-auto">
          <UserButton tone="dark" />
        </div>
      </SignedInHeader>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">Account</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {data?.name ?? user.displayName ?? "You"}
          </h1>
          <p className="mt-1 text-muted-foreground">{data?.email ?? user.primaryEmail}</p>
        </div>

        {q.isLoading && <Skeleton className="h-40 w-full" />}

        {data?.profile ? <ProfileCard profile={data.profile} /> : null}

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
                      {data.shop.name}. ${dollars(SHOP_MONTHLY)}/month per category
                      {data.shop.categories
                        ? ` · ${data.shop.categories} ${data.shop.categories === 1 ? "category" : "categories"} · $${dollars(data.shop.categories * SHOP_MONTHLY)}/month`
                        : ""}
                      {` · or $${dollars(SHOP_ANNUAL)}/year per category`}
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
                  {isShop && (
                    <Button asChild>
                      <Link to="/app/settings">
                        {data.shop?.role === "owner" ? "Shop settings" : "License"}
                      </Link>
                    </Button>
                  )}
                  {data.shop?.role !== "sales" && (isHome || isManage || !isShop) ? (
                    <Button asChild variant={isShop ? "outline" : undefined}>
                      <a href={BILLING_PORTAL}>Manage billing</a>
                    </Button>
                  ) : null}
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

function ProfileCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.displayName);
  const [headline, setHeadline] = useState(profile.headline);
  const [bio, setBio] = useState(profile.bio);
  const [photo, setPhoto] = useState<string | null>(profile.photoSrc);
  const [links, setLinks] = useState({
    website: profile.website,
    instagram: profile.instagram,
    facebook: profile.facebook,
    x: profile.x,
    linkedin: profile.linkedin,
    nextdoor: profile.nextdoor,
    youtube: profile.youtube,
  });

  useEffect(() => {
    setName(profile.displayName);
    setHeadline(profile.headline);
    setBio(profile.bio);
    setPhoto(profile.photoSrc);
    setLinks({
      website: profile.website,
      instagram: profile.instagram,
      facebook: profile.facebook,
      x: profile.x,
      linkedin: profile.linkedin,
      nextdoor: profile.nextdoor,
      youtube: profile.youtube,
    });
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      updateUserProfile({
        data: {
          displayName: name,
          headline,
          bio,
          photoSrc: photo,
          ...links,
        },
      }),
    onSuccess: async () => {
      toast.success("Profile saved");
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      await authClient.getSession({ query: { disableCookieCache: true } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save profile"),
  });

  const live: UserProfile = { ...profile, displayName: name, headline, bio, photoSrc: photo, ...links };
  const previewLinks = filledSocials(live);
  const sharePath = profile.slug ? `/u/${profile.slug}` : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-medium">Your profile</h2>
          <p className="text-sm text-muted-foreground">
            Name, photo, and the links people can open about you.
          </p>
        </div>
        {sharePath ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/u/$slug" params={{ slug: profile.slug! }}>
              View public page
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
        <div className="bg-ink px-5 pb-14 pt-6">
          <p className="font-display text-2xl font-medium tracking-tight text-primary-foreground">
            {name.trim() || "Your name"}
          </p>
        </div>
        <form
          className="space-y-5 px-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="-mt-12">
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="relative shrink-0 rounded-full outline outline-4 outline-card"
              aria-label="Change profile photo"
            >
              {photo ? (
                <img src={photo} alt="" className="size-24 rounded-full object-cover" />
              ) : (
                <span className="grid size-24 place-items-center rounded-full bg-muted font-display text-3xl font-medium text-muted-foreground">
                  {initialsFrom(name || "You")}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-full bg-ink/70 py-1 text-center text-[10px] font-medium tracking-wide text-primary-foreground uppercase">
                <Camera className="size-3" aria-hidden />
                Photo
              </span>
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void compressImage(file, 400, 0.7)
                  .then(setPhoto)
                  .catch((err) => toast.error(err instanceof Error ? err.message : "Could not read the photo"));
              }}
            />
            {profile.email ? <p className="mt-3 text-sm text-muted-foreground">{profile.email}</p> : null}
            {profile.hats.length ? (
              <div className="mt-2">
                <ProfileHatBadges hats={profile.hats} />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-headline">Headline</Label>
              <Input
                id="profile-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Painter in Marietta · property manager"
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-bio">About you</Label>
            <Textarea
              id="profile-bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short note people can share — how you work, the neighborhood, what you want them to know."
              maxLength={600}
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Social links</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIAL_LINKS.map((s) => (
                <div key={s.key} className="space-y-1">
                  <Label htmlFor={`profile-${s.key}`}>{s.label}</Label>
                  <Input
                    id={`profile-${s.key}`}
                    value={links[s.key]}
                    onChange={(e) => setLinks((cur) => ({ ...cur, [s.key]: e.target.value }))}
                    placeholder={s.placeholder}
                    inputMode="url"
                    autoComplete="url"
                  />
                </div>
              ))}
            </div>
          </div>

          {previewLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {previewLinks.map((link) => (
                <li key={link.key}>
                  <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-sm">
                    <SocialMark kind={link.key} className="size-3.5 text-muted-foreground" />
                    {link.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
            {sharePath ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Share{" "}
                  <Link to="/u/$slug" params={{ slug: profile.slug! }} className="underline underline-offset-2">
                    planitservice.com{sharePath}
                  </Link>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url =
                      typeof window !== "undefined"
                        ? `${window.location.origin}${sharePath}`
                        : `https://planitservice.com${sharePath}`;
                    void navigator.clipboard.writeText(url).then(
                      () => toast.success("Profile link copied"),
                      () => toast.error("Could not copy the link"),
                    );
                  }}
                >
                  Copy link
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Save once to get a public page you can share.</p>
            )}
          </div>
        </form>
      </div>
    </section>
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
    <form className="space-y-2 rounded-xl bg-card p-3 shadow-[var(--shadow-border)]" onSubmit={(e) => void onSubmit(e)}>
      <p className="text-sm text-muted-foreground">
        Change the password on this email login. If you signed in with Google or X and never set a
        password, request a reset from the sign-in page instead.
      </p>
      <div className="space-y-1">
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
      <div className="space-y-1">
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
      <div className="space-y-1">
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
