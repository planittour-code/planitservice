import { createFileRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/home")({ component: HomeLayout });

function HomeLayout() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-5 py-6">
          <div className="h-10 w-40 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" search={{ role: "homeowner", next: "/home" }} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <Wordmark to="/home" />
          <nav className="ml-auto flex items-center gap-1">
            <Link
              to="/home"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
              activeOptions={{ exact: true }}
            >
              Houses
            </Link>
            <Link
              to="/home/add"
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Add a property
            </Link>
            <Button asChild size="sm">
              <Link to="/home/add">New record</Link>
            </Button>
            <UserButton />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Outlet />
      </div>
    </div>
  );
}
