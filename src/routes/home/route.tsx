import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { NamedShopInvite } from "@/components/named-shop-invite";
import { AppNavLink, SignedInHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { justSignedOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getHomeRecord } from "@/lib/housefile/server";
import { useAudience } from "@/lib/housefile/use-audience";

export const Route = createFileRoute("/home")({ component: HomeLayout });

function HomeLayout() {
  const { user, isPending } = useCurrentUserState();
  const { audience, isPending: audiencePending } = useAudience();
  if (isPending || (user && audiencePending)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }
  if (justSignedOut()) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" search={{ role: "homeowner", next: "/home" }} />;
  if (audience.hats.contractor && !audience.hats.homeowner) {
    return <Navigate to="/app" />;
  }
  if (audience.hats.manager && !audience.hats.homeowner) {
    return <Navigate to="/manage" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SignedInHeader to="/home" max="max-w-5xl">
        <nav className="ml-auto flex items-center gap-1">
          <AppNavLink to="/home" exact>
            Houses
          </AppNavLink>
          <AppNavLink to="/home/settings">Settings</AppNavLink>
          <HouseInviteNav />
          <Button asChild size="sm">
            <Link to="/home/add">Add a property</Link>
          </Button>
          <UserButton tone="dark" />
        </nav>
      </SignedInHeader>
      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </div>
    </div>
  );
}

function HouseInviteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false }) as { id?: string };
  const onHouse = pathname.startsWith("/home/") && Boolean(params.id) && params.id !== "add" && params.id !== "settings";
  const q = useQuery({
    queryKey: ["home-record", params.id],
    queryFn: () => getHomeRecord({ data: params.id as string }),
    enabled: onHouse,
  });
  if (!onHouse) return null;
  const pro = q.data?.plan?.tier === "pro";
  if (!q.data) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-semibold text-white/40"
      >
        Invite a shop
      </button>
    );
  }
  return (
    <NamedShopInvite
      propertyId={q.data.house.property.id}
      invites={q.data.workInvites ?? []}
      estimates={q.data.shopEstimates ?? []}
      allowed={pro}
      onDone={() => {
        void q.refetch();
      }}
    />
  );
}
