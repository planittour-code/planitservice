import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Wordmark } from "@/components/logo";
import { PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { claimInvite, getHouseByToken } from "@/lib/housefile/server";

export const Route = createFileRoute("/invite/$token")({
  loader: async ({ params }) => {
    try {
      return await getHouseByToken({ data: params.token });
    } catch {
      return null;
    }
  },
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getHouseByToken({ data: token }),
    initialData: initial ?? undefined,
    enabled: Boolean(token),
  });
  const claim = useMutation({
    mutationFn: () => claimInvite({ data: token }),
    onSuccess: () => q.refetch(),
  });

  useEffect(() => {
    if (isPending || !user || !q.data) return;
    if (q.data.property.homeowner_user_id === user.id) return;
    const invited = q.data.property.homeowner_email.toLowerCase();
    const mine = user.primaryEmail?.toLowerCase();
    if (mine && mine === invited) claim.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, user?.id, user?.primaryEmail, q.data?.property.id]);

  if (q.isLoading) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <p className="mx-auto max-w-3xl text-sm text-muted-foreground">Opening the house account…</p>
        <Skeleton className="mx-auto mt-4 h-40 max-w-3xl" />
      </div>
    );
  }
  if (q.error || !q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">Invitation not found</h1>
          <p className="text-sm text-muted-foreground">Ask the contractor to send the link again.</p>
        </div>
      </main>
    );
  }

  const file = q.data;
  const p = file.property;
  const open = file.proposals.find((pr) => pr.status !== "completed");
  const hero = file.photos.find((ph) => ph.category === "exterior") ?? file.photos[0];
  const claimed = Boolean(user && p.homeowner_user_id === user.id);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader compact>
        {isPending ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
        ) : user ? (
          <UserButton />
        ) : (
          <Link
            to="/login"
            search={{ invite: token, email: p.homeowner_email }}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Keep this file
          </Link>
        )}
      </PublicHeader>
      <main className="hf-rise mx-auto max-w-3xl space-y-8 px-5 pb-16 pt-6">
        {hero && (
          <img
            src={hero.src}
            alt={p.address_line}
            className="aspect-[16/9] min-h-40 w-full rounded-xl object-cover shadow-[var(--shadow-border)]"
          />
        )}
        <header className="space-y-3">
          <p className="text-sm tracking-wide text-muted-foreground uppercase">
            {file.company.name} sent this
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            {open ? open.title : p.address_line}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {open
              ? `${p.address_line}. Review the estimate, then accept it if it is right.`
              : `Hi ${p.homeowner_name}. Jobs and warranties already here stay on the Property Record.`}
          </p>
          {claimed && (
            <p className="text-sm text-primary">This house is in your account. It will stay on My houses.</p>
          )}
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          {open && (
            <Button asChild size="lg">
              <Link to="/p/$token" params={{ token: open.share_token }}>
                Open the estimate
              </Link>
            </Button>
          )}
          <Button asChild size="lg" variant={open ? "outline" : "default"}>
            <Link to="/house/$token" params={{ token: p.share_token }}>
              Property Record
            </Link>
          </Button>
        </div>
        {!user && !isPending && (
          <p className="text-sm text-muted-foreground">
            No password needed to read this.{" "}
            <Link
              to="/login"
              search={{ invite: token, email: p.homeowner_email }}
              className="underline underline-offset-4"
            >
              Create a free account
            </Link>{" "}
            with {p.homeowner_email} only if you want the file to survive a lost link.
          </p>
        )}
        {user && !claimed && (
          <p className="text-sm text-muted-foreground">
            Signed in as {user.primaryEmail ?? "this account"}.{" "}
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => claim.mutate()}
              disabled={claim.isPending}
            >
              {claim.isPending ? "Saving…" : "Add this house to my account"}
            </button>
          </p>
        )}
      </main>
    </div>
  );
}
