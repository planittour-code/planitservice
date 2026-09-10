import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
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

  if (isPending || (user && audiencePending)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-5 py-6">
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
          search={{ next: `/app/new?invite=${encodeURIComponent(invite)}`, role: "contractor" }}
        />
      );
    }
    return <Navigate to="/shop/open" />;
  }

  if (!audience.hats.contractor) {
    if (audience.hats.manager) return <Navigate to="/manage" />;
    if (audience.hats.homeowner) return <Navigate to="/home" />;
    return <Navigate to="/shop/open" />;
  }

  if (dash.data?.role === "owner" && !dash.data.company.onboarded_at && !onboardPath) {
    return <Navigate to="/app/onboard" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <Wordmark to="/app" />
          {!onboardPath && (
            <nav className="ml-auto hidden items-center gap-1 sm:flex">
              <NavLink to="/app">Shop</NavLink>
              <NavLink to="/app/properties">Jobs</NavLink>
              <NavLink to="/app/book">Materials</NavLink>
              <NavLink to="/app/settings">Shop settings</NavLink>
            </nav>
          )}
          {!onboardPath && (
            <Button asChild size="sm" className="ml-auto sm:ml-3">
              <Link to="/app/new">Start a Quote</Link>
            </Button>
          )}
          <div className={onboardPath ? "ml-auto" : ""}>
            <UserButton />
          </div>
        </div>
        {!onboardPath && (
        <nav className="flex gap-1 overflow-x-auto border-t border-border px-2 py-1 sm:hidden">
          <NavLink to="/app">Shop</NavLink>
          <NavLink to="/app/properties">Jobs</NavLink>
          <NavLink to="/app/book">Materials</NavLink>
          <NavLink to="/app/settings">Settings</NavLink>
        </nav>
        )}
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
        <Outlet />
      </div>
    </div>
  );
}

function inviteTokenFromLocation(location: { href?: string; search?: unknown }) {
  const search = location.search as Record<string, unknown> | undefined;
  if (typeof search?.invite === "string" && search.invite.trim()) return search.invite.trim();
  const href = typeof location.href === "string" ? location.href : "";
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1).split("#")[0] : "";
  if (!query) return "";
  return new URLSearchParams(query).get("invite")?.trim() || "";
}

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
      activeOptions={{ exact: to === "/app" }}
    >
      {children}
    </Link>
  );
}
