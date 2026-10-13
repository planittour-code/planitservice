import { Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";

export function AppNotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <div className="max-w-md space-y-3 text-center">
        <Wordmark />
        <h1 className="font-display text-2xl font-medium">Page not found</h1>
        <p className="text-sm text-muted-foreground">That link is not a PlanitService page.</p>
        <p>
          <Link to="/" className="text-sm underline underline-offset-4">
            Back to PlanitService
          </Link>
        </p>
      </div>
    </main>
  );
}
