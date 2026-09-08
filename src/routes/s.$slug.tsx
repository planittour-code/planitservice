import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { workFromId } from "@/lib/housefile/quote";
import { getPublicShop } from "@/lib/housefile/server";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicShop({ data: params.slug });
    } catch {
      return null;
    }
  },
  component: PublicShopPage,
});

function PublicShopPage() {
  const { slug } = Route.useParams();
  const initial = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: () => getPublicShop({ data: slug }),
    initialData: initial ?? undefined,
    retry: false,
  });

  if (q.isLoading && !q.data) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <Skeleton className="mx-auto h-64 max-w-3xl" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">Shop not found</h1>
          <p className="text-sm text-muted-foreground">This public shop link may be wrong or not live yet.</p>
        </div>
      </main>
    );
  }

  const shop = q.data;
  const place = [shop.street, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
  const trades = shop.trades.map((id) => workFromId(id)).filter((w): w is NonNullable<typeof w> => Boolean(w));
  const asHref = (href: string) => (/^https?:\/\//i.test(href) ? href : `https://${href}`);
  const reviews = [
    shop.review_google ? { label: "Google", href: asHref(shop.review_google) } : null,
    shop.review_trustpilot ? { label: "Trustpilot", href: asHref(shop.review_trustpilot) } : null,
    shop.review_nextdoor ? { label: "Nextdoor", href: asHref(shop.review_nextdoor) } : null,
    shop.review_other ? { label: "Reviews", href: asHref(shop.review_other) } : null,
  ].filter((row): row is { label: string; href: string } => Boolean(row));
  const associations = (shop.associations ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader compact path="public">
        <Button asChild variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </PublicHeader>
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
        {shop.logo_src ? (
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <img src={shop.logo_src} alt={shop.name} className="h-44 w-full object-contain p-6 sm:h-56" />
          </div>
        ) : null}
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-medium tracking-tight">{shop.name}</h1>
          {place ? <p className="text-muted-foreground">{place}</p> : null}
          {shop.years_in_business ? (
            <p className="text-sm text-muted-foreground">{shop.years_in_business} years in business</p>
          ) : null}
        </div>
        {trades.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-medium">Work we quote</h2>
            <ul className="flex flex-wrap gap-2">
              {trades.map((work) => (
                <li
                  key={work.id}
                  className="inline-flex min-h-11 items-center rounded-md border border-border bg-background px-3 text-sm"
                >
                  {work.name}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(shop.phone || shop.email || shop.website) && (
          <section className="space-y-2 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-medium">Contact</h2>
            {shop.phone ? <p>{shop.phone}</p> : null}
            {shop.email ? (
              <p>
                <a className="underline underline-offset-4" href={`mailto:${shop.email}`}>
                  {shop.email}
                </a>
              </p>
            ) : null}
            {shop.website ? (
              <p>
                <a
                  className="underline underline-offset-4"
                  href={/^https?:\/\//i.test(shop.website) ? shop.website : `https://${shop.website}`}
                  rel="noreferrer"
                >
                  {shop.website}
                </a>
              </p>
            ) : null}
          </section>
        )}
        {associations.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-medium">Associations</h2>
            <p className="text-muted-foreground">{associations.join(" · ")}</p>
          </section>
        )}
        {reviews.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-medium">Reviews</h2>
            <ul className="flex flex-wrap gap-3 text-sm">
              {reviews.map((row) => (
                <li key={row.href}>
                  <a className="underline underline-offset-4" href={row.href} rel="noreferrer">
                    {row.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <PageFooter shop />
    </div>
  );
}
