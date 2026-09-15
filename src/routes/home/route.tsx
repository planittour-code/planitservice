import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { AppNavLink, SignedInHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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
          <AppNavLink to="/home/add">Add a property</AppNavLink>
          <AppNavLink to="/home/settings">Settings</AppNavLink>
          <Button asChild size="sm">
            <Link to="/home/add">New record</Link>
          </Button>
          <UserButton tone="dark" />
        </nav>
      </SignedInHeader>
      <div className="mx-auto max-w-5xl px-5 py-5">
        <Outlet />
      </div>
    </div>
  );
}
