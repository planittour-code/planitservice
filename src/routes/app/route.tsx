import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { AppNavLink, SignedInHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { justSignedOut } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getDashboard } from "@/lib/housefile/server";
import { useAudience } from "@/lib/housefile/use-audience";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, isPending } = useCurrentUserState();
  const { audience, isPending: audiencePending } = useAudience();
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const onboardPath = pathname === "/app/onboard";
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    enabled: Boolean(user) && audience.hats.contractor,
  });

  if (justSignedOut()) {
    return <Navigate to="/shop" />;
  }

  if (isPending || (user && audiencePending)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-5xl px-3 py-3">
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }
  if (!user) {
    const invite = inviteTokenFromLocation(location);
    if (invite) {
      return (
        <Navigate
          to="/login"
          search={{ next: "/app/new", role: "contractor", invite }}
        />
      );
    }
    return <Navigate to="/shop" />;
  }

  if (!audience.hats.contractor) {
    if (audience.hats.manager) return <Navigate to="/manage" />;
    if (audience.hats.homeowner) return <Navigate to="/home" />;
    return <Navigate to="/shop/open" />;
  }

  if (dash.data?.role === "owner" && !dash.data.company.onboarded_at && !onboardPath) {
    if (!inviteTokenFromLocation(location)) {
      return <Navigate to="/app/onboard" />;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SignedInHeader
        to="/app"
        max="max-w-5xl"
        mobileNav={
          onboardPath ? undefined : (
            <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-0.5 sm:hidden">
              <AppNavLink to="/app" exact>
                Shop
              </AppNavLink>
              <AppNavLink to="/app/leads">Leads</AppNavLink>
              <AppNavLink to="/app/campaign">Customers</AppNavLink>
              <AppNavLink to="/app/properties">Jobs</AppNavLink>
              <AppNavLink to="/app/book">Materials</AppNavLink>
              <AppNavLink to="/app/settings">Settings</AppNavLink>
            </nav>
          )
        }
      >
        {!onboardPath && (
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            <AppNavLink to="/app" exact>
              Shop
            </AppNavLink>
            <AppNavLink to="/app/leads">Leads</AppNavLink>
            <AppNavLink to="/app/campaign">Customers</AppNavLink>
            <AppNavLink to="/app/properties">Jobs</AppNavLink>
            <AppNavLink to="/app/book">Materials</AppNavLink>
            <AppNavLink to="/app/settings">Shop settings</AppNavLink>
          </nav>
        )}
        {!onboardPath && (
          <Button asChild size="sm" className="ml-auto sm:ml-3">
            <Link to="/app/new">Start a Quote</Link>
          </Button>
        )}
        <div className={onboardPath ? "ml-auto" : ""}>
          <UserButton tone="dark" />
        </div>
      </SignedInHeader>
      <div className="mx-auto w-full max-w-5xl px-3 py-2 sm:px-4">
        <Outlet />
      </div>
    </div>
  );
}

function inviteTokenFromLocation(location: { href?: string; search?: unknown }) {
  const search = location.search as Record<string, unknown> | undefined;
  const raw = search?.invite;
  if (typeof raw === "string") {
    const token = raw.trim();
    if (token && token !== "true" && token !== "false") return token;
  }
  const href = typeof location.href === "string" ? location.href : "";
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1).split("#")[0] : "";
  if (!query) return "";
  const token = new URLSearchParams(query).get("invite")?.trim() || "";
  if (!token || token === "true" || token === "false") return "";
  return token;
}


