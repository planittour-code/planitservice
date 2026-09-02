import { createFileRoute, Link } from "@tanstack/react-router";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { ShopExplainer, ShopSignupForm } from "@/components/shop-signup";

export const Route = createFileRoute("/open")({
  component: OpenShop,
});

function OpenShop() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader home="/shop">
        <Link to="/shop" className="text-sm text-muted-foreground hover:text-foreground">
          Back
        </Link>
      </PublicHeader>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-5 sm:py-12">
        <p className="text-sm tracking-wide text-muted-foreground uppercase">For contractors</p>
        <ShopExplainer />
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
          <ShopSignupForm />
        </div>
      </main>
      <PageFooter shop />
    </div>
  );
}
